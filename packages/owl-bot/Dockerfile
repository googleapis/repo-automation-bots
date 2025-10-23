# Copyright 2021 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# The Dockerfile for owlbot-cli

# Use the official lightweight Node.js image.
# https://hub.docker.com/_/node
FROM node:22-alpine

# Remove unnecessary cross-spawn from npm to resolve CVE-2024-21538
RUN rm -r /usr/local/lib/node_modules/npm/node_modules/cross-spawn/

# Bump the heap size
ENV NODE_OPTIONS='--max-old-space-size=8192'

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy local code to the container image.
COPY . ./

# Install git
RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh

# Install production dependencies.
# If you add a package-lock.json, speed your build by switching to 'npm ci'.
# RUN npm ci --only=production
RUN npm install && \
    npm run compile

# Make sure users besides root can run the app.
RUN chmod a+rx -R .

# Run the web service on container startup.
ENTRYPOINT ["/usr/src/app/build/src/bin/owl-bot.js"]
