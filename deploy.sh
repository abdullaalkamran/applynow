#!/bin/bash
# Run on the production server (cPanel/CloudLinux), from the repo root
# (/home/cvqyqwcasg/unifinderai.com): bash deploy.sh
#
# Does the three things you'd otherwise run by hand after every push: pull the latest code, apply
# any pending Prisma migration, and restart the Node app. Does NOT run `npm install` or
# `npm run build` — this server's Node runtime intentionally never has the frontend's
# devDependencies (vite/tsc/tailwind) installed; the frontend is built locally and its output
# (dist/) is committed to the repo, so `git pull` alone is what actually updates it. See
# server/.env.example and this repo's deploy notes for the full picture.
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Pulling latest code..."
git pull origin main

echo "==> Activating Node virtual environment..."
# CloudLinux's own activate script isn't written to survive `set -u` — it references
# CL_VIRTUAL_ENV without a fallback, which is normally only pre-set when a terminal is opened
# through cPanel's own UI. Sourcing it under `-u` from a plain SSH session kills this whole script
# with "CL_VIRTUAL_ENV: unbound variable" before the migration or restart ever runs. `-u` is only
# relaxed for this one third-party line, not for the rest of this script.
set +u
# shellcheck disable=SC1091
source /home/cvqyqwcasg/nodevenv/unifinderai.com/20/bin/activate
set -u

echo "==> Applying any pending database migrations..."
(cd server && npx prisma migrate deploy)

echo "==> Restarting the app..."
mkdir -p tmp
touch tmp/restart.txt

echo "==> Done. Give Passenger a few seconds to restart, then check https://unifinderai.com/api/health"
