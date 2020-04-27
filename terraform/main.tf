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

resource "google_app_engine_application" "app" {
  project     = var.project_id
  location_id = "us-central"
}

resource "google_storage_bucket" "artifact_bucket" {
  name               = var.artifact_bucket_name
  bucket_policy_only = true
}

module "serverless_schduler" {
  source     = "./serverless-scheduler-proxy"
  project_id = var.project_id
}


# Long term:
# In the release of Terraform 0.13, there will be support
# for the `for_each`, `for`, and `count` keywords for modules
# This will allow us to use the following code to NOT hard code
# our list of bots (and have to manually add them each time):

########################
# TODO: Terraform 0.13 #
########################

# locals {
#   bots = setsubtract(
#     fileset("${module.root}/../packages", "*"),
#     toset(["gcf-utils", "generate-bot"])
#   )
# }

# module "bot" {
#   source = "./bot"

#   project_id           = var.project_id
#   artifact_bucket_name = google_storage_bucket.artifact_bucket.name
#   function_region      = var.function_region
#   scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
#   scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url

#   for_each = local.bots

#   bot_name = each.key
# }

########################
#       ENDTODO        #
########################


module "auto_label" {
  source = "./bot"

  project_id           = var.project_id
  artifact_bucket_name = google_storage_bucket.artifact_bucket.name
  function_region      = var.function_region
  bot_name             = "auto-label"
  scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
  scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url
}

module "blunderbuss" {
  source = "./bot"

  project_id           = var.project_id
  artifact_bucket_name = google_storage_bucket.artifact_bucket.name
  function_region      = var.function_region
  bot_name             = "blunderbuss"
  scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
  scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url
}

module "buildcop" {
  source = "./bot"

  project_id           = var.project_id
  artifact_bucket_name = google_storage_bucket.artifact_bucket.name
  function_region      = var.function_region
  bot_name             = "buildcop"
  scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
  scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url
}

module "conventional_commit_lint" {
  source = "./bot"

  project_id           = var.project_id
  artifact_bucket_name = google_storage_bucket.artifact_bucket.name
  function_region      = var.function_region
  bot_name             = "conventional-commit-lint"
  scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
  scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url
}

module "failurechecker" {
  source = "./bot"

  project_id           = var.project_id
  artifact_bucket_name = google_storage_bucket.artifact_bucket.name
  function_region      = var.function_region
  bot_name             = "failurechecker"
  scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
  scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url
}

module "header_checker_lint" {
  source = "./bot"

  project_id           = var.project_id
  artifact_bucket_name = google_storage_bucket.artifact_bucket.name
  function_region      = var.function_region
  bot_name             = "header-checker-lint"
  scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
  scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url
}

module "label_sync" {
  source = "./bot"

  project_id           = var.project_id
  artifact_bucket_name = google_storage_bucket.artifact_bucket.name
  function_region      = var.function_region
  bot_name             = "label-sync"
  scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
  scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url
}

module "merge_on_green" {
  source = "./bot"

  project_id           = var.project_id
  artifact_bucket_name = google_storage_bucket.artifact_bucket.name
  function_region      = var.function_region
  bot_name             = "merge-on-green"
  scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
  scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url
}

module "publish" {
  source = "./bot"

  project_id           = var.project_id
  artifact_bucket_name = google_storage_bucket.artifact_bucket.name
  function_region      = var.function_region
  bot_name             = "publish"
  scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
  scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url
}

module "release-please" {
  source = "./bot"

  project_id           = var.project_id
  artifact_bucket_name = google_storage_bucket.artifact_bucket.name
  function_region      = var.function_region
  bot_name             = "release-please"
  scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
  scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url
}

module "snippet_bot" {
  source = "./bot"

  project_id           = var.project_id
  artifact_bucket_name = google_storage_bucket.artifact_bucket.name
  function_region      = var.function_region
  bot_name             = "snippet-bot"
  scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
  scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url
}

module "sync_repo_settings" {
  source = "./bot"

  project_id           = var.project_id
  artifact_bucket_name = google_storage_bucket.artifact_bucket.name
  function_region      = var.function_region
  bot_name             = "sync-repo-settings"
  scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
  scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url
}

module "trusted_contribution" {
  source = "./bot"

  project_id           = var.project_id
  artifact_bucket_name = google_storage_bucket.artifact_bucket.name
  function_region      = var.function_region
  bot_name             = "trusted-contribution"
  scheduler_sa_email   = module.serverless_schduler.scheduler_sa_email
  scheduler_proxy_url  = module.serverless_schduler.scheduler_proxy_url
}
