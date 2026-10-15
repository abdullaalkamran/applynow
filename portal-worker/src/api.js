// Thin client for the UnifinderAi worker API (server/src/routes/worker.js).
const API_BASE = (process.env.API_BASE || "http://localhost:8787").replace(/\/$/, "");
const TOKEN = process.env.WORKER_API_TOKEN || "";

async function post(path, body) {
  const res = await fetch(`${API_BASE}/api/worker${path}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(body || {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${json.error || ""}`);
  return json;
}

const claimJob = () => post("/jobs/claim");
const reportJob = (id, report) => post(`/jobs/${id}/report`, report);

/** Downloads a stored student document (relative `fileUrl` like /uploads/documents/x.pdf) into memory. */
async function downloadDocument(fileUrl) {
  const res = await fetch(`${API_BASE}${fileUrl}`);
  if (!res.ok) throw new Error(`document download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

module.exports = { claimJob, reportJob, downloadDocument };
