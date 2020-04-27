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

resource "google_storage_bucket_object" "archive" {
  name   = "${var.bot_name}.zip"
  bucket = var.artifact_bucket_name
  source = data.archive_file.bot_zip.output_path
}

resource "google_cloudfunctions_function" "bot" {
  name        = var.bot_name
  description = "Cloud function servicing bot: ${var.bot_name}"
  runtime     = "nodejs10"
  region      = var.function_region

  source_archive_bucket = var.artifact_bucket_name
  source_archive_object = google_storage_bucket_object.archive.name

  service_account_email = google_service_account.bot_service_account.email

  entry_point = replace(var.bot_name, "-", "_")

  trigger_http = true

  environment_variables = {
    GCF_SHORT_FUNCTION_NAME          = var.bot_name
    PROJECT_ID                       = var.project_id
    GCF_LOCATION                     = var.function_region
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "1"
  }

  depends_on = [
    google_cloud_tasks_queue.bot_queue,
    google_storage_bucket_object.archive,
    google_service_account.bot_service_account,
  ]
}

resource "google_cloud_tasks_queue" "bot_queue" {
  name     = var.bot_name
  location = var.function_region
  rate_limits {
    max_concurrent_dispatches = 2048
    max_dispatches_per_second = 500
  }
  retry_config {
    max_attempts = 100
  }
  depends_on = [
    google_project_service.services,
  ]
}


data "archive_file" "bot_zip" {
  type        = "zip"
  output_path = "${path.root}/out/${var.bot_name}.zip"
  source_dir  = "${path.root}/../targets/${var.bot_name}"
}

# Cloud Scheduler crons are conditional per-bot. 
resource "google_cloud_scheduler_job" "bot_cron" {
  # This is a tricky way of doing a conditional statement
  # If there is a file in the bot directory with "cron" it will make ONE of these,
  # otherwise it will make ZERO of these.
  count = fileexists("${path.root}/../packages/${var.bot_name}/cron") ? 1 : 0

  name        = var.bot_name
  description = "Cron job for ${var.bot_name}"
  schedule    = file("${path.root}/../packages/${var.bot_name}/cron")
  time_zone   = "America/Los_Angeles"
  region      = var.function_region

  http_target {
    http_method = "POST"
    uri         = join("/", [var.scheduler_proxy_url, "v0"])
    headers = {
      "Content-Type" : "application/json"
    }
    body = base64encode(jsonencode(
      {
        "Name" : var.bot_name,
        "Type" : "function",
        "Location" : var.function_region,
    }))

    oidc_token {
      service_account_email = var.scheduler_sa_email
      audience              = var.scheduler_proxy_url
    }
  }
}
