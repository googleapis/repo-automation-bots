import {UpdateDiscoveryArtifacts} from '../src/process-checks/update-discovery-artifacts';
import {describe, it} from 'mocha';
import assert from 'assert';

describe('behavior of UpdateDiscoveryArtifacts process', () => {
  it('should get constructed with the appropriate values', () => {
    const updateDiscoveryArtifacts = new UpdateDiscoveryArtifacts(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1
    );

    const expectation = {
      incomingPR: {
        author: 'testAuthor',
        title: 'testTitle',
        fileCount: 3,
        changedFiles: [{filename: 'hello', sha: '2345'}],
        repoName: 'testRepoName',
        repoOwner: 'testRepoOwner',
        prNumber: 1,
      },
      classRule: {
        author: 'yoshi-code-bot',
        titleRegex: /^chore: Update discovery artifacts/,
        maxFiles: 2,
        fileNameRegex: [
          /^docs\/dyn\/index\.md$/,
          /^docs\/dyn\/.*\.html$/,
          /^googleapiclient\/discovery_cache\/documents\/.*\.json$/,
        ],
      },
    };

    assert.deepStrictEqual(
      updateDiscoveryArtifacts.incomingPR,
      expectation.incomingPR
    );
    assert.deepStrictEqual(
      updateDiscoveryArtifacts.classRule,
      expectation.classRule
    );
  });

  it('should return false in checkPR if incoming PR does not match classRules', () => {
    const updateDiscoveryArtifacts = new UpdateDiscoveryArtifacts(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1
    );

    assert.deepStrictEqual(updateDiscoveryArtifacts.checkPR(), false);
  });

  it('should return true in checkPR if incoming PR does match classRules', () => {
    const updateDiscoveryArtifacts = new UpdateDiscoveryArtifacts(
      'yoshi-code-bot',
      'chore: Update discovery artifacts',
      2,
      [
        {
          filename: 'googleapiclient/discovery_cache/documents/.testing.json',
          sha: '2345',
        },
      ],
      'testRepoName',
      'testRepoOwner',
      1
    );

    assert.ok(updateDiscoveryArtifacts.checkPR());
  });
});
