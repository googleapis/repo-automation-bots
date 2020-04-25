/*
Copyright 2019 Google LLC
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    https://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"net/http/httputil"
	"os"

	cloudkms "cloud.google.com/go/kms/apiv1"
	"cloud.google.com/go/storage"
	"github.com/google/uuid"
	kmspb "google.golang.org/genproto/googleapis/cloud/kms/v1"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		log.Fatal("PORT environment variable not specified")
	}

	projectID := os.Getenv("PROJECT_ID")
	if projectID == "" {
		log.Fatal("PROJECT_ID environment variable not specified")
	}

	bucketName := os.Getenv("BUCKET_NAME")
	if bucketName == "" {
		log.Fatal("BUCKET_NAME environment variable not specified")
	}

	keyLocation := os.Getenv("KEY_LOCATION")
	if keyLocation == "" {
		log.Fatal("KEY_LOCATION environment variable not specified")
	}

	keyRing := os.Getenv("KEY_RING")
	if keyRing == "" {
		log.Fatal("KEY_RING environment variable not specified")
	}

	cfg := botConfig{
		project:     projectID,
		bucketName:  bucketName,
		keyLocation: keyLocation,
		keyRing:     keyRing,
	}

	mux := http.NewServeMux()
	// TODO: remove the legacy v0 endpoint once we've confirmed everything
	// is working as expected:
	mux.Handle("/v0", botCronProxy(cfg))
	mux.Handle("/v0/cron", botCronProxy(cfg))
	mux.Handle("/v0/pubsub", botPubSubProxy(cfg))

	addr := ":" + port
	log.Printf("starting to listen on %s", addr)
	var err error
	if cert, key := os.Getenv("TLS_CERT"), os.Getenv("TLS_KEY"); cert != "" && key != "" {
		err = http.ListenAndServeTLS(addr, cert, key, mux)
	} else {
		err = http.ListenAndServe(addr, mux)
	}

	if err != http.ErrServerClosed {
		log.Fatalf("listen error: %+v", err)
	}

	log.Printf("server shutdown successfully")
}

func rewriteBotCronURL(c botConfig) func(*http.Request) {
	return func(req *http.Request) {
		req.Header.Add("x-github-event", "schedule.repository")
		parser := func(bodyBytes []byte) (string, string) {
			var pay reqPayload
			json.Unmarshal(bodyBytes, &pay)
			return pay.Name, pay.Location
		}
		rewriteBotURL(c, parser, req)
	}
}

func rewriteBotPubSubURL(c botConfig) func(*http.Request) {
	return func(req *http.Request) {
		req.Header.Add("x-github-event", "pubsub.message")
		parser := func(bodyBytes []byte) (string, string) {
			var pay PubSubMessage
			json.Unmarshal(bodyBytes, &pay)
			log.Printf("handling pubsub message for subscription: %v\n", pay.Subscription)

			var msg RepoAutomationPubSubMessage
			json.Unmarshal(pay.Message.Data, &msg)
			log.Printf("pubsub message for bot: %v in %v\n", msg.Name, msg.Location)
			return msg.Name, msg.Location
		}
		rewriteBotURL(c, parser, req)
	}
}

func rewriteBotURL(c botConfig, parser func([]byte) (string, string), req *http.Request) {

	var bodyBytes []byte
	if req.Body != nil {
		bodyBytes, _ = ioutil.ReadAll(req.Body)
		req.Body = ioutil.NopCloser(bytes.NewBuffer(bodyBytes))
	} else {
		log.Println("request had no body")
	}

	botName, botLocation := parser(bodyBytes)

	u := req.URL.String()
	req.URL.Scheme = "https"

	// Explicitly remove UserAgent header
	req.Header.Del("user-agent")

	newHost := fmt.Sprintf("%v-%v.cloudfunctions.net", botLocation, c.project)

	req.Host = newHost
	req.URL.Host = newHost
	req.URL.Path = fmt.Sprintf("/%v", botName)

	key, err := getBotSecret(req.Context(), c, botName)
	if err != nil {
		log.Printf("error getting bot secret: %v", err)
	}

	// Make a hmac sig
	signer := hmac.New(sha1.New, key)
	signer.Write(bodyBytes)

	req.Header.Add("x-hub-signature", base64.StdEncoding.EncodeToString(signer.Sum(nil)))
	req.Header.Add("x-github-delivery", uuid.New().String())

	log.Printf("rewrote url: %s into %s", u, req.URL)
}

// botCronProxy returns a reverse proxy to the specified bot.
func botCronProxy(cfg botConfig) http.HandlerFunc {
	return (&httputil.ReverseProxy{
		Director: rewriteBotCronURL(cfg),
	}).ServeHTTP
}

func botPubSubProxy(cfg botConfig) http.HandlerFunc {
	return (&httputil.ReverseProxy{
		Director: rewriteBotPubSubURL(cfg),
	}).ServeHTTP
}

type reqPayload struct {
	Name     string
	Type     string
	Location string
}

type botConfig struct {
	project     string
	region      string
	bucketName  string
	keyLocation string
	keyRing     string
}

func getBotSecret(ctx context.Context, b botConfig, botName string) ([]byte, error) {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return []byte{}, err
	}

	bkt := client.Bucket(b.bucketName)
	obj := bkt.Object(botName)

	r, err := obj.NewReader(ctx)
	if err != nil {
		return []byte{}, err
	}
	defer r.Close()

	var cypherBytes []byte
	cypherBuffer := bytes.NewBuffer(cypherBytes)
	if _, err := io.Copy(cypherBuffer, r); err != nil {
		return []byte{}, err
	}

	// Decrypt with KMS
	kmsclient, err := cloudkms.NewKeyManagementClient(ctx)
	if err != nil {
		return []byte{}, fmt.Errorf("cloudkms.NewKeyManagementClient: %v", err)
	}

	// Build the request.
	req := &kmspb.DecryptRequest{
		Name:       fmt.Sprintf("projects/%v/locations/%v/keyRings/%v/cryptoKeys/%v", b.project, b.keyLocation, b.keyRing, botName),
		Ciphertext: cypherBytes,
	}
	// Call the API.
	resp, err := kmsclient.Decrypt(ctx, req)
	if err != nil {
		return []byte{}, fmt.Errorf("Decrypt: %v", err)
	}

	return resp.Plaintext, nil
}

// RepoAutomationPubSubMessage represents
// THe data recieved from a PubSubMessage
type RepoAutomationPubSubMessage struct {
	Name     string `json:"Name"`     // Name of Bot
	Location string `json:"Location"` // Region where bot lives
}

// PubSubMessage is the payload of a Pub/Sub event.
type PubSubMessage struct {
	Message struct {
		Data []byte `json:"data,omitempty"`
		ID   string `json:"id"`
	} `json:"message"`
	Subscription string `json:"subscription"`
}
