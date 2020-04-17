# Copyright 2019 Google LLC
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

# Terraform module to enable GCP services in the specified project
resource "google_project_service" "services" {
  project            = var.project_id
  disable_on_destroy = false

  for_each = toset([
    "cloudapis.googleapis.com",
    "cloudtasks.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudscheduler.googleapis.com",
    "secretmanager.googleapis.com",
  ])
  service = each.key
}
