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

# Stage 0: Node.js Base Image
FROM marketplace.gcr.io/google/debian12:latest AS BASE

# Install Node.js v18 and npm.
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Remove unnecessary cross-spawn from npm to resolve CVE-2024-21538
RUN rm -rf /usr/lib/node_modules/npm/node_modules/cross-spawn/

# Install pyenv dependencies
RUN apt-get update && \
    apt-get install -y make build-essential libssl-dev zlib1g-dev libbz2-dev \
    libreadline-dev libsqlite3-dev wget curl llvm libncurses5-dev libncursesw5-dev \
    xz-utils tk-dev libffi-dev liblzma-dev && \
    apt-get upgrade -y

WORKDIR /root

# Install pyenv
RUN curl -L -o /tmp/pyenv.tar.gz https://github.com/pyenv/pyenv/archive/refs/tags/v2.6.3.tar.gz && \
    mkdir -p /root/.pyenv && \
    tar -xzvf /tmp/pyenv.tar.gz -C /root/.pyenv --strip-components=1 && \
    echo 'eval "$(pyenv init -)"' >> /root/.profile && \
    echo 'eval "$(pyenv virtualenv-init -)"' >> /root/.profile

ENV PATH="/root/.pyenv/bin:/root/.pyenv/shims:${PATH}"

# Install python
RUN pyenv install 3.13.11 && \
    pyenv global 3.13.11 && \
    python3 -m pip install --upgrade pip setuptools

FROM BASE AS BUILD

WORKDIR /home/root

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

WORKDIR /home/root

COPY package*.json ./
COPY --from=BUILD /home/root/build build
COPY requirements.txt ./
RUN npm ci --only=production && \
    python3 -m pip install --require-hashes -r requirements.txt

ENV NODE_ENV "production"

# Run the web service on container startup.
CMD [ "npm", "--no-update-notifier", "run", "start" ]
