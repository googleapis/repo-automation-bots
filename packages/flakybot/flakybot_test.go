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

package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"cloud.google.com/go/pubsub"
	"github.com/google/go-cmp/cmp"
)

func TestSetDefaults(t *testing.T) {
	tests := []struct {
		name   string
		env    map[string]string
		in     *config
		want   *config
		wantOK bool
	}{
		{
			name: "detect repo and installationID",
			env: map[string]string{
				"KOKORO_GITHUB_COMMIT_URL": "https://github.com/GoogleCloudPlatform/golang-samples/commit/1234",
			},
			in: &config{
				commit:   "abc123",
				buildURL: "google.com",
			},
			want: &config{
				repo:           "GoogleCloudPlatform/golang-samples",
				installationID: "5943459",
				commit:         "abc123",
				buildURL:       "google.com",
			},
			wantOK: true,
		},
		{
			name: "detect commit",
			env: map[string]string{
				"KOKORO_GIT_COMMIT": "abc123",
			},
			in: &config{
				repo:           "GoogleCloudPlatform/golang-samples",
				installationID: "5943459",
				buildURL:       "google.com",
			},
			want: &config{
				repo:           "GoogleCloudPlatform/golang-samples",
				installationID: "5943459",
				commit:         "abc123",
				buildURL:       "google.com",
			},
			wantOK: true,
		},
		{
			name: "detect build URL",
			env: map[string]string{
				"KOKORO_BUILD_ID": "test",
			},
			in: &config{
				commit:         "abc123",
				repo:           "GoogleCloudPlatform/golang-samples",
				installationID: "5943459",
			},
			want: &config{
				repo:           "GoogleCloudPlatform/golang-samples",
				installationID: "5943459",
				commit:         "abc123",
				buildURL:       fmt.Sprintf("[Build Status](https://source.cloud.google.com/results/invocations/test), [Sponge](http://sponge2/test)"),
			},
			wantOK: true,
		},
		{
			name:   "empty config and env",
			in:     &config{},
			wantOK: false,
		},
		{
			name: "missing commit",
			in: &config{
				repo:           "repo",
				installationID: "123",
			},
			wantOK: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			buf := &bytes.Buffer{}
			log.SetOutput(buf)
			defer log.SetOutput(os.Stderr)
			for k, v := range test.env {
				os.Setenv(k, v)
				defer os.Unsetenv(k)
			}
			cfg := test.in
			if ok := cfg.setDefaults(); ok != test.wantOK {
				t.Fatalf("setDefaults got ok=%v, want ok=%v:\n%v", ok, test.wantOK, buf.String())
			}
			if !test.wantOK {
				return
			}
			if diff := cmp.Diff(cfg, test.want, cmp.AllowUnexported(config{})); diff != "" {
				t.Errorf("newConfig got %+v, want %+v. Diff (+want, -got):\n%s", cfg, test.want, diff)
			}
		})
	}
}

func TestDetectRepo(t *testing.T) {
	log.SetOutput(ioutil.Discard)
	defer log.SetOutput(os.Stderr)
	tests := []struct {
		envVar   string
		envValue string
		want     string
	}{
		{
			envVar:   "KOKORO_GITHUB_COMMIT_URL",
			envValue: "https://github.com/GoogleCloudPlatform/golang-samples/commit/1234",
			want:     "GoogleCloudPlatform/golang-samples",
		},
		{
			envVar:   "KOKORO_GITHUB_PULL_REQUEST_URL",
			envValue: "https://github.com/GoogleCloudPlatform/golang-samples/pull/1312",
			want:     "GoogleCloudPlatform/golang-samples",
		},
		{
			envVar:   "KOKORO_GITHUB_COMMIT_URL",
			envValue: "https://github.com/GoogleCloudPlatform",
			want:     "",
		},
		{
			envVar:   "foo",
			envValue: "bar",
			want:     "",
		},
	}

	for _, test := range tests {
		os.Setenv(test.envVar, test.envValue)
		if got := detectRepo(); got != test.want {
			t.Errorf("detectRepo(%s=%s) = %q, want %q", test.envVar, test.envValue, got, test.want)
		}
		os.Unsetenv(test.envVar)
	}
}

func TestDetectInstallationID(t *testing.T) {
	tests := []struct {
		repo string
		want string
	}{
		{
			repo: "GoogleCloudPlatform/golang-samples",
			want: "5943459",
		},
		{
			repo: "googleapis/google-cloud-go",
			want: "6370238",
		},
		{
			repo: "unknown",
		},
		{
			repo: "",
		},
	}

	for _, test := range tests {
		if got := detectInstallationID(test.repo); got != test.want {
			t.Errorf("detectInstallationID(%q) = %q, want %q", test.repo, got, test.want)
		}
	}
}

func TestJSONMarshalMessage(t *testing.T) {
	msg := &message{
		Name:         "flakybot",
		Type:         "function",
		Location:     "us-central1",
		Installation: githubInstallation{ID: "123"},
		Repo:         "MyOrg/test-repo",
		Commit:       "456",
		BuildURL:     "example.com",
		XUnitXML:     "<xml></xml>",
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}
	got := &message{}
	if err := json.Unmarshal(data, got); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if diff := cmp.Diff(msg, got); diff != "" {
		t.Fatalf("JSON Marshal -> Unmarshal got diff:\n%v", diff)
	}
}

type fakePublisher struct {
	called []string
}

func (p *fakePublisher) publish(_ context.Context, msg *pubsub.Message) (serverID string, err error) {
	p.called = append(p.called, string(msg.Data))
	return "", nil
}

func TestProcessLog(t *testing.T) {
	filesToCreate := []string{"sponge_log.xml", "hello/sponge_log.xml", "unused.txt"}

	tmpdir, err := os.MkdirTemp(os.TempDir(), "flakybot-")
	if err != nil {
		t.Fatalf("os.MkdirTemp: %v", err)
	}

	content := []byte("unused")
	wantEnc := base64.StdEncoding.EncodeToString(content)

	for _, f := range filesToCreate {
		f = filepath.Join(tmpdir, f)
		dir := filepath.Dir(f)
		if err := os.MkdirAll(dir, 0777); err != nil && err != os.ErrExist {
			t.Fatalf("os.MkdirAll: %v", err)
		}
		if err := os.WriteFile(f, content, 0644); err != nil {
			t.Fatalf("os.WriteFile: %v", err)
		}
	}

	cfg := &config{
		installationID: "installation-id",
		repo:           "googleapis/repo-automation-bogs",
		commit:         "abc123",
		buildURL:       "https://google.com",
	}

	p := &fakePublisher{}

	if err := filepath.WalkDir(tmpdir, processLog(context.Background(), cfg, p)); err != nil {
		t.Fatalf("Error publishing logs: %v", err)
	}

	if got := len(p.called); got != 2 {
		t.Errorf("processLog called %d times, want %d", got, 2)
	}
	for _, got := range p.called {
		if !strings.Contains(got, wantEnc) {
			t.Errorf("processLog published message %v, want to contain %q", got, wantEnc)
		}
	}
}
