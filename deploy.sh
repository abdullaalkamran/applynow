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
# shellcheck disable=SC1091
source /home/cvqyqwcasg/nodevenv/unifinderai.com/20/bin/activate

echo "==> Applying any pending database migrations..."
(cd server && npx prisma migrate deploy)

echo "==> Restarting the app..."
mkdir -p tmp
touch tmp/restart.txt

echo "==> Done. Give Passenger a few seconds to restart, then check https://unifinderai.com/api/health"
