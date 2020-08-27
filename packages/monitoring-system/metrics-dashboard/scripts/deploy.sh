# build and deploy the dashboard from a fresh clone

set -eo pipefail  # fail-fast and don't mask errors

# check token was passed in args
if [[ $# -ne 1 ]]
then
  echo "Usage $0 <path-to-token-file>"
  exit 1
fi

# compile
npm install
npm run compile

# deploy to Firebase
firebase deploy --token '$(cat $1)'