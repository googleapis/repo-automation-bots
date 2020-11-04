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
//

import * as assert from 'assert';
import {describe, it} from 'mocha';
import * as sloAppliesTo from '../src/slo-appliesTo';

describe('doesSloApply', () => {
  it('returns true if slo has no applies to rules', async () => {
    const slo = {
      appliesTo: {},
      complianceSettings: {
        resolutionTime: 0,
        responseTime: 0,
      },
    };
    const isValid = await sloAppliesTo.doesSloApply('issue', slo, null, 3);
    assert.strictEqual(isValid, true);
  });
  it('returns true if slo does not have githubLabels and no issue labels', async () => {
    const slo = {
      appliesTo: {
        excludedGitHubLabels: ['help wanted'],
      },
      complianceSettings: {
        resolutionTime: 0,
        responseTime: 0,
      },
    };
    const isValid = await sloAppliesTo.doesSloApply('issue', slo, [], 3);
    assert.strictEqual(isValid, true);
  });
  it('returns false if slo has githubLabels and no issue labels', async () => {
    const slo = {
      appliesTo: {
        gitHubLabels: ['help wanted'],
      },
      complianceSettings: {
        resolutionTime: 0,
        responseTime: 0,
      },
    };
    const isValid = await sloAppliesTo.doesSloApply('issue', slo, [], 3);
    assert.strictEqual(isValid, false);
  });
  it('returns true if type is issue and issue is undefined', async () => {
    const slo = {
      appliesTo: {
        gitHubLabels: ['help wanted'],
        prs: true,
      },
      complianceSettings: {
        resolutionTime: 0,
        responseTime: 0,
      },
    };
    const isValid = await sloAppliesTo.doesSloApply(
      'issue',
      slo,
      ['help wanted', 'p0'],
      3
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if type is pr and prs is true', async () => {
    const slo = {
      appliesTo: {
        gitHubLabels: ['help wanted'],
        issues: true,
        prs: true,
      },
      complianceSettings: {
        resolutionTime: 0,
        responseTime: 0,
      },
    };
    const isValid = await sloAppliesTo.doesSloApply(
      'pull_request',
      slo,
      ['help wanted', 'p0'],
      3
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if type is issue and issue is true', async () => {
    const slo = {
      appliesTo: {
        gitHubLabels: ['help wanted'],
        issues: true,
        prs: false,
      },
      complianceSettings: {
        resolutionTime: 0,
        responseTime: 0,
      },
    };
    const isValid = await sloAppliesTo.doesSloApply(
      'issue',
      slo,
      ['help wanted', 'p0'],
      3
    );
    assert.strictEqual(isValid, true);
  });
  it('returns false if type is pr and prs is undefined', async () => {
    const slo = {
      appliesTo: {
        gitHubLabels: ['help wanted'],
        issues: true,
      },
      complianceSettings: {
        resolutionTime: 0,
        responseTime: 0,
      },
    };
    const isValid = await sloAppliesTo.doesSloApply(
      'pull_request',
      slo,
      ['help wanted', 'p0'],
      3
    );
    assert.strictEqual(isValid, false);
  });
  it('returns false if type is issue and issue is false', async () => {
    const slo = {
      appliesTo: {
        gitHubLabels: ['help wanted'],
        issues: false,
        prs: true,
      },
      complianceSettings: {
        resolutionTime: 0,
        responseTime: 0,
      },
    };
    const isValid = await sloAppliesTo.doesSloApply(
      'issue',
      slo,
      ['help wanted', 'p0'],
      3
    );
    assert.strictEqual(isValid, false);
  });
  it('returns true if github labels is a subset of issue labels', async () => {
    const slo = {
      appliesTo: {
        gitHubLabels: ['bot:auto label', 'P0'],
      },
      complianceSettings: {
        resolutionTime: 0,
        responseTime: 0,
      },
    };
    const isValid = await sloAppliesTo.doesSloApply(
      'issue',
      slo,
      ['bot:auto label', 'P0', 'enhancement', 'help wanted'],
      3
    );
    assert.strictEqual(isValid, true);
  });
  it('returns false if github labels is not a subset of issue labels', async () => {
    const slo = {
      appliesTo: {
        gitHubLabels: ['bot:auto label', 'P1'],
      },
      complianceSettings: {
        resolutionTime: 0,
        responseTime: 0,
      },
    };
    const isValid = await sloAppliesTo.doesSloApply(
      'issue',
      slo,
      ['bot:auto label', 'P0', 'enhancement', 'help wanted'],
      3
    );
    assert.strictEqual(isValid, false);
  });
  it('returns true if no excluded github labels is in issue labels', async () => {
    const slo = {
      appliesTo: {
        excludedGitHubLabels: ['bot:comment pr', 'P1'],
      },
      complianceSettings: {
        resolutionTime: 0,
        responseTime: 0,
      },
    };
    const isValid = await sloAppliesTo.doesSloApply(
      'issue',
      slo,
      ['bot:auto label', 'P0', 'enhancement', 'help wanted'],
      3
    );
    assert.strictEqual(isValid, true);
  });
  it('returns false if some excluded github labels is in issue labels', async () => {
    const slo = {
      appliesTo: {
        excludedGitHubLabels: ['bot:comment pr', 'P1'],
      },
      complianceSettings: {
        resolutionTime: 0,
        responseTime: 0,
      },
    };
    const isValid = await sloAppliesTo.doesSloApply(
      'issue',
      slo,
      ['bot:auto label', 'enhancement', 'help wanted', 'P1'],
      3
    );
    assert.strictEqual(isValid, false);
  });
});
