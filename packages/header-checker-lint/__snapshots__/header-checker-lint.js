/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
    "text": "`oauth2_http/java/com/google/auth/http/WrongYear.java` should have a copyright year of 2019"
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
    "text": "`oauth2_http/java/com/google/auth/http/WrongYear.java` should have a copyright year of 2019"
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
    "text": "`oauth2_http/java/com/google/auth/http/InvalidCopyright.java` has an invalid copyright holder: `Invalid Holder`"
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
  "head_sha": "87139750cdcf551e8fe8d90c129527a4f358321c"
}
