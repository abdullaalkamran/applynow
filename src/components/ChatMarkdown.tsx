import type { ReactNode } from "react";
import { safeHref } from "../utils/safeHref";

// Renders the small slice of Markdown the AI assistant writes — headings, **bold**, `code`, [links](https://…), bullet and numbered
// lists (with nesting), horizontal rules and paragraphs — as real elements. It builds React nodes directly (no innerHTML), so
// nothing the model writes can inject markup or script; links only open if they are http(s).

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("*") && !tok.startsWith("**")) out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    else if (tok.startsWith("**")) out.push(<strong key={key} className="font-semibold text-neutral-900">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={key} className="rounded bg-black/[0.06] px-1 py-0.5 text-[12px]">{tok.slice(1, -1)}</code>);
    else {
      const [, label, url] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok) ?? [];
      const href = url ? safeHref(url) : null;
      out.push(href ? <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-neutral-900 underline">{label}</a> : tok);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

interface Item { indent: number; ordered: boolean; number?: number; text: string; children: Item[] }

function renderList(items: Item[], key: string): ReactNode {
  const ordered = items[0]?.ordered;
  const Tag = ordered ? "ol" : "ul";
  return (
    // The AI often separates numbered items with blank lines, which makes each one its own list — keep its own numbering.
    <Tag key={key} {...(ordered && items[0].number ? { start: items[0].number } : {})} className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5 marker:text-neutral-400`}>
      {items.map((it, i) => (
        <li key={`${key}-${i}`}>
          {inline(it.text, `${key}-${i}`)}
          {it.children.length > 0 && <div className="mt-1">{renderList(it.children, `${key}-${i}c`)}</div>}
        </li>
      ))}
    </Tag>
  );
}

export function ChatMarkdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let n = 0;
  const flushPara = () => {
    if (para.length) {
      const k = `p${n++}`;
      blocks.push(<p key={k} className="whitespace-pre-line">{inline(para.join("\n"), k)}</p>);
      para = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { flushPara(); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { flushPara(); blocks.push(<hr key={`h${n++}`} className="my-1 border-neutral-300/70" />); continue; }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) { flushPara(); const k = `hd${n++}`; blocks.push(<p key={k} className="pt-1 text-[13.5px] font-bold text-neutral-900">{inline(heading[2], k)}</p>); continue; }
    const item = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      flushPara();
      // Collect this run of list lines, then nest by indentation.
      const run: Item[] = [];
      let j = i;
      for (; j < lines.length; j++) {
        const mm = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(lines[j]);
        if (!mm) break;
        run.push({ indent: mm[1].replace(/\t/g, "    ").length, ordered: /\d/.test(mm[2]), number: /\d/.test(mm[2]) ? parseInt(mm[2], 10) : undefined, text: mm[3], children: [] });
      }
      const root: Item[] = [];
      const stack: { indent: number; list: Item[] }[] = [{ indent: run[0].indent, list: root }];
      for (const it of run) {
        while (stack.length > 1 && it.indent < stack[stack.length - 1].indent) stack.pop();
        const top = stack[stack.length - 1];
        if (it.indent > top.indent && top.list.length) {
          const parent = top.list[top.list.length - 1];
          stack.push({ indent: it.indent, list: parent.children });
          parent.children.push(it);
        } else top.list.push(it);
      }
      blocks.push(renderList(root, `l${n++}`));
      i = j - 1;
      continue;
    }
    para.push(trimmed);
  }
  flushPara();
  return <div className={`space-y-2 ${className}`}>{blocks}</div>;
}
