// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Minimally implements the docker protocol defined here:
// https://docs.docker.com/registry/spec/api

import fetch from 'node-fetch';

interface Manifest {
  config: {
    digest: string;
  };
}

export interface Config {
  created: string; // A timestamp.
}

/**
 * Fetches a docker config for a given docker image.
 *
 * @param dockerUri something like 'gcr.io/cloud-devrel-public-resources/owlbot-nodejs'
 * @param digest something like 'sha256:bbb8dd6576ac58830a07fc17e9511ae898be44f2219d3344449b125df9854441'
 */
export async function fetchConfig(
  dockerUri: string,
  digest: string
): Promise<Config> {
  const firstSlash = dockerUri.indexOf('/');
  const host = dockerUri.slice(0, firstSlash);
  const image = dockerUri.slice(firstSlash + 1);
  const manifestUri = `https://${host}/v2/${image}/manifests/${digest}`;
  console.info(`fetching ${manifestUri}`);
  const manifest = (await (await fetch(manifestUri)).json()) as Manifest;
  const configDigest: string = manifest.config.digest;
  const configUri = `https://${host}/v2/${image}/blobs/${configDigest}`;
  console.info(`fetching ${configUri}`);
  return (await (await fetch(configUri)).json()) as Config;
}
