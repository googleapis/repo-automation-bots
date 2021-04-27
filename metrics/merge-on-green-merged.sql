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
SELECT 
    COUNT(jsonPayload.count) as LABELED,
    DATE_TRUNC(DATE(timestamp, "America/Los_Angeles"), DAY) as day
FROM `repo-automation-bots.automation_metrics.cloudfunctions_googleapis_com_cloud_functions`
    WHERE resource.labels.function_name = "merge_on_green"
    AND jsonPayload.event = "merge_on_green.merged"
GROUP BY day;
