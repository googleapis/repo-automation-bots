/**
 * Copyright 2021 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* PRs approved for renovate service */
SELECT COUNT(jsonPayload.count) as APPROVED_RENOVATE, DATE_TRUNC(DATE(timestamp, "America/Los_Angeles"), MONTH) as month FROM `repo-automation-bots.automation_metrics.cloudfunctions_googleapis_com_cloud_functions`
WHERE resource.labels.function_name = "auto_approve"
AND jsonPayload.event = "auto_approve.approved_tagged"
AND jsonPayload.prAuthor = "renovate-bot"
GROUP BY month, jsonPayload.event, jsonPayload.prAuthor;

/* PRs approved across all users */
SELECT COUNT(jsonPayload.count) as APPROVED_ALL, DATE_TRUNC(DATE(timestamp, "America/Los_Angeles"), MONTH) as month FROM `repo-automation-bots.automation_metrics.cloudfunctions_googleapis_com_cloud_functions`
WHERE resource.labels.function_name = "auto_approve"
AND jsonPayload.event = "auto_approve.approved_tagged"
GROUP BY month;
