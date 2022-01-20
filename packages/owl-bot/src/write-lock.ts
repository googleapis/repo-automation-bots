// Copyright 2022 Google LLC
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

/**
 * Adds a copyright statement and a comment with the docker image's timestamp
 * to the text of an .OwlBot.lock.yaml file.
 */
export function adornOwlBotLockText(
  text: string,
  dockerImageTimestamp: string
): string {
  const year = new Date().getFullYear();
  let trailer = '';
  if (dockerImageTimestamp) {
    const separator = text.endsWith('\n') ? '' : '\n';
    trailer = `${separator}# created: ${dockerImageTimestamp}\n`;
  }
  return (
    `# Copyright ${year} Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
` +
    text +
    trailer
  );
}
