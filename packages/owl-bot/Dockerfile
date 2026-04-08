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
# Stage 1: Build
FROM node:24-alpine AS builder

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy local code to the container image.
COPY . ./

# Install dependencies and compile
# Speed up build by switching to 'npm ci' since package-lock.json exists
RUN npm ci && \
    npm run compile

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Final Runtime Image
# Use the official lightweight Node.js image.
# https://hub.docker.com/_/node
FROM node:24-alpine

# Create and change to the app directory.
WORKDIR /usr/src/app

# Install git and bash (needed by owl-bot)
RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh

# Copy built files and production node_modules from builder
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json

# Remove npm and npx to fix CVEs in bundled dependencies and reduce attack surface
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx

# Bump the heap size
ENV NODE_OPTIONS='--max-old-space-size=8192'

# Make sure users besides root can run the app.
RUN chmod a+rx -R .

# Run the web service on container startup.
ENTRYPOINT ["/usr/src/app/build/src/bin/owl-bot.js"]
