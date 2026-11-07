// Renders the About page's Markdown as real page content (headings, lists, links), unlike ChatMarkdown which styles headings
// as chat text. Builds React nodes directly — no innerHTML — so nothing an editor types can inject markup. Links: https://… open in
// a new tab, "/path" links stay on the site; anything else (javascript:, //other-site) is shown as plain text.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

function inline(text: string, base: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${base}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={key} className="font-semibold text-neutral-900">{inline(tok.slice(2, -2), key)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={key} className="rounded bg-black/[0.06] px-1 py-0.5 text-[0.9em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("*")) out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    else {
      const [, label, url] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok) ?? [];
      if (url && /^https?:\/\//i.test(url)) out.push(<a key={key} href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-neutral-900 underline underline-offset-2">{label}</a>);
      else if (url && /^\/(?!\/)/.test(url)) out.push(<Link key={key} to={url} className="font-medium text-neutral-900 underline underline-offset-2">{label}</Link>);
      else out.push(tok);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function PageMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let n = 0;
  const flushPara = () => { if (para.length) { const k = `p${n++}`; blocks.push(<p key={k} className="mt-4">{inline(para.join(" "), k)}</p>); para = []; } };
  const flushList = () => {
    if (!list) return;
    const k = `l${n++}`;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(<Tag key={k} className={`mt-4 space-y-2 pl-6 marker:text-neutral-400 ${list.ordered ? "list-decimal" : "list-disc"}`}>{list.items.map((t, i) => <li key={i}>{inline(t, `${k}-${i}`)}</li>)}</Tag>);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    let m: RegExpExecArray | null;
    if (!line) { flushPara(); flushList(); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flushPara(); flushList(); blocks.push(<hr key={`h${n++}`} className="my-8 border-neutral-200" />); continue; }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      flushPara(); flushList();
      const k = `hd${n++}`;
      // The page's own <h1> is its title, so "#" and "##" are both section headings (h2); "###" and deeper are sub-headings (h3).
      blocks.push(m[1].length <= 2
        ? <h2 key={k} className="mt-12 text-2xl font-bold tracking-tight text-neutral-900">{inline(m[2], k)}</h2>
        : <h3 key={k} className="mt-7 text-[18px] font-semibold text-neutral-900">{inline(m[2], k)}</h3>);
      continue;
    }
    if ((m = /^[-*•]\s+(.*)$/.exec(line))) { flushPara(); if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; } list.items.push(m[1]); continue; }
    if ((m = /^\d+[.)]\s+(.*)$/.exec(line))) { flushPara(); if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; } list.items.push(m[1]); continue; }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return <>{blocks}</>;
}
