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

# Use the official lightweight Node.js 12 image.
# https://hub.docker.com/_/node
FROM node:14-alpine AS BUILD

# Create and change to the app directory.
WORKDIR /usr/src/app

COPY package*.json ./

# Install production dependencies.
RUN npm install

# Copy local code to the container image.
COPY . ./

RUN npm run compile

FROM node:14-alpine

# Create and change to the app directory.
WORKDIR /usr/src/app

COPY package*.json ./
COPY --from=BUILD /usr/src/app/build build

RUN npm ci --only=production

RUN chmod 755 /usr/src/app/build/src/index.js

# Run the web service on container startup.
CMD [ "npm", "run", "start" ]
