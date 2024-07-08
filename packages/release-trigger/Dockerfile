# Copyright 2021 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Use a multi-stage docker build to limit production dependencies.

FROM node:18.20.3-bullseye AS BASE

USER node

# Install pyenv dependencies
RUN apt-get install -y make build-essential libssl-dev zlib1g-dev libbz2-dev \
    libreadline-dev libsqlite3-dev wget curl llvm libncurses5-dev libncursesw5-dev \
    xz-utils tk-dev libffi-dev liblzma-dev python-openssl

# Install pyenv
RUN git clone https://github.com/pyenv/pyenv.git ~/.pyenv && \
    echo 'export PATH="/home/node/.pyenv/bin:$PATH"' >> ~/.profile && \
    echo 'export PATH="/home/node/.pyenv/shims:$PATH"' >> ~/.profile && \
    echo 'eval "$(pyenv init -)"' >> ~/.profile && \
    echo 'eval "$(pyenv virtualenv-init -)"' >> ~/.profile

ENV PATH="/home/node/.pyenv/bin:/home/node/.pyenv/shims:${PATH}"

# Install python
RUN pyenv install 3.10.13 && \
    pyenv global 3.10.13 && \
    python3 -m pip install --upgrade pip setuptools

# Use the Yoshi Node.js 14 image - it has python3 installed
# https://github.com/googleapis/testing-infra-docker/tree/master/node/14-user
FROM BASE AS BUILD

WORKDIR /home/node

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure copying both package.json AND package-lock.json (when available).
# Copying this first prevents re-running npm install on every code change.
COPY package*.json ./

# Install build dependencies.
RUN npm ci

# Now copy all the code so we can compile
COPY . ./

RUN npm run compile

FROM BASE

WORKDIR /home/node

COPY package*.json ./
COPY --from=BUILD /home/node/build build
COPY requirements.txt ./
RUN npm ci --only=production && \
    python3 -m pip install --require-hashes -r requirements.txt

ENV NODE_ENV "production"

# Run the web service on container startup.
CMD [ "npm", "--no-update-notifier", "run", "start" ]
