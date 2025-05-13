# Copyright 2021 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

##########################################################
# Build the command-line tool that lets us sign JWTs.
FROM rust:1.79-buster
RUN git clone https://github.com/mike-engel/jwt-cli.git
WORKDIR /jwt-cli
RUN git checkout 652b5c4b2a9d9a236aa3826a8dd34204ca7e1dad
RUN cargo build --release

##########################################################
# Build the image.
FROM gcr.io/gapic-images/googleapis:prod
COPY --from=0 /jwt-cli/target/release/jwt /bin/jwt

# Install the github command line tool, and jq to parse json responses.
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt update \
    && apt-get install -y gh jq

# Copy the source files from this directory.
COPY generate-googleapis-gen.sh /generate-googleapis-gen.sh
COPY install-credentials.sh /install-credentials.sh
COPY docker-main.sh /docker-main.sh

ENTRYPOINT ["/bin/bash"]
CMD ["/docker-main.sh"]
