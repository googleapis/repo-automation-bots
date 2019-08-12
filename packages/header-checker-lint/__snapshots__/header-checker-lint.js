exports['HeaderCheckerLint opened pull request sets a "failure" context on PR, if new source file is missing license 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "oauth2_http/java/com/google/auth/http/TestFile.java is missing a valid license header."
  }
}

exports['HeaderCheckerLint opened pull request sets a "failure" context on PR, if a modified source file is missing license 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "oauth2_http/java/com/google/auth/http/TestFile.java is missing a valid license header."
  }
}

exports['HeaderCheckerLint opened pull request sets a "failure" context on PR, if the new source file is added and has wrong year 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "oauth2_http/java/com/google/auth/http/WrongYear.java should have a copyright year of 2019"
  }
}

exports['HeaderCheckerLint updated pull request sets a "failure" context on PR, if new source file is missing license 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "oauth2_http/java/com/google/auth/http/TestFile.java is missing a valid license header."
  }
}

exports['HeaderCheckerLint updated pull request sets a "failure" context on PR, if a modified source file is missing license 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "oauth2_http/java/com/google/auth/http/TestFile.java is missing a valid license header."
  }
}

exports['HeaderCheckerLint updated pull request sets a "failure" context on PR, if the new source file is added and has wrong year 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "oauth2_http/java/com/google/auth/http/WrongYear.java should have a copyright year of 2019"
  }
}

exports['HeaderCheckerLint opened pull request ignores a valid license 1'] = {
  "name": "header-check",
  "conclusion": "success",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c"
}

exports['HeaderCheckerLint updated pull request ignores a valid license 1'] = {
  "name": "header-check",
  "conclusion": "success",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c"
}
