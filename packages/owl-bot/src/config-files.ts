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

// The .github/.OwlBot.lock.yaml is stored on each repository that OwlBot
// is configured for, and indicates the docker container that should be run
// for post processing:
export interface OwlBotLock {
  docker: {
    image: string;
    digest: string;
  };
}

// The default path where .OwlBot.lock.yaml is expected to be found.
export const owlBotLockPath = '.github/.OwlBot.lock.yaml';

// Throws an exception if the object does not have the necessary structure.
// Otherwise, returns the same object as an OwlBotLock.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function owlBotLockFrom(o: Record<string, any>): OwlBotLock {
  if (typeof o.docker !== 'object') {
    throw Error('lock file did not contain "docker" key');
  }
  if (typeof o.docker.image !== 'string') {
    throw Error('docker.image was not a string');
  }
  if (typeof o.docker.digest !== 'string') {
    throw Error('docker.digest was not a string');
  }
  return o as OwlBotLock;
}
