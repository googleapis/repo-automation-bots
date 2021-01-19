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

# build with:
# docker build -t gcr.io/repo-automation-bots/bazel-bot .
FROM gcr.io/gapic-images/googleapis-bazel

# Install the github command line tool.
RUN apt-get install -y software-properties-common
RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-key C99B11DEB97541F0
RUN apt-add-repository https://cli.github.com/packages
RUN apt-get update
RUN apt-get install -y gh

COPY generate-googleapis-gen.sh /generate-googleapis-gen.sh
COPY docker-main.sh /docker-main.sh

ENTRYPOINT ["/bin/bash", "docker-main.sh"]
