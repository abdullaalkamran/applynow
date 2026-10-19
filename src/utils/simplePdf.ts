// A small, dependency-free PDF writer: A4 pages of text, rules and tinted boxes — enough for a cost estimate. Text uses the
// built-in Helvetica (labels) and Courier (amounts, so right-aligned columns line up exactly), encoded as WinAnsi.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;

type FontKey = "F1" | "F2" | "F3" | "F4"; // Helvetica, Helvetica-Bold, Courier, Courier-Bold

// Characters outside Latin-1 that WinAnsi has, or plain stand-ins for ones it doesn't.
const WIN_ANSI: Record<string, number> = { "€": 0x80, "—": 0x97, "–": 0x96, "•": 0x95, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94 };
const STAND_IN: Record<string, string> = { "→": "->", "≈": "~", "≥": ">=", "≤": "<=", "✓": "", " ": " " };

function toBytes(text: string): number[] {
  const out: number[] = [];
  for (const ch of text.replace(/[→≈≥≤✓ ]/g, (c) => STAND_IN[c])) {
    const code = ch.charCodeAt(0);
    if (WIN_ANSI[ch] !== undefined) out.push(WIN_ANSI[ch]);
    else if (code < 256) out.push(code);
    else out.push(0x3f); // "?"
  }
  return out;
}

function escapeBytes(bytes: number[]): string {
  let s = "";
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += "\\" + String.fromCharCode(b);
    else s += String.fromCharCode(b);
  }
  return s;
}

/** Rough text width in points. Courier is exact (0.6 em per character); Helvetica uses an average that's good enough for wrapping. */
export function textWidth(text: string, size: number, mono = false, bold = false): number {
  return text.length * size * (mono ? 0.6 : bold ? 0.54 : 0.5);
}

export class PdfWriter {
  private pages: string[][] = [[]];
  y = MARGIN; // distance from the top edge
  readonly left = MARGIN;
  readonly right = PAGE_W - MARGIN;
  readonly width = PAGE_W - MARGIN * 2;

  private get ops() { return this.pages[this.pages.length - 1]; }
  private py(yTop: number) { return PAGE_H - yTop; }

  /** Starts a new page when fewer than `needed` points remain. */
  ensure(needed: number) {
    if (this.y + needed > PAGE_H - MARGIN) { this.pages.push([]); this.y = MARGIN; }
  }

  gap(h: number) { this.y += h; }

  text(str: string, x: number, size: number, opts: { font?: FontKey; align?: "left" | "right"; gray?: number; color?: [number, number, number] } = {}) {
    const font = opts.font ?? "F1";
    const mono = font === "F3" || font === "F4";
    const bold = font === "F2" || font === "F4";
    const w = textWidth(str, size, mono, bold);
    const px = opts.align === "right" ? x - w : x;
    const [r, g, b] = opts.color ?? (opts.gray !== undefined ? [opts.gray, opts.gray, opts.gray] : [0.1, 0.1, 0.1]);
    this.ops.push(`BT /${font} ${size} Tf ${r} ${g} ${b} rg ${px.toFixed(2)} ${this.py(this.y + size).toFixed(2)} Td (${escapeBytes(toBytes(str))}) Tj ET`);
  }

  /** Wrapped paragraph in Helvetica; advances the cursor. */
  paragraph(str: string, size = 9, opts: { gray?: number; bold?: boolean; x?: number; width?: number } = {}) {
    const x = opts.x ?? this.left;
    const maxW = opts.width ?? this.right - x;
    const words = str.split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (textWidth(next, size, false, !!opts.bold) > maxW && line) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    for (const l of lines) {
      this.ensure(size + 4);
      this.text(l, x, size, { font: opts.bold ? "F2" : "F1", gray: opts.gray });
      this.y += size + 3;
    }
  }

  rule(gray = 0.8) {
    this.ensure(4);
    this.ops.push(`${gray} ${gray} ${gray} RG 0.6 w ${this.left} ${this.py(this.y).toFixed(2)} m ${this.right} ${this.py(this.y).toFixed(2)} l S`);
    this.y += 4;
  }

  /** A tinted band behind the next `height` points (call before drawing its text). */
  band(height: number, rgb: [number, number, number] = [0.93, 0.95, 0.93]) {
    this.ensure(height);
    this.ops.push(`${rgb[0]} ${rgb[1]} ${rgb[2]} rg ${this.left} ${this.py(this.y + height).toFixed(2)} ${this.width} ${height} re f`);
  }

  build(): Uint8Array {
    const chunks: number[] = [];
    const offsets: number[] = [];
    const push = (s: string) => { for (let i = 0; i < s.length; i++) chunks.push(s.charCodeAt(i) & 0xff); };
    const obj = (id: number, body: string) => { offsets[id] = chunks.length; push(`${id} 0 obj\n${body}\nendobj\n`); };

    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    const fontIds = [3, 4, 5, 6];
    const firstPage = 7;
    const pageIds = this.pages.map((_, i) => firstPage + i * 2 + 1);
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${this.pages.length} >>`);
    ["Helvetica", "Helvetica-Bold", "Courier", "Courier-Bold"].forEach((name, i) =>
      obj(fontIds[i], `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`));
    this.pages.forEach((ops, i) => {
      const content = ops.join("\n");
      const contentId = firstPage + i * 2;
      obj(contentId, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      obj(contentId + 1, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> >>`);
    });
    const total = firstPage + this.pages.length * 2;
    const xref = chunks.length;
    push(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let id = 1; id < total; id++) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
    push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return Uint8Array.from(chunks);
  }
}

/** Saves bytes as a file download. */
export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
