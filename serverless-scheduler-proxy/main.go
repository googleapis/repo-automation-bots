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
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/http/httputil"
	"os"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	"github.com/google/uuid"
	secretmanagerpb "google.golang.org/genproto/googleapis/cloud/secretmanager/v1"
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

	cfg := botConfig{
		project: projectID,
	}

	mux := http.NewServeMux()
	// TODO: remove the legacy v0 endpoint once we've confirmed everything
	// is working as expected:
	mux.Handle("/v0", botCronProxy(cfg))
	mux.Handle("/v0/cron", botCronProxy(cfg))
	mux.Handle("/v0/pubsub", botPubSubProxy(cfg))
	mux.Handle("/v0/container", botContainerProxy(cfg))

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

func rewriteBotContainerURL(c botConfig) func(*http.Request) {
	return func(req *http.Request) {
		req.Header.Add("x-github-event", "pubsub.message")
		parser := func(bodyBytes []byte) (string, string) {
			var pay PubSubMessage
			if err := json.Unmarshal(bodyBytes, &pay); err != nil {
				log.Printf("error occurred parsing container pubsub message: %v\n", err)
			}
			log.Printf("handling container pubsub message for subscription: %v\n", pay.Subscription)
			// TODO: pull bot name and location into configuration, once
			// we validate this approach:
			return "owl_bot", "us-central1"
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

	var secrets SecretConfig
	if err := json.Unmarshal(key, &secrets); err != nil {
		log.Printf("error occurred parsing container secret contents: %v\n", err)
	}

	// Make a hmac sig, convert to hex
	signer := hmac.New(sha1.New, []byte(secrets.Secret))
	signer.Write(bodyBytes)
	signature := hex.EncodeToString(signer.Sum(nil))

	req.Header.Add("x-hub-signature", "sha1="+signature)
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

func botContainerProxy(cfg botConfig) http.HandlerFunc {
	return (&httputil.ReverseProxy{
		Director: rewriteBotContainerURL(cfg),
	}).ServeHTTP
}

type SecretConfig struct {
	PrivateKey string `json:"privateKey"`
	AppId      int    `json:"appId"`
	Secret     string `json:"secret"`
}

type reqPayload struct {
	Name     string
	Type     string
	Location string
}

type botConfig struct {
	project string
}

func getBotSecret(ctx context.Context, b botConfig, botName string) ([]byte, error) {
	name := fmt.Sprintf("projects/%v/secrets/%v/versions/latest", b.project, botName)

	client, err := secretmanager.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create secretmanager client: %v", err)
	}
	defer client.Close()

	// Build the request.
	req := &secretmanagerpb.AccessSecretVersionRequest{
		Name: name,
	}

	// Call the API.
	result, err := client.AccessSecretVersion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to access secret version: %v", err)
	}

	return result.Payload.Data, nil
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
