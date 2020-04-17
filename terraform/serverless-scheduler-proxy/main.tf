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

resource "google_cloud_run_service" "scheduler_proxy" {
  provider = google-beta

  name     = "serverless-scheduler-proxy"
  location = var.region

  template {
    spec {
      containers {
        image = "gcr.io/${var.project_id}/serverless-scheduler-proxy"
        env {
          name  = "PROJECT_ID"
          value = var.project_id
        }

        # TEMPORARY
        env {
          name  = "BUCKET_NAME"
          value = "FOO"
        }
        env {
          name  = "KEY_LOCATION"
          value = "BAR"
        }
        env {
          name  = "KEY_RING"
          value = "BAZ"
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_service.services,
  ]
}

# data "google_cloud_run_service" "scheduler_proxy_status" {
#   name = "serverless-scheduler-proxy"
#   depends_on = [
#     google_cloud_run_service.scheduler_proxy
#   ]
# }
