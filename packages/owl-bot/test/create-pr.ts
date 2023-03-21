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

import {describe, it} from 'mocha';
import * as assert from 'assert';
import {
  EMPTY_REGENERATE_CHECKBOX_TEXT,
  insertApiName,
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
  resplit,
  WithRegenerateCheckbox,
  prependCommitMessage,
  WithNestedCommitDelimiters,
} from '../src/create-pr';

const loremIpsum =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';

describe('resplit', () => {
  it('leaves a short title unchanged', () => {
    const tb = resplit('title\nbody\n', WithRegenerateCheckbox.No);
    assert.deepStrictEqual(tb, {title: 'title', body: 'body\n'});
  });

  it('leaves a short title unchanged with checkbox', () => {
    const tb = resplit('title\nbody\n', WithRegenerateCheckbox.Yes);
    assert.deepStrictEqual(tb, {
      title: 'title',
      body: EMPTY_REGENERATE_CHECKBOX_TEXT + '\n\nbody\n',
    });
  });

  it('resplits a long title', () => {
    const tb = resplit(loremIpsum + '\n\nbody', WithRegenerateCheckbox.No);
    assert.strictEqual(tb.title.length, MAX_TITLE_LENGTH);
    assert.ok(tb.title.length < loremIpsum.length);
    assert.deepStrictEqual(tb, {
      body: 'r in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\nbody',
      title:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolo...',
    });
  });

  it('resplits a long title with checkbox', () => {
    const tb = resplit(loremIpsum + '\n\nbody', WithRegenerateCheckbox.Yes);
    assert.strictEqual(tb.title.length, MAX_TITLE_LENGTH);
    assert.ok(tb.title.length < loremIpsum.length);
    assert.deepStrictEqual(tb, {
      body:
        EMPTY_REGENERATE_CHECKBOX_TEXT +
        '\n\nr in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\nbody',
      title:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolo...',
    });
  });

  it('truncates a long title and a long body', () => {
    const body = loremIpsum.repeat(64 * 4);
    const tb = resplit(loremIpsum + body, WithRegenerateCheckbox.No);
    assert.strictEqual(tb.title.length, MAX_TITLE_LENGTH);
    assert.strictEqual(tb.body.length, MAX_BODY_LENGTH);
    assert.ok(tb.body.length < body.length);
  });

  it('truncates a long title and a long body with checkbox', () => {
    const body = loremIpsum.repeat(64 * 4);
    const tb = resplit(loremIpsum + body, WithRegenerateCheckbox.Yes);
    assert.strictEqual(tb.title.length, MAX_TITLE_LENGTH);
    assert.strictEqual(tb.body.length, MAX_BODY_LENGTH);
    assert.ok(tb.body.length < body.length);
  });

  it('truncates a long body', () => {
    const body = loremIpsum.repeat(64 * 4);
    const tb = resplit('title\n' + body, WithRegenerateCheckbox.No);
    assert.strictEqual(tb.title, 'title');
    assert.strictEqual(tb.body.length, MAX_BODY_LENGTH);
    assert.ok(tb.body.length < body.length);
  });

  it('truncates a long body with checkbox', () => {
    const body = loremIpsum.repeat(64 * 4);
    const tb = resplit('title\n' + body, WithRegenerateCheckbox.Yes);
    assert.strictEqual(tb.title, 'title');
    assert.strictEqual(tb.body.length, MAX_BODY_LENGTH);
    assert.ok(tb.body.length < body.length);
  });
});

describe('prependCommitMessage', () => {
  describe('with checkbox', () => {
    describe('with nested delimiters', () => {
      it('handles an initial pull request content', () => {
        const pullContent = resplit(
          'feat: some feature\n\nadditional context',
          WithRegenerateCheckbox.Yes
        );
        const prependedContent = prependCommitMessage(
          'fix: some new feature\n\nmore additional context',
          pullContent,
          WithRegenerateCheckbox.Yes,
          WithNestedCommitDelimiters.Yes
        );
        assert.strictEqual(prependedContent.title, 'fix: some new feature');
        assert.strictEqual(
          prependedContent.body,
          `- [ ] Regenerate this pull request now.

more additional context

BEGIN_NESTED_COMMIT
feat: some feature
additional context
END_NESTED_COMMIT`
        );
      });

      it('handles an initial pull request with long title', () => {
        const pullContent = resplit(loremIpsum, WithRegenerateCheckbox.Yes);
        const prependedContent = prependCommitMessage(
          'fix: some new feature\n\nmore additional context',
          pullContent,
          WithRegenerateCheckbox.Yes,
          WithNestedCommitDelimiters.Yes
        );
        assert.strictEqual(prependedContent.title, 'fix: some new feature');
        assert.strictEqual(
          prependedContent.body,
          `- [ ] Regenerate this pull request now.

more additional context

BEGIN_NESTED_COMMIT
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
END_NESTED_COMMIT`
        );
      });

      it('handles pull request already updated', () => {
        const pullContent = resplit(
          'feat: some feature\n\nadditional context',
          WithRegenerateCheckbox.Yes
        );
        const prependedContent = prependCommitMessage(
          'fix: some new feature\n\nmore additional context',
          pullContent,
          WithRegenerateCheckbox.Yes,
          WithNestedCommitDelimiters.Yes
        );
        const prependedContent2 = prependCommitMessage(
          'fix: another new feature\n\nfurther context',
          prependedContent,
          WithRegenerateCheckbox.Yes,
          WithNestedCommitDelimiters.Yes
        );
        assert.strictEqual(prependedContent2.title, 'fix: another new feature');
        assert.strictEqual(
          prependedContent2.body,
          `- [ ] Regenerate this pull request now.

further context

BEGIN_NESTED_COMMIT
fix: some new feature
more additional context
END_NESTED_COMMIT
BEGIN_NESTED_COMMIT
feat: some feature
additional context
END_NESTED_COMMIT`
        );
      });
      it('handles pull request already updated twice', () => {
        const pullContent = resplit(
          'feat: some feature\n\nadditional context',
          WithRegenerateCheckbox.Yes
        );
        const prependedContent = prependCommitMessage(
          'fix: some new feature\n\nmore additional context',
          pullContent,
          WithRegenerateCheckbox.Yes,
          WithNestedCommitDelimiters.Yes
        );
        const prependedContent2 = prependCommitMessage(
          'fix: another new feature\n\nfurther context',
          prependedContent,
          WithRegenerateCheckbox.Yes,
          WithNestedCommitDelimiters.Yes
        );
        const prependedContent3 = prependCommitMessage(
          'fix: yet another new feature\n\neven further context',
          prependedContent2,
          WithRegenerateCheckbox.Yes,
          WithNestedCommitDelimiters.Yes
        );
        assert.strictEqual(
          prependedContent3.title,
          'fix: yet another new feature'
        );
        assert.strictEqual(
          prependedContent3.body,
          `- [ ] Regenerate this pull request now.

even further context

BEGIN_NESTED_COMMIT
fix: another new feature
further context
END_NESTED_COMMIT
BEGIN_NESTED_COMMIT
fix: some new feature
more additional context
END_NESTED_COMMIT
BEGIN_NESTED_COMMIT
feat: some feature
additional context
END_NESTED_COMMIT`
        );
      });
    });
    describe('without nested delimiters', () => {
      it('handles an initial pull request content', () => {
        const pullContent = resplit(
          'feat: some feature\n\nadditional context',
          WithRegenerateCheckbox.Yes
        );
        const prependedContent = prependCommitMessage(
          'fix: some new feature\n\nmore additional context',
          pullContent,
          WithRegenerateCheckbox.Yes,
          WithNestedCommitDelimiters.No
        );
        assert.strictEqual(prependedContent.title, 'fix: some new feature');
        assert.strictEqual(
          prependedContent.body,
          `- [ ] Regenerate this pull request now.

more additional context

feat: some feature
additional context`
        );
      });

      it('handles an initial pull request with long title', () => {
        const pullContent = resplit(loremIpsum, WithRegenerateCheckbox.Yes);
        const prependedContent = prependCommitMessage(
          'fix: some new feature\n\nmore additional context',
          pullContent,
          WithRegenerateCheckbox.Yes,
          WithNestedCommitDelimiters.No
        );
        assert.strictEqual(prependedContent.title, 'fix: some new feature');
        assert.strictEqual(
          prependedContent.body,
          `- [ ] Regenerate this pull request now.

more additional context

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
        );
      });
    });
  });
  describe('without checkbox', () => {
    describe('with nested delimiters', () => {
      it('handles an initial pull request content', () => {
        const pullContent = resplit(
          'feat: some feature\n\nadditional context',
          WithRegenerateCheckbox.No
        );
        const prependedContent = prependCommitMessage(
          'fix: some new feature\n\nmore additional context',
          pullContent,
          WithRegenerateCheckbox.No,
          WithNestedCommitDelimiters.Yes
        );
        assert.strictEqual(prependedContent.title, 'fix: some new feature');
        assert.strictEqual(
          prependedContent.body,
          `more additional context

BEGIN_NESTED_COMMIT
feat: some feature
additional context
END_NESTED_COMMIT`
        );
      });

      it('handles an initial pull request with long title', () => {
        const pullContent = resplit(loremIpsum, WithRegenerateCheckbox.No);
        const prependedContent = prependCommitMessage(
          'fix: some new feature\n\nmore additional context',
          pullContent,
          WithRegenerateCheckbox.No,
          WithNestedCommitDelimiters.Yes
        );
        assert.strictEqual(prependedContent.title, 'fix: some new feature');
        assert.strictEqual(
          prependedContent.body,
          `more additional context

BEGIN_NESTED_COMMIT
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
END_NESTED_COMMIT`
        );
      });

      it('handles pull request already updated', () => {
        const pullContent = resplit(
          'feat: some feature\n\nadditional context',
          WithRegenerateCheckbox.No
        );
        const prependedContent = prependCommitMessage(
          'fix: some new feature\n\nmore additional context',
          pullContent,
          WithRegenerateCheckbox.No,
          WithNestedCommitDelimiters.Yes
        );
        const prependedContent2 = prependCommitMessage(
          'fix: another new feature\n\nfurther context',
          prependedContent,
          WithRegenerateCheckbox.No,
          WithNestedCommitDelimiters.Yes
        );
        assert.strictEqual(prependedContent2.title, 'fix: another new feature');
        assert.strictEqual(
          prependedContent2.body,
          `further context

BEGIN_NESTED_COMMIT
fix: some new feature
more additional context
END_NESTED_COMMIT
BEGIN_NESTED_COMMIT
feat: some feature
additional context
END_NESTED_COMMIT`
        );
      });
    });
    describe('without nested delimiters', () => {
      it('handles an initial pull request content', () => {
        const pullContent = resplit(
          'feat: some feature\n\nadditional context',
          WithRegenerateCheckbox.No
        );
        const prependedContent = prependCommitMessage(
          'fix: some new feature\n\nmore additional context',
          pullContent,
          WithRegenerateCheckbox.No,
          WithNestedCommitDelimiters.No
        );
        assert.strictEqual(prependedContent.title, 'fix: some new feature');
        assert.strictEqual(
          prependedContent.body,
          `more additional context

feat: some feature
additional context`
        );
      });

      it('handles an initial pull request with long title', () => {
        const pullContent = resplit(loremIpsum, WithRegenerateCheckbox.No);
        const prependedContent = prependCommitMessage(
          'fix: some new feature\n\nmore additional context',
          pullContent,
          WithRegenerateCheckbox.No,
          WithNestedCommitDelimiters.No
        );
        assert.strictEqual(prependedContent.title, 'fix: some new feature');
        assert.strictEqual(
          prependedContent.body,
          `more additional context

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
        );
      });
    });
  });
});

describe('insertApiName', () => {
  it('does nothing when the api name is empty', () => {
    const title = 'chore(bazel): Update gapic-generator-php to v1.2.1';
    const newTitle = insertApiName(title, '');
    assert.deepStrictEqual(newTitle, title);
  });

  it('inserts the api name after the colon.', () => {
    const title = 'chore(bazel): Update gapic-generator-php to v1.2.1';
    const newTitle = insertApiName(title, 'Billing');
    assert.deepStrictEqual(
      newTitle,
      'chore(bazel): [Billing] Update gapic-generator-php to v1.2.1'
    );
  });

  it("inserts the api name at the beginning when there's no colon.", () => {
    const title = 'chore(bazel) Update gapic-generator-php to v1.2.1';
    const newTitle = insertApiName(title, 'Billing');
    assert.deepStrictEqual(
      newTitle,
      '[Billing] chore(bazel) Update gapic-generator-php to v1.2.1'
    );
  });

  it('ignores a colon after a newline.', () => {
    const title = 'chore(bazel)\n: Update gapic-generator-php to v1.2.1';
    const newTitle = insertApiName(title, 'Billing');
    assert.deepStrictEqual(
      newTitle,
      '[Billing] chore(bazel)\n: Update gapic-generator-php to v1.2.1'
    );
  });

  it('ignores a colon after 40 characters', () => {
    const title = 'chore(bazel) Update gapic-generator-php to v1.2.1 : colon';
    const newTitle = insertApiName(title, 'Billing');
    assert.deepStrictEqual(
      newTitle,
      '[Billing] chore(bazel) Update gapic-generator-php to v1.2.1 : colon'
    );
  });
});
