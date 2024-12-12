exports['ConventionalCommitLint sets a "failure" context on PR, if commits fail linting 1'] = {
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e",
  "conclusion": "failure",
  "name": "conventionalcommits.org",
  "output": {
    "title": "Commit message did not follow Conventional Commits",
    "summary": "Some of your commit messages failed linting.\n\nVisit [conventionalcommits.org](https://conventionalcommits.org) to learn our conventions.\n\nRun `git commit --amend` and edit your message to match Conventional Commit guidelines.",
    "text": ":x: The following linting errors found:\n* subject may not be empty\n* type may not be empty\nfor the following input:\n\"*fix all the bugs*\"\n\n"
  }
}

exports['ConventionalCommitLint sets a "success" context on PR, if commit lint succeeds 1'] = {
  "name": "conventionalcommits.org",
  "conclusion": "success",
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e"
}

exports['ConventionalCommitLint sets a "success" context on PR, if subject contains a full stop 1'] = {
  "name": "conventionalcommits.org",
  "conclusion": "success",
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e"
}

exports['ConventionalCommitLint PR With Multiple Commits has a valid pull request title 1'] = {
  "name": "conventionalcommits.org",
  "conclusion": "success",
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e"
}

exports['ConventionalCommitLint PR With Multiple Commits has an invalid pull request title 1'] = {
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e",
  "conclusion": "failure",
  "name": "conventionalcommits.org",
  "output": {
    "title": "Commit message did not follow Conventional Commits",
    "summary": "The PR title failed linting.\n\nVisit [conventionalcommits.org](https://conventionalcommits.org) to learn our conventions.\n\nedit your pull request title to match Conventional Commit guidelines.",
    "text": ":x: The following linting errors found:\n* subject may not be empty\n* type may not be empty\nfor the following input:\n\"*this is not a conventional commit*\"\n\n"
  }
}

exports['ConventionalCommitLint PR With Multiple Commits has a valid title, invalid commit, automerge label 1'] = {
  "name": "conventionalcommits.org",
  "conclusion": "success",
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e"
}

exports['ConventionalCommitLint PR With Multiple Commits has a valid title, invalid commit, automerge enabled 1'] = {
  "name": "conventionalcommits.org",
  "conclusion": "success",
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e"
}

exports['ConventionalCommitLint sets a "success" context on PR with very long lines 1'] = {
  "name": "conventionalcommits.org",
  "conclusion": "success",
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e"
}

exports['ConventionalCommitLint PR With Multiple Commits has a valid title, invalid commit, automerge: exact label 1'] = {
  "name": "conventionalcommits.org",
  "conclusion": "success",
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e"
}

exports['ConventionalCommitLint adds an additional check when the commit message and the PR title differ 1'] = {
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e",
  "conclusion": "failure",
  "output": {
    "title": "PR title does not match commit message",
    "summary": "🤖 I detect that the PR title and the commit message differ and there's only one commit. To use the PR title for the commit history, you can use Github's automerge feature with squashing, or use `automerge` label. Good luck human!\n\n -- conventional-commit-lint bot\nhttps://conventionalcommits.org/",
    "text": "🤖 I detect that the PR title and the commit message differ and there's only one commit. To use the PR title for the commit history, you can use Github's automerge feature with squashing, or use `automerge` label. Good luck human!\n\n -- conventional-commit-lint bot\nhttps://conventionalcommits.org/"
  }
}

exports['ConventionalCommitLint adds an additional check when the commit message and the PR title differ 2'] = {
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e",
  "conclusion": "failure",
  "name": "conventionalcommits.org",
  "output": {
    "title": "Commit message did not follow Conventional Commits",
    "summary": "Some of your commit messages failed linting.\n\nVisit [conventionalcommits.org](https://conventionalcommits.org) to learn our conventions.\n\nRun `git commit --amend` and edit your message to match Conventional Commit guidelines.",
    "text": ":x: The following linting errors found:\n* subject may not be empty\n* type may not be empty\nfor the following input:\n\"*fix all the bugs*\"\n\n"
  }
}
