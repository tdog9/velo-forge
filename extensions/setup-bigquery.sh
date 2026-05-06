#!/usr/bin/env bash
# Deploy three Firestore→BigQuery streaming extensions declared in
# firebase.json. Each pulls config from extensions/<instance>.env.
# Resources created (free tier for school traffic):
#   - 3 Cloud Functions (one per collection)
#   - BigQuery dataset: turboprep_analytics
#   - 6 BigQuery tables (raw_changelog + raw_latest per instance)
#
# Run: bash extensions/setup-bigquery.sh

set -e
cd "$(dirname "$0")/.."
npx -y firebase-tools@latest deploy --only extensions --force
echo ""
echo "Done. Within ~1 minute every Firestore write to the configured"
echo "collections will stream into BigQuery dataset turboprep_analytics."
echo ""
echo "Open BigQuery: https://console.cloud.google.com/bigquery?project=hpr-2026"
echo "Sample queries: extensions/sample-queries.sql"
