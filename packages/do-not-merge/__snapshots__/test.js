exports['do-not-merge responds to events creates failed check when label added 1'] = {
  "conclusion": "failure",
  "name": "Do Not Merge",
  "head_sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
  "output": {
    "title": "Remove the do not merge label before merging",
    "summary": "Remove the do not merge label before merging"
  }
}

exports['do-not-merge responds to events updates check to pass after label removed 1'] = {
  "conclusion": "success",
  "output": {
    "title": "OK to merge, label not found",
    "summary": "OK to merge, label not found"
  }
}

exports['do-not-merge responds to events updates check to failure after label re-added 1'] = {
  "conclusion": "failure",
  "output": {
    "title": "Remove the do not merge label before merging",
    "summary": "Remove the do not merge label before merging"
  }
}

exports['do-not-merge responds to events creates failed check when alternative label added 1'] = {
  "conclusion": "failure",
  "name": "Do Not Merge",
  "head_sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
  "output": {
    "title": "Remove the do not merge label before merging",
    "summary": "Remove the do not merge label before merging"
  }
}

exports['do-not-merge responds to events creates passing check if configured to always add check 1'] = {
  "conclusion": "success",
  "name": "Do Not Merge",
  "head_sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
  "output": {
    "title": "OK to merge, label not found",
    "summary": "OK to merge, label not found"
  }
}
