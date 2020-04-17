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

resource "google_service_account" "scheduler_service_account" {
  account_id   = "serverless-proxy-cron"
  display_name = "Serverless Scheduler Proxy Cron"
}

resource "google_cloud_run_service_iam_binding" "binding" {
  location = google_cloud_run_service.scheduler_proxy.location
  project  = google_cloud_run_service.scheduler_proxy.project
  service  = google_cloud_run_service.scheduler_proxy.name
  role     = "roles/run.invoker"
  members = [
    "serviceAccount:${google_service_account.scheduler_service_account.email}",
  ]
}
