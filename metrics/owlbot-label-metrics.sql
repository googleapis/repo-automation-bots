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
SELECT month_start, prs as SYNTH_FULL
FROM `repo-automation-bots.automation_metrics.github_label_metrics`
WHERE type = "synthtool-full-context"
ORDER BY month_start DESC;

SELECT month_start, SUM(prs) as SYNTH_PARTIAL_NONE
FROM `repo-automation-bots.automation_metrics.github_label_metrics`
WHERE type = "synthtool-no-context"
OR type = "synthtool-partial-context"
GROUP BY month_start
ORDER BY month_start DESC;

SELECT month_start, prs as OWLBOT_COPY
FROM `repo-automation-bots.automation_metrics.github_label_metrics`
WHERE type = "owl-bot-copy"
ORDER BY month_start DESC;
