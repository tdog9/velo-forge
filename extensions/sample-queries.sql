-- TurboPrep analytics — paste any of these into the BigQuery console
--   https://console.cloud.google.com/bigquery?project=hpr-2026
-- The Firestore→BigQuery extension stamps two tables per collection:
--   <name>_raw_changelog  — every doc write (history)
--   <name>_raw_latest     — latest snapshot per doc (current state)

-- Workouts: top 10 athletes by total workouts (last 90 days)
SELECT
  document_name,
  REGEXP_EXTRACT(document_name, r'users/([^/]+)/workouts') AS uid,
  COUNT(*) AS total_workouts,
  AVG(CAST(JSON_EXTRACT_SCALAR(data, '$.duration') AS FLOAT64)) AS avg_duration_min
FROM `hpr-2026.turboprep_analytics.workouts_raw_latest`
WHERE
  CAST(JSON_EXTRACT_SCALAR(data, '$.date') AS TIMESTAMP)
    >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
GROUP BY document_name, uid
ORDER BY total_workouts DESC
LIMIT 10;

-- Workouts by year level (cross-school comparison)
SELECT
  JSON_EXTRACT_SCALAR(data, '$.yearLevel') AS year_level,
  COUNT(*) AS total_workouts,
  COUNTIF(CAST(JSON_EXTRACT_SCALAR(data, '$.rpe') AS INT64) >= 8) AS hard_sessions,
  AVG(CAST(JSON_EXTRACT_SCALAR(data, '$.duration') AS FLOAT64)) AS avg_duration_min
FROM `hpr-2026.turboprep_analytics.workouts_raw_latest`
WHERE JSON_EXTRACT_SCALAR(data, '$.yearLevel') IS NOT NULL
GROUP BY year_level
ORDER BY year_level;

-- Daily team activity heatmap (last 30 days)
SELECT
  DATE(CAST(JSON_EXTRACT_SCALAR(data, '$.date') AS TIMESTAMP)) AS day,
  REGEXP_EXTRACT(document_name, r'teams/([^/]+)/') AS team_id,
  COUNT(*) AS workouts
FROM `hpr-2026.turboprep_analytics.workouts_raw_latest`
WHERE
  CAST(JSON_EXTRACT_SCALAR(data, '$.date') AS TIMESTAMP)
    >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY day, team_id
ORDER BY day DESC;

-- Race-day lap-time distribution (across all events)
SELECT
  REGEXP_EXTRACT(document_name, r'race_day/([^/]+)/') AS race_date,
  document_id AS rider_uid,
  ARRAY_LENGTH(JSON_QUERY_ARRAY(data, '$.laps')) AS lap_count,
  CAST(JSON_EXTRACT_SCALAR(data, '$.bestLapMs') AS FLOAT64) / 1000 AS best_lap_seconds
FROM `hpr-2026.turboprep_analytics.stints_raw_latest`
WHERE JSON_EXTRACT_SCALAR(data, '$.bestLapMs') IS NOT NULL
ORDER BY race_date DESC, best_lap_seconds ASC
LIMIT 50;

-- Chat activity by team (engagement signal)
SELECT
  REGEXP_EXTRACT(document_name, r'teams/([^/]+)/') AS team_id,
  DATE(timestamp) AS day,
  COUNT(*) AS messages,
  COUNTIF(JSON_EXTRACT_SCALAR(data, '$.kind') = 'workout') AS workout_posts,
  COUNTIF(JSON_EXTRACT_SCALAR(data, '$.kind') = 'coach') AS coach_broadcasts,
  COUNT(DISTINCT JSON_EXTRACT_SCALAR(data, '$.uid')) AS active_members
FROM `hpr-2026.turboprep_analytics.chat_raw_changelog`
WHERE
  timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
  AND operation = 'CREATE'
GROUP BY team_id, day
ORDER BY day DESC, messages DESC;
