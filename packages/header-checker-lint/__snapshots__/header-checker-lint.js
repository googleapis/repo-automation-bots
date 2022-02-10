exports['HeaderCheckerLint opened pull request sets a "failure" context on PR, if new source file is missing license 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "`oauth2_http/java/com/google/auth/http/TestFile.java` is missing a valid license header."
  }
}

exports['HeaderCheckerLint opened pull request sets a "failure" context on PR, if a modified source file is missing license 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "`oauth2_http/java/com/google/auth/http/TestFile.java` is missing a valid license header."
  }
}

exports['HeaderCheckerLint opened pull request sets a "failure" context on PR, if the new source file is added and has wrong year 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "`oauth2_http/java/com/google/auth/http/WrongYear.java` should have a copyright year of 2022"
  }
}

exports['HeaderCheckerLint opened pull request sets a "failure" context on PR, if the source file is missing copyright 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "`oauth2_http/java/com/google/auth/http/MissingCopyright.java` is missing a valid copyright line."
  }
}

exports['HeaderCheckerLint opened pull request sets a "failure" context on PR, if the source file has an invalid copyright holder 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "`oauth2_http/java/com/google/auth/http/InvalidCopyright.java` has an invalid copyright holder: `Invalid Holder`\n`oauth2_http/java/com/google/auth/http/InvalidCopyright.java` should have a copyright year of 2022"
  }
}

exports['HeaderCheckerLint opened pull request reads a custom configuration file 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "`oauth2_http/java/com/google/auth/http/InvalidCopyright.java` should have a copyright year of 2022"
  }
}

exports['HeaderCheckerLint opened pull request ignores a valid license 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "`oauth2_http/java/com/google/auth/http/NewFile2.java` should have a copyright year of 2022"
  }
}

exports['HeaderCheckerLint opened pull request ignores an ignored files 1'] = {
  "name": "header-check",
  "conclusion": "success",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Headercheck",
    "summary": "Header check successful",
    "text": "Header check successful"
  }
}

exports['HeaderCheckerLint opened pull request ignores copyright strings in the body 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "`oauth2_http/java/com/google/auth/http/CopyrightString.java` should have a copyright year of 2022"
  }
}

exports['HeaderCheckerLint updated pull request sets a "failure" context on PR, if new source file is missing license 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "`oauth2_http/java/com/google/auth/http/TestFile.java` is missing a valid license header."
  }
}

exports['HeaderCheckerLint updated pull request sets a "failure" context on PR, if a modified source file is missing license 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "`oauth2_http/java/com/google/auth/http/TestFile.java` is missing a valid license header."
  }
}

exports['HeaderCheckerLint updated pull request sets a "failure" context on PR, if the new source file is added and has wrong year 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "`oauth2_http/java/com/google/auth/http/WrongYear.java` should have a copyright year of 2022"
  }
}

exports['HeaderCheckerLint updated pull request sets a "failure" context on PR, if the source file is missing copyright 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "`oauth2_http/java/com/google/auth/http/MissingCopyright.java` is missing a valid copyright line."
  }
}

exports['HeaderCheckerLint updated pull request sets a "success" context on PR, on modified file with invalid copyright header 1'] = {
  "name": "header-check",
  "conclusion": "success",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Headercheck",
    "summary": "Header check successful",
    "text": "Header check successful"
  }
}

exports['HeaderCheckerLint updated pull request ignores a valid license 1'] = {
  "name": "header-check",
  "conclusion": "failure",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Invalid or missing license headers detected.",
    "summary": "Some new files are missing headers",
    "text": "`oauth2_http/java/com/google/auth/http/NewFile2.java` should have a copyright year of 2022"
  }
}

exports['HeaderCheckerLint updated pull request ignores copyright strings in the body 1'] = {
  "name": "header-check",
  "conclusion": "success",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Headercheck",
    "summary": "Header check successful",
    "text": "Header check successful"
  }
}

exports['HeaderCheckerLint updated pull request ignores a deleted file 1'] = {
  "name": "header-check",
  "conclusion": "success",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Headercheck",
    "summary": "Header check successful",
    "text": "Header check successful"
  }
}

exports['HeaderCheckerLint opened pull request ignores due to the config from the PR head 1'] = {
  "name": "header-check",
  "conclusion": "success",
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c",
  "output": {
    "title": "Headercheck",
    "summary": "Header check successful",
    "text": "Header check successful"
  }
}
