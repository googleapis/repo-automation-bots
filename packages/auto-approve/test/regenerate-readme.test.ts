import {RegenerateReadme} from '../src/process-checks/regenerate-readme';
import {describe, it} from 'mocha';
import assert from 'assert';

describe('behavior of RegenerateReadme process', () => {
  it('should get constructed with the appropriate values', () => {
    const regenerateReadme = new RegenerateReadme(
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
        author: 'yoshi-automation',
        titleRegex: /^chore: regenerate README$/,
        maxFiles: 2,
        fileNameRegex: [
          /^README.md$/,
          /\.github\/readme\/synth.metadata\/synth\.metadata$/,
        ],
      },
    };

    assert.deepStrictEqual(regenerateReadme.incomingPR, expectation.incomingPR);
    assert.deepStrictEqual(regenerateReadme.classRule, expectation.classRule);
  });

  it('should return false in checkPR if incoming PR does not match classRules', () => {
    const regenerateReadme = new RegenerateReadme(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1
    );

    assert.deepStrictEqual(regenerateReadme.checkPR(), false);
  });

  it('should return true in checkPR if incoming PR does match classRules', () => {
    const regenerateReadme = new RegenerateReadme(
      'yoshi-automation',
      'chore: regenerate README',
      2,
      [
        {
          filename: 'README.md',
          sha: '2345',
        },
      ],
      'testRepoName',
      'testRepoOwner',
      1
    );

    assert.ok(regenerateReadme.checkPR());
  });
});
