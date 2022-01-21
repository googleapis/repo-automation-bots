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

import * as assert from 'assert';
import {describe, it} from 'mocha';
import {parseOwlBotLock} from '../src';
import {adornOwlBotLockText} from '../src/write-lock';

const lockYaml = `docker:
  image: gcr.io/cloud-devrel-public-resources/owlbot-nodejs:latest
  digest: sha256:2d850512335d7adca3a4b08e02f8e63192978aea88c042dacb3e382aa996ae7c`;

describe('scanGoogleapisGenAndCreatePullRequests', () => {
  const year = new Date().getFullYear();

  it('works', () => {
    const adorned = adornOwlBotLockText(lockYaml, '');
    assert.strictEqual(
      adorned,
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
docker:
  image: gcr.io/cloud-devrel-public-resources/owlbot-nodejs:latest
  digest: sha256:2d850512335d7adca3a4b08e02f8e63192978aea88c042dacb3e382aa996ae7c`
    );
  });

  it('adds a timestamp', () => {
    const adorned = adornOwlBotLockText(lockYaml, '2022-01-18 14:30:12');
    assert.strictEqual(
      adorned,
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
docker:
  image: gcr.io/cloud-devrel-public-resources/owlbot-nodejs:latest
  digest: sha256:2d850512335d7adca3a4b08e02f8e63192978aea88c042dacb3e382aa996ae7c
# created: 2022-01-18 14:30:12
`
    );
  });

  it('ignores newline', () => {
    const adorned = adornOwlBotLockText(lockYaml + '\n', '2022-01-18 14:30:12');
    assert.strictEqual(
      adorned,
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
docker:
  image: gcr.io/cloud-devrel-public-resources/owlbot-nodejs:latest
  digest: sha256:2d850512335d7adca3a4b08e02f8e63192978aea88c042dacb3e382aa996ae7c
# created: 2022-01-18 14:30:12
`
    );
    assert.deepStrictEqual(parseOwlBotLock(adorned), {
      docker: {
        image: 'gcr.io/cloud-devrel-public-resources/owlbot-nodejs:latest',
        digest:
          'sha256:2d850512335d7adca3a4b08e02f8e63192978aea88c042dacb3e382aa996ae7c',
      },
    });
  });
});
