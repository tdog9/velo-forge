#!/usr/bin/env bash
# Install the Firestore → BigQuery streaming extension three times,
# once per collection we want to query analytically. Each install is
# its own Cloud Function + BigQuery sink, so collections stay
# independently-managed.
#
# What it produces:
#   BigQuery dataset: turboprep_analytics
#     - workouts_raw_changelog       (every users/{uid}/workouts/* write)
#     - workouts_raw_latest          (latest snapshot per workout doc)
#     - chat_raw_changelog / latest  (every team chat message)
#     - race_stints_raw_*            (every race-day stint result)
#
# Run: bash extensions/setup-bigquery.sh
# Each install prompts once for "OK with creating these resources?"
# — that's expected; type 'y'.

set -e
cd "$(dirname "$0")/.."

CLI="npx -y firebase-tools@latest"

echo "1/3 — workouts collection (users/{uid}/workouts)"
$CLI ext:install firebase/firestore-bigquery-export \
  --instance-id workouts-bq \
  --params=extensions/firestore-bigquery-workouts.env

echo "2/3 — chat collection (teams/{teamId}/chat)"
$CLI ext:install firebase/firestore-bigquery-export \
  --instance-id chat-bq \
  --params=extensions/firestore-bigquery-chat.env

echo "3/3 — race-day stints collection (race_day/{date}/stints)"
$CLI ext:install firebase/firestore-bigquery-export \
  --instance-id stints-bq \
  --params=extensions/firestore-bigquery-stints.env

echo "Done. Three extensions installed; each will start streaming"
echo "writes into BigQuery dataset turboprep_analytics within a minute."
echo ""
echo "Open BigQuery console:"
echo "  https://console.cloud.google.com/bigquery?project=hpr-2026"
echo ""
echo "Run a sample query (paste into the BigQuery editor):"
echo "  -- See extensions/sample-queries.sql"
