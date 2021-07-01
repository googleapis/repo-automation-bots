exports['ConventionalCommitLint sets a "failure" context on PR, if commits fail linting 1'] = {
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e",
  "conclusion": "failure",
  "name": "conventionalcommits.org",
  "output": {
    "title": "Commit message did not follow Conventional Commits",
    "summary": "Some of your commit messages failed linting.\n\nVisit [conventionalcommits.org](https://conventionalcommits.org) to learn our conventions.\n\nRun `git commit --amend` and edit your message to match Conventional Commit guidelines.",
    "text": ":x: linting errors for \"*fix all the bugs*\"\n* subject may not be empty\n* type may not be empty\n\n\n"
  }
}

exports['ConventionalCommitLint sets a "success" context on PR, if commit lint succeeds 1'] = {
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
    "summary": "Some of your commit messages failed linting.\n\nVisit [conventionalcommits.org](https://conventionalcommits.org) to learn our conventions.\n\nedit your pull request title to match Conventional Commit guidelines.",
    "text": ":x: linting errors for \"*this is not a conventional commit*\"\n* subject may not be empty\n* type may not be empty\n\n\n"
  }
}

exports['ConventionalCommitLint PR With Multiple Commits has a valid title, invalid commit, automerge label 1'] = {
  "name": "conventionalcommits.org",
  "conclusion": "success",
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e"
}

exports['ConventionalCommitLint sets a "success" context on PR, if the body is less than 256 in length 1'] = {
  "name": "conventionalcommits.org",
  "conclusion": "success",
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e"
}

exports['ConventionalCommitLint sets a "success" context on PR, if the footer is less than 256 in length 1'] = {
  "name": "conventionalcommits.org",
  "conclusion": "success",
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e"
}

exports['ConventionalCommitLint sets a "success" context on PR, if subject contains a full stop 1'] = {
  "name": "conventionalcommits.org",
  "conclusion": "success",
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e"
}
