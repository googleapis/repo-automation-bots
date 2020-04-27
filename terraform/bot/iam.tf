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

# Create a ServiceAccount for the bot
resource "google_service_account" "bot_service_account" {
  account_id   = "${var.bot_name}-sa"
  display_name = "${var.bot_name} Service Account"
}

# Give the bot permissions to access the secret this bot will use
resource "google_secret_manager_secret_iam_member" "member" {
  provider  = google-beta
  secret_id = "projects/${var.project_id}/secrets/${var.bot_name}"
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.bot_service_account.email}"
}
