/**
 * Copyright 2020 Google LLC. All Rights Reserved.
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
DEPRECATED: we are migrating towards dashboards based on logger.metric,
with their SQL stored in individual files within this folder.
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

/*
Determines monthly releases by looking for "ReleaseEvent"s created by
the yoshi-automation user.

This measures the impact of release-plese and related bots, e.g.,
"failurechecker", "conventional-commit-lint".
*/
SELECT * FROM (SELECT COUNT(id) as actions, month_start, 13.8 as minutes, 'release' as type FROM (
  SELECT DATE_TRUNC(DATE(created_at), MONTH) as month_start, id
  FROM `githubarchive.day.20*`
  WHERE
  _TABLE_SUFFIX BETWEEN '190101' AND '220101' AND
  (
    repo.name LIKE 'googleapis/%' OR
    repo.name LIKE 'GoogleCloudPlatform/%'
  ) AND
  JSON_EXTRACT(payload, '$.action') LIKE '"published"' AND
  actor.login = 'yoshi-automation' AND
  type = 'ReleaseEvent'
)
GROUP BY month_start
ORDER BY month_start ASC)

UNION ALL

/*
Determines how many PRs were created by renovate bot.

This is meant to measure the impact of the trusted-contribution bot; prior
to this bot users needed to kick of CI by hand.
*/
SELECT * FROM (SELECT COUNT(id) as actions, month_start, 4 as minutes, 'renovate-run' as type FROM (
  SELECT DATE_TRUNC(DATE(created_at), MONTH) as month_start, id
  FROM `githubarchive.day.20*`
  WHERE
  _TABLE_SUFFIX BETWEEN '190101' AND '220101' AND
  (
    repo.name LIKE 'googleapis/%' OR
    repo.name LIKE 'GoogleCloudPlatform/%'
  ) AND
  actor.login LIKE "renovate-bot" AND
  JSON_EXTRACT(payload, '$.action') LIKE '"opened"' AND
  type = 'PullRequestEvent'
)
GROUP BY month_start
ORDER BY month_start ASC)

UNION ALL

/*
Determines how many issues were opened by flaky-bot, prior to flaky-bot
users needed to manually detect failing nightly builds, and open issues
on GitHub.
*/
SELECT * FROM (SELECT COUNT(id) as actions, month_start, 6.75 as minutes, 'flaky-bot' as type FROM (
  SELECT DATE_TRUNC(DATE(created_at), MONTH) as month_start, id
  FROM `githubarchive.day.20*`
  WHERE
  _TABLE_SUFFIX BETWEEN '190101' AND '220101' AND
  (
    repo.name LIKE 'googleapis/%' OR
    repo.name LIKE 'GoogleCloudPlatform/%'
  ) AND
  (
    actor.login LIKE "flaky-bot%" OR
    actor.login LIKE "build-cop-bot%"
  ) AND
  JSON_EXTRACT(payload, '$.action') LIKE '"opened"' AND
  type = 'IssuesEvent'
)
GROUP BY month_start
ORDER BY month_start ASC)

UNION ALL

/*
Measures PRs that have been assigned to at least one user.

This is meant to measure the impact of blunderbuss, which automatically
assigns reviewers.

(we don't have a great way to identify whether PRs were assigned by
blunderbuss, vs., a human, so we might want to hold off on reporting
on numbers from this metric).
*/
SELECT * FROM (SELECT COUNT(id) as actions, month_start, 3.5 as minutes, 'pr-assignment' as type FROM (
  SELECT DATE_TRUNC(DATE(created_at), MONTH) as month_start, id
  FROM `githubarchive.day.20*`
  WHERE
  _TABLE_SUFFIX BETWEEN '190101' AND '220101' AND
  (
    repo.name LIKE 'googleapis/%' OR
    repo.name LIKE 'GoogleCloudPlatform/%'
  ) AND
  JSON_EXTRACT(payload, '$.action') LIKE '"opened"' AND
  ARRAY_LENGTH(json2array(JSON_EXTRACT(payload, '$.pull_request.assignees'))) > 0 AND
  type = 'PullRequestEvent'
)
GROUP BY month_start
ORDER BY month_start ASC)

UNION ALL

/*
When landing a pull request, how much time would you estimate you spend
performing non-code-review tasks, e.g., ensuring tests have passed,
the branch is up-to-date, etc., after the PR has already been approved?
(answers are in minutes)
*/
SELECT * FROM (SELECT COUNT(id) as actions, month_start, 4.3 as minutes, 'landed-prs' as type FROM (
  SELECT DATE_TRUNC(DATE(created_at), MONTH) as month_start, id, JSON_EXTRACT(payload, '$.pull_request.merged_at') as merged
  FROM `githubarchive.day.20*`
  WHERE
  _TABLE_SUFFIX BETWEEN '190101' AND '220101' AND
  (
    repo.name LIKE 'googleapis/%' OR
    repo.name LIKE 'GoogleCloudPlatform/%'
  ) AND
  JSON_EXTRACT(payload, '$.action') LIKE '"closed"' AND
  type = 'PullRequestEvent'
)
WHERE merged IS NOT NULL
GROUP BY month_start
ORDER BY month_start ASC)

UNION ALL

/*
Measures PRs that have been closed by the gcf-merge-on-green bot, i.e., that have been automerged.
Using the 4.3 estimate above to get an estimate of how much time is being saved.
*/

SELECT * FROM (SELECT COUNT(id) as prs, month_start, 4.3 as minutes, 'merged-by-mog' as type FROM (
  SELECT DATE_TRUNC(DATE(created_at), MONTH) as month_start, id, JSON_EXTRACT(payload, '$.pull_request.merged_at') as merged
  FROM `githubarchive.day.20*`
  WHERE
  _TABLE_SUFFIX BETWEEN '190101' AND '220101' AND
  (
    repo.name LIKE 'googleapis/%' OR
    repo.name LIKE 'GoogleCloudPlatform/%'
  ) AND
  JSON_EXTRACT(payload, '$.action') LIKE '"closed"'
  AND JSON_EXTRACT(payload, '$.pull_request.merged_by.login') LIKE '"gcf-merge-on-green[bot]"'
  AND type = 'PullRequestEvent'
)
WHERE merged IS NOT NULL
GROUP BY month_start
ORDER BY month_start ASC)

UNION ALL

/*
Measure autosynth PRs with full context. We ran a survey with the Yoshi team,
which indicated each of these PRs saves 3.5 minutes:

We look for PRs that have a "context: full" label and were merged.
*/

SELECT * FROM (SELECT COUNT(id) as prs, month_start, 3.5 as minutes, 'context-aware-commit' as type FROM (
  SELECT DATE_TRUNC(DATE(created_at), MONTH) as month_start, id, JSON_EXTRACT(payload, '$.pull_request.merged_at') as merged
  FROM `githubarchive.day.20*`
  WHERE
  _TABLE_SUFFIX BETWEEN '190101' AND '220101' AND
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
ORDER BY month_start ASC)
