# Portal worker

Runs the counsellor AI agent's browser automation: submits applications to external university / B2B agent portals and
re-checks them for status changes, comments and required documents. It is a **separate service** (needs Chromium) — don't
run it on the cPanel/Passenger host; use a small VPS or a container.

## How it works
1. A counsellor saves a portal login under **External Portals** and asks the AI agent to submit an application
   (approval card #1). The API queues a `submit` job.
2. The worker claims it (`POST /api/worker/jobs/claim`), logs in, fills the portal from the student's profile and
   documents, **stops before the final submit** and uploads a screenshot.
3. The counsellor reviews the preview on the External Portals page and confirms (approval #2). A `confirm_submit` job
   reopens the draft and clicks submit; the portal's reference is stored on the application.
4. Every few hours the worker runs a `check` job per submitted application and writes new comments, required
   documents and status changes back into UnifinderAi. It never changes an application's official status — a portal
   status change becomes a review task for the counsellor.

Safety rules baked in: credentials are decrypted only here (never sent to a browser or an AI model); CAPTCHA, MFA codes,
unexpected pages and portals without a playbook hand over to the counsellor as a task; after 2 failed logins the worker
stops trying that portal and asks the counsellor to fix the saved password.

## Setup
```
cd portal-worker
cp .env.example .env     # API_BASE and WORKER_API_TOKEN (same value as the API server's WORKER_API_TOKEN)
npm install              # also downloads Chromium
npm start
```
The API server also needs `PORTAL_CRED_KEY` (encrypts saved logins) and `WORKER_API_TOKEN` — see `server/.env.example`.

## Adding a portal
Each real portal needs a playbook in `src/playbooks/` (see `index.js` for the contract and `mock.js` for an example):
`match`, `fillApplication`, `finalSubmit`, `readStatus`. Confirm the portal's terms permit automated access first —
an official API or bulk-upload route is better where one exists.

## Trying it locally
`npm run mock-portal` starts a fake portal on :4100 (login `agent` / `secret`); save it as a portal with URL
`http://localhost:4100/login`. Change what the monitor sees with
`curl -X POST localhost:4100/__set -d '{"status":"Under review","comments":["Please send IELTS"],"requiredDocs":["IELTS Certificate"]}'`.
