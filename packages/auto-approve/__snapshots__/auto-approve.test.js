exports['auto-approve main auto-approve function config does not exist on main branch attempts to create a failing status check if PR contains wrong config, and error messages check out 1'] = {
  "head_sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
  "name": "Auto-approve.yml check",
  "conclusion": "failure",
  "output": {
    "title": "Auto-approve.yml check",
    "summary": "auto-approve.yml config check failed",
    "text": "See the following errors in your auto-approve.yml config:\n[{\"wrongProperty\":\"wrongProperty\",\"message\":\"message\"}]\n"
  }
}
