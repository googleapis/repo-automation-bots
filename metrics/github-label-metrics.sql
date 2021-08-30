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
/*
 * Query used to filter githubarchive down to smaller number of records
 * so that we can build dashboards on top of it.
 */
SELECT *
FROM `githubarchive.day.20*`
WHERE
_TABLE_SUFFIX BETWEEN '190101' AND '220101' AND
(
repo.name LIKE 'googleapis/%' OR
repo.name LIKE 'GoogleCloudPlatform/%'
) AND
(
  type = 'PullRequestEvent' OR
  type = 'ReleaseEvent' OR
  type = 'IssuesEvent'
);

/**
 * The following queries further reduce the data down to an easy to query
 * table for each type of label we care about.
 */

/*
SQL Helpers:
*/
CREATE TEMP FUNCTION json2array(json STRING)
RETURNS ARRAY<STRING>
LANGUAGE js AS """
  return JSON.parse(json).map(x => JSON.stringify(x));
""";

CREATE TEMP FUNCTION has_key_value(json STRING, key STRING, expected STRING)
RETURNS BOOL
LANGUAGE js AS """
  const parsed = JSON.parse(json)
  for (const value of parsed) {
    if (value[key] === expected) {
      return true;
    }
  }
  return false;
""";

SELECT * FROM (SELECT COUNT(id) as prs, month_start, 0 as minutes, 'synthtool-full-context' as type FROM (
  SELECT DATE_TRUNC(DATE(created_at), MONTH) as month_start, id, JSON_EXTRACT(payload, '$.pull_request.merged_at') as merged
  FROM `repo-automation-bots.automation_metrics.filtered_github`
  WHERE
  (
  repo.name LIKE 'googleapis/%' OR
  repo.name LIKE 'GoogleCloudPlatform/%'
  ) AND
  type = 'PullRequestEvent' AND
  JSON_EXTRACT(payload, '$.pull_request.head.ref') LIKE "%autosynth%" AND
  JSON_EXTRACT(payload, '$.action') LIKE '"closed"' AND
  has_key_value(JSON_EXTRACT(payload, '$.pull_request.labels'), 'name', 'context: full') = true
)
WHERE merged IS NOT NULL
GROUP BY month_start
ORDER BY month_start DESC)

UNION ALL

SELECT * FROM (SELECT COUNT(id) as prs, month_start, 0 as minutes, 'synthtool-partial-context' as type FROM (
  SELECT DATE_TRUNC(DATE(created_at), MONTH) as month_start, id, JSON_EXTRACT(payload, '$.pull_request.merged_at') as merged
  FROM `repo-automation-bots.automation_metrics.filtered_github`
  WHERE
  (
  repo.name LIKE 'googleapis/%' OR
  repo.name LIKE 'GoogleCloudPlatform/%'
  ) AND
  type = 'PullRequestEvent' AND
  JSON_EXTRACT(payload, '$.pull_request.head.ref') LIKE "%autosynth%" AND
  JSON_EXTRACT(payload, '$.action') LIKE '"closed"' AND
  has_key_value(JSON_EXTRACT(payload, '$.pull_request.labels'), 'name', 'context: partial') = true
)
WHERE merged IS NOT NULL
GROUP BY month_start
ORDER BY month_start DESC)

UNION ALL

SELECT * FROM (SELECT COUNT(id) as prs, month_start, 0 as minutes, 'synthtool-no-context' as type FROM (
  SELECT DATE_TRUNC(DATE(created_at), MONTH) as month_start, id, JSON_EXTRACT(payload, '$.pull_request.merged_at') as merged
  FROM `repo-automation-bots.automation_metrics.filtered_github`
  WHERE
  (
  repo.name LIKE 'googleapis/%' OR
  repo.name LIKE 'GoogleCloudPlatform/%'
  ) AND
  type = 'PullRequestEvent' AND
  JSON_EXTRACT(payload, '$.pull_request.head.ref') LIKE "%autosynth%" AND
  JSON_EXTRACT(payload, '$.action') LIKE '"closed"' AND
  has_key_value(JSON_EXTRACT(payload, '$.pull_request.labels'), 'name', 'context: none') = true
)
WHERE merged IS NOT NULL
GROUP BY month_start
ORDER BY month_start DESC)

UNION ALL

SELECT * FROM (SELECT COUNT(id) as prs, month_start, 0 as minutes, 'owl-bot-copy' as type FROM (
  SELECT DATE_TRUNC(DATE(created_at), MONTH) as month_start, id, JSON_EXTRACT(payload, '$.pull_request.merged_at') as merged
  FROM `repo-automation-bots.automation_metrics.filtered_github`
  WHERE
  (
  repo.name LIKE 'googleapis/%' OR
  repo.name LIKE 'GoogleCloudPlatform/%'
  ) AND
  type = 'PullRequestEvent' AND
  JSON_EXTRACT(payload, '$.action') LIKE '"closed"' AND
  has_key_value(JSON_EXTRACT(payload, '$.pull_request.labels'), 'name', 'owl-bot-copy') = true
)
WHERE merged IS NOT NULL
GROUP BY month_start
ORDER BY month_start DESC)

UNION ALL

SELECT * FROM (SELECT COUNT(id) as prs, month_start, 0 as minutes, 'owl-bot-update-lock' as type FROM (
  SELECT DATE_TRUNC(DATE(created_at), MONTH) as month_start, id, JSON_EXTRACT(payload, '$.pull_request.merged_at') as merged
  FROM `repo-automation-bots.automation_metrics.filtered_github`
  WHERE
  (
  repo.name LIKE 'googleapis/%' OR
  repo.name LIKE 'GoogleCloudPlatform/%'
  ) AND
  type = 'PullRequestEvent' AND
  JSON_EXTRACT(payload, '$.action') LIKE '"closed"' AND
  has_key_value(JSON_EXTRACT(payload, '$.pull_request.labels'), 'name', 'owl-bot-update-lock') = true
)
WHERE merged IS NOT NULL
GROUP BY month_start
ORDER BY month_start DESC)
