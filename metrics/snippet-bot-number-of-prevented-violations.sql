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

-- Number of violations which are prevented by snippet-bot.
select
    EXTRACT(DATE FROM t5.t AT TIME ZONE "America/Los_Angeles") as date,
	t4.target as target, t4.type as type, t4.max_count - t5.latest_count as prevented_count from (
        -- t4 represents maximum count per violation type and pr
        select
            t3.max_count as max_count,
            t3.target as target,
            t3.violation_type as type,
        FROM(
            SELECT
                jsonPayload.target as target,
                jsonPayload.violation_type as violation_type,
                max(jsonPayload.count) as max_count,
                FROM `repo-automation-bots.automation_metrics.cloudfunctions_googleapis_com_cloud_functions`
                where timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY)
                and resource.labels.function_name = "snippet_bot"
                and jsonPayload.target is not null
                and jsonPayload.violation_type is not null
                group by target, violation_type
            ) as t3
        ) as t4
        inner join (
            -- t5 shows the latest count for violation type on prs
            SELECT
                t1.count as latest_count,
                t1.target as target,
                t1.violation_type as type,
                t1.timestamp as t
            FROM(
                SELECT
                    jsonPayload.target as target,
                    jsonPayload.violation_type as violation_type,
                    jsonPayload.count as count,
                    timestamp as timestamp
                FROM `repo-automation-bots.automation_metrics.cloudfunctions_googleapis_com_cloud_functions`
                where timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY)
                and resource.labels.function_name = "snippet_bot") as t1
            inner join (
                SELECT
                    jsonPayload.target as target,
                    jsonPayload.violation_type as violation_type,
                    max(timestamp) as latest_timestamp
                FROM `repo-automation-bots.automation_metrics.cloudfunctions_googleapis_com_cloud_functions`
                where timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY)
                and resource.labels.function_name = "snippet_bot"
                group by jsonPayload.target, jsonPayload.violation_type
        ) as t2
        on t1.target = t2.target
        and t1.violation_type = t2.violation_type
        and t1.timestamp = t2.latest_timestamp
    ) as t5
    on t4.target = t5.target
    and t4.type = t5.type
