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
	"encoding/json"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestDetectRepo(t *testing.T) {
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
		Name:         "buildcop",
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
