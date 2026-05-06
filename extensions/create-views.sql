-- TurboPrep BigQuery views — paste this whole file into the BigQuery
-- console editor and click Run. Creates 4 views in turboprep_analytics
-- that the Looker Studio dashboard reads from.
--
-- Open: https://console.cloud.google.com/bigquery?project=hpr-2026
-- Then: + Compose New Query → paste below → Run

-- 1. Per-athlete weekly summary — drives "athlete progress over time"
CREATE OR REPLACE VIEW `hpr-2026.turboprep_analytics.v_athlete_weekly_summary` AS
SELECT
  REGEXP_EXTRACT(document_name, r'users/([^/]+)/workouts') AS uid,
  DATE_TRUNC(DATE(CAST(JSON_EXTRACT_SCALAR(data, '$.date') AS TIMESTAMP)), WEEK(MONDAY)) AS week_start,
  COUNT(*) AS workouts,
  AVG(CAST(JSON_EXTRACT_SCALAR(data, '$.duration') AS FLOAT64)) AS avg_duration_min,
  SUM(CAST(JSON_EXTRACT_SCALAR(data, '$.duration') AS FLOAT64)) AS total_minutes,
  COUNTIF(CAST(JSON_EXTRACT_SCALAR(data, '$.rpe') AS INT64) >= 8) AS hard_sessions
FROM `hpr-2026.turboprep_analytics.workouts_raw_latest`
WHERE JSON_EXTRACT_SCALAR(data, '$.date') IS NOT NULL
GROUP BY uid, week_start;

-- 2. Daily activity — drives heatmap + 90-day trend chart
CREATE OR REPLACE VIEW `hpr-2026.turboprep_analytics.v_team_activity_daily` AS
SELECT
  REGEXP_EXTRACT(document_name, r'users/([^/]+)/') AS uid,
  DATE(CAST(JSON_EXTRACT_SCALAR(data, '$.date') AS TIMESTAMP)) AS day,
  COUNT(*) AS workouts,
  AVG(CAST(JSON_EXTRACT_SCALAR(data, '$.duration') AS FLOAT64)) AS avg_duration_min
FROM `hpr-2026.turboprep_analytics.workouts_raw_latest`
WHERE JSON_EXTRACT_SCALAR(data, '$.date') IS NOT NULL
  AND CAST(JSON_EXTRACT_SCALAR(data, '$.date') AS TIMESTAMP)
        >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
GROUP BY uid, day;

-- 3. Race-day lap distribution — drives lap-time scatter / best-lap leaderboard
CREATE OR REPLACE VIEW `hpr-2026.turboprep_analytics.v_race_lap_distribution` AS
SELECT
  REGEXP_EXTRACT(document_name, r'race_day/([^/]+)/') AS race_date,
  document_id AS rider_uid,
  ARRAY_LENGTH(JSON_QUERY_ARRAY(data, '$.laps')) AS lap_count,
  CAST(JSON_EXTRACT_SCALAR(data, '$.bestLapMs') AS FLOAT64) / 1000 AS best_lap_seconds,
  JSON_EXTRACT_SCALAR(data, '$.displayName') AS rider_name
FROM `hpr-2026.turboprep_analytics.stints_raw_latest`
WHERE JSON_EXTRACT_SCALAR(data, '$.bestLapMs') IS NOT NULL;

-- 4. Chat engagement — drives "team is alive" daily chart
CREATE OR REPLACE VIEW `hpr-2026.turboprep_analytics.v_chat_engagement` AS
SELECT
  REGEXP_EXTRACT(document_name, r'teams/([^/]+)/') AS team_id,
  DATE(timestamp) AS day,
  COUNT(*) AS messages,
  COUNTIF(JSON_EXTRACT_SCALAR(data, '$.kind') = 'chat') AS athlete_chats,
  COUNTIF(JSON_EXTRACT_SCALAR(data, '$.kind') = 'workout') AS workout_posts,
  COUNTIF(JSON_EXTRACT_SCALAR(data, '$.kind') = 'coach') AS coach_broadcasts,
  COUNT(DISTINCT JSON_EXTRACT_SCALAR(data, '$.uid')) AS active_members
FROM `hpr-2026.turboprep_analytics.chat_raw_changelog`
WHERE operation = 'CREATE'
GROUP BY team_id, day;
