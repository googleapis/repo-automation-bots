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

variable "project_id" {
  description = "The GCP project ID for this module."
}

variable "project_name" {
  description = "The GCP project name for this module, *might* be the same as project_id."
}

variable "folder_id" {
  description = "The Folder the GCP Project is stored in."
}

variable "billing_account" {
  type        = string
  description = "The Billing Account associated with the project"
}

variable "artifact_bucket_name" {
  description = "Name of the GCS bucket to store cloud function artifacts in for deployment."
}

variable "function_region" {
  description = "Region to deploy the cloud function to"
  default     = "us-central1"
}
