exports['ConventionalCommitLint sets a "success" context on PR, if commit lint succeeds 1'] = {
  "name": "conventionalcommits.org",
  "conclusion": "success",
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e"
}

exports['ConventionalCommitLint sets a "failure" context on PR, if commits fail linting 1'] = {
  "head_sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e",
  "conclusion": "failure",
  "name": "conventionalcommits.org",
  "output": {
    "title": "Commit message did not follow Conventional Commits",
    "summary": "Some of your commit messages failed linting.\n\nVisit [conventionalcommits.org](https://conventionalcommits.org) to learn our conventions.\n\nRun `git reset --soft HEAD~1 && git commit .` to amend your message.",
    "text": ":x: linting errors for \"*Fix all the bugs*\"\n* subject may not be empty\n* type may not be empty\n\n\n"
  }
}
