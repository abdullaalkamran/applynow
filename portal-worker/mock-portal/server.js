// A tiny fake agent portal for developing/testing the worker: login (agent / secret), an application form with a draft
// step and a final submit, and a status page with a status, comments and required documents. Drive its state from a
// test with POST /__set {status, comments:[...], requiredDocs:[...]}. Not for production — no real security.
const http = require("http");

const state = { drafts: {}, apps: {}, n: 0 };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const page = (body) => `<!doctype html><html><body>${body}</body></html>`;
const readBody = (req) => new Promise((resolve) => { const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", () => resolve(Buffer.concat(chunks))); });

function parseMultipart(buf, contentType) {
  const boundary = /boundary=(.+)$/.exec(contentType || "")?.[1];
  const fields = {};
  if (!boundary) return fields;
  for (const part of buf.toString("latin1").split(`--${boundary}`)) {
    const m = /name="([^"]+)"(?:; filename="[^"]*")?\r\n(?:[^\r\n]+\r\n)*\r\n([\s\S]*?)\r\n$/.exec(part);
    if (m) fields[m[1]] = /filename=/.test(part) ? `[file ${m[2].length} bytes]` : m[2];
  }
  return fields;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:4100");
  const send = (html, code = 200) => { res.writeHead(code, { "content-type": "text/html" }); res.end(page(html)); };
  const authed = /sid=ok/.test(req.headers.cookie || "");

  if (url.pathname === "/__set" && req.method === "POST") {
    Object.assign(state, JSON.parse((await readBody(req)).toString() || "{}"));
    res.writeHead(200); return res.end("ok");
  }
  if (url.pathname === "/" || url.pathname === "/login") {
    if (req.method === "POST") {
      const f = new URLSearchParams((await readBody(req)).toString());
      if (f.get("username") === "agent" && f.get("password") === "secret") {
        res.writeHead(302, { "set-cookie": "sid=ok; Path=/", location: "/home" }); return res.end();
      }
      return send('<p>Invalid username or password</p><form method="post"><input name="username"><input name="password" type="password"><button type="submit">Log in</button></form>', 401);
    }
    return send('<h1>Mock Agent Portal</h1><form method="post"><input name="username"><input name="password" type="password"><button type="submit">Log in</button></form>');
  }
  if (!authed) { res.writeHead(302, { location: "/login" }); return res.end(); }
  if (url.pathname === "/home") return send("<h1>Dashboard</h1><a href='/apply'>New application</a>");
  if (url.pathname === "/apply") {
    return send(`<form method="post" action="/apply" enctype="multipart/form-data">
      ${["firstName", "lastName", "email", "dob", "nationality", "passportNumber", "course"].map((n) => `<label>${n}<input name="${n}"></label>`).join("")}
      <input type="file" name="passportFile"><button type="submit" name="act" value="draft">Save draft</button></form>`);
  }
  if (url.pathname === "/apply" && req.method === "POST") return;
  if (url.pathname.startsWith("/draft/")) {
    const ref = decodeURIComponent(url.pathname.slice(7));
    if (req.method === "POST") {
      const appRef = `MOCK-${String(++state.n).padStart(4, "0")}`;
      state.apps[appRef] = { ...state.drafts[ref], status: "Received", comments: [], requiredDocs: [] };
      return send(`<p>Submitted</p><span data-application-ref="${appRef}">${appRef}</span>`);
    }
    const d = state.drafts[ref];
    if (!d) return send("not found", 404);
    return send(`<h2>Draft ${esc(ref)}</h2><pre>${esc(JSON.stringify(d))}</pre><form method="post"><button type="submit" value="submit">Submit application</button></form>`);
  }
  if (url.pathname.startsWith("/status/")) {
    const a = state.apps[decodeURIComponent(url.pathname.slice(8))];
    if (!a) return send("not found", 404);
    return send(`<span data-status>${esc(state.status ?? a.status)}</span>
      ${(state.comments ?? []).map((c, i) => `<p data-comment="c${i + 1}">${esc(c)}</p>`).join("")}
      ${(state.requiredDocs ?? []).map((d) => `<li data-required-doc>${esc(d)}</li>`).join("")}`);
  }
  send("not found", 404);
});

// The draft form posts to /apply — handled separately so it can read the multipart body.
const original = server.listeners("request")[0];
server.removeAllListeners("request");
server.on("request", async (req, res) => {
  const url = new URL(req.url, "http://localhost:4100");
  if (url.pathname === "/apply" && req.method === "POST" && /sid=ok/.test(req.headers.cookie || "")) {
    const fields = parseMultipart(await readBody(req), req.headers["content-type"]);
    const ref = `DRAFT-${Date.now().toString(36)}`;
    state.drafts[ref] = fields;
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(page(`<p>Draft saved</p><span data-draft-ref="${ref}">${ref}</span>`));
  }
  return original(req, res);
});

server.listen(4100, () => console.log("mock portal on http://localhost:4100 (agent / secret)"));
