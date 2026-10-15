// Portal worker entry point: polls the UnifinderAi API for jobs and runs them one at a time.
const { claimJob, reportJob } = require("./api");
const { run } = require("./runner");

const POLL_MS = Math.max(5, Number(process.env.POLL_SECONDS) || 15) * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.WORKER_API_TOKEN) { console.error("WORKER_API_TOKEN is not set."); process.exit(1); }
  console.log(`portal worker started — polling ${process.env.API_BASE || "http://localhost:8787"} every ${POLL_MS / 1000}s`);
  for (;;) {
    try {
      const payload = await claimJob();
      if (payload.job) {
        await run(payload, (report) => reportJob(payload.job.id, report));
        continue; // look for more work immediately
      }
    } catch (err) {
      console.error("worker loop error:", err.message);
    }
    await sleep(POLL_MS);
  }
}

main();
