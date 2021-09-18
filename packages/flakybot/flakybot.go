// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Command flakybot searches for sponge_log.xml files and publishes them to
// Pub/Sub.
//
// You can run it locally by running:
//   go build
//   ./flakybot -repo=my-org/my-repo -installation_id=123 -project=my-project
package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"

	"cloud.google.com/go/pubsub"
	"google.golang.org/api/option"
)

func main() {
	log.SetFlags(0)
	log.SetPrefix("[FlakyBot] ")
	log.SetOutput(os.Stderr)

	repo := flag.String("repo", "", "The repo this is for. Defaults to auto-detect from Kokoro environment. If that doesn't work, if your repo is github.com/GoogleCloudPlatform/golang-samples, --repo should be GoogleCloudPlatform/golang-samples")
	installationID := flag.String("installation_id", "", "GitHub installation ID. Defaults to auto-detect. If your repo is not part of GoogleCloudPlatform or googleapis set this to the GitHub installation ID for your repo. See https://github.com/googleapis/repo-automation-bots/issues.")
	projectID := flag.String("project", "repo-automation-bots", "Project ID to publish to. Defaults to repo-automation-bots.")
	topicID := flag.String("topic", "passthrough", "Pub/Sub topic to publish to. Defaults to passthrough.")
	logsDir := flag.String("logs_dir", ".", "The directory to look for logs in. Defaults to current directory.")
	commit := flag.String("commit_hash", "", "Long form commit hash this build is being run for. Defaults to the KOKORO_GIT_COMMIT environment variable.")
	serviceAccount := flag.String("service_account", "", "Path to service account to use instead of Trampoline default or client library auto-detection.")
	buildURL := flag.String("build_url", "", "Build URL (markdown OK). Defaults to detect from Kokoro.")

	flag.Parse()

	cfg := &config{
		projectID:      *projectID,
		topicID:        *topicID,
		repo:           *repo,
		installationID: *installationID,
		commit:         *commit,
		logsDir:        *logsDir,
		serviceAccount: *serviceAccount,
		buildURL:       *buildURL,
	}
	if ok := cfg.setDefaults(); !ok {
		os.Exit(1)
	}

	log.Println("Sending logs to Flaky Bot...")
	log.Println("See https://github.com/googleapis/repo-automation-bots/tree/main/packages/flakybot.")

	if ok := publish(cfg); !ok {
		os.Exit(1)
	}

	log.Println("Done!")
}

type githubInstallation struct {
	ID string `json:"id"`
}

type message struct {
	Name         string             `json:"name"`
	Type         string             `json:"type"`
	Location     string             `json:"location"`
	Installation githubInstallation `json:"installation"`
	Repo         string             `json:"repo"`
	Commit       string             `json:"commit"`
	BuildURL     string             `json:"buildURL"`
	XUnitXML     string             `json:"xunitXML"`
}

type config struct {
	projectID      string
	topicID        string
	repo           string
	installationID string
	commit         string
	logsDir        string
	serviceAccount string
	buildURL       string
}

func (cfg *config) setDefaults() (ok bool) {
	if cfg.serviceAccount == "" {
		if gfileDir := os.Getenv("KOKORO_GFILE_DIR"); gfileDir != "" {
			// Assume any given service account exists, but check the Trampoline
			// account exists before trying to use it (instead of default
			// credentials).
			path := filepath.Join(gfileDir, "kokoro-trampoline.service-account.json")
			if _, err := os.Stat(path); err == nil {
				cfg.serviceAccount = path
			}
		}
	}

	if cfg.repo == "" {
		cfg.repo = detectRepo()
	}
	if cfg.repo == "" {
		log.Printf(`Unable to detect repo. Please set the --repo flag.
If your repo is github.com/GoogleCloudPlatform/golang-samples, --repo should be GoogleCloudPlatform/golang-samples.

If your repo is not in GoogleCloudPlatform or googleapis, you must also set
--installation_id. See https://github.com/apps/flaky-bot/.`)
		return false
	}

	if cfg.installationID == "" {
		cfg.installationID = detectInstallationID(cfg.repo)
	}
	if cfg.installationID == "" {
		log.Printf(`Unable to detect installation ID from repo=%q. Please set the --installation_id flag.
If your repo is part of GoogleCloudPlatform or googleapis and you see this error,
file an issue at https://github.com/googleapis/repo-automation-bots/issues.
Otherwise, set --installation_id with the numeric installation ID.
See https://github.com/apps/flaky-bot/.`, cfg.repo)
		return false
	}

	if cfg.commit == "" {
		cfg.commit = os.Getenv("KOKORO_GIT_COMMIT")
	}
	if cfg.commit == "" {
		log.Printf(`Unable to detect commit hash (expected the KOKORO_GIT_COMMIT env var).
Please set --commit_hash to the latest git commit hash.
See https://github.com/apps/flaky-bot/.`)
		return false
	}

	if cfg.buildURL == "" {
		buildID := os.Getenv("KOKORO_BUILD_ID")
		if buildID == "" {
			log.Printf(`Unable to build URL (expected the KOKORO_BUILD_ID env var).
Please set --build_url to the URL of the build.
See https://github.com/apps/flaky-bot/.`)
			return false
		}
		cfg.buildURL = fmt.Sprintf("[Build Status](https://source.cloud.google.com/results/invocations/%s), [Sponge](http://sponge2/%s)", buildID, buildID)
	}

	return true
}

// publish searches for sponge_log.xml files and publishes them to Pub/Sub.
// publish logs a message and returns false if there was an error.
func publish(cfg *config) (ok bool) {
	ctx := context.Background()

	opts := []option.ClientOption{}

	if cfg.serviceAccount != "" {
		opts = append(opts, option.WithCredentialsFile(cfg.serviceAccount))
	}

	client, err := pubsub.NewClient(ctx, cfg.projectID, opts...)
	if err != nil {
		log.Printf("Unable to connect to Pub/Sub: %v", err)
		return false
	}
	topic := client.Topic(cfg.topicID)
	p := &publisher{topic: topic}

	// Handle logs in the current directory.
	if err := filepath.WalkDir(cfg.logsDir, processLog(ctx, cfg, p)); err != nil {
		log.Printf("Error publishing logs: %v", err)
		return false
	}

	return true
}

// detectRepo tries to detect the repo from the environment.
func detectRepo() string {
	githubURL := os.Getenv("KOKORO_GITHUB_COMMIT_URL")
	if githubURL == "" {
		githubURL = os.Getenv("KOKORO_GITHUB_PULL_REQUEST_URL")
		if githubURL != "" {
			log.Printf("Warning! Running on a PR. Double check how you call buildocp before merging.")
		}
	}
	if githubURL == "" {
		return ""
	}
	parts := strings.Split(githubURL, "/")
	if len(parts) < 5 {
		return ""
	}
	repo := fmt.Sprintf("%s/%s", parts[3], parts[4])
	return repo
}

// detectInstallationID tries to detect the GitHub installation ID based on the
// repo.
func detectInstallationID(repo string) string {
	if strings.Contains(repo, "GoogleCloudPlatform") {
		return "5943459"
	}
	if strings.Contains(repo, "googleapis") {
		return "6370238"
	}
	return ""
}

type messagePublisher interface {
	publish(context.Context, *pubsub.Message) (serverID string, err error)
}

type publisher struct {
	topic *pubsub.Topic
}

func (p *publisher) publish(ctx context.Context, msg *pubsub.Message) (serverID string, err error) {
	return p.topic.Publish(ctx, msg).Get(ctx)
}

// processLog is used to process log files and publish them to Pub/Sub.
func processLog(ctx context.Context, cfg *config, p messagePublisher) fs.WalkDirFunc {
	return func(path string, dirEntry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !strings.HasSuffix(dirEntry.Name(), "sponge_log.xml") {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("os.ReadFile(%q): %v", path, err)
		}
		enc := base64.StdEncoding.EncodeToString(data)
		msg := message{
			Name:         "flakybot",
			Type:         "function",
			Location:     "us-central1",
			Installation: githubInstallation{ID: cfg.installationID},
			Repo:         cfg.repo,
			Commit:       cfg.commit,
			BuildURL:     cfg.buildURL,
			XUnitXML:     enc,
		}
		data, err = json.Marshal(msg)
		if err != nil {
			return fmt.Errorf("json.Marshal: %v", err)
		}
		pubsubMsg := &pubsub.Message{
			Data: data,
		}
		id, err := p.publish(ctx, pubsubMsg)
		if err != nil {
			return fmt.Errorf("Pub/Sub Publish.Get: %v", err)
		}
		log.Printf("Published %s (%v)!", path, id)
		return nil
	}
}
