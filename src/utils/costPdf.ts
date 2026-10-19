// Builds the downloadable PDF of the Cost Calculator from the same CostModel the screen shows, so the file always matches
// what the student saw.
import type { CostModel, DurationMode } from "./costModel";
import { FEES_CAN_CHANGE_WARNING } from "./ukvi";
import { PdfWriter, downloadPdf } from "./simplePdf";

export interface CostPdfInput {
  model: CostModel;
  universityName: string;
  country: string;
  courseName: string;
  mode: DurationMode;
  showVisaTables: boolean;
  availableFunds: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");

export function buildCostPdf(input: CostPdfInput): Uint8Array {
  const { model: m } = input;
  const cur = m.currency;
  const pdf = new PdfWriter();
  const showLocal = !!(m.localName && m.rate);

  pdf.text("Study Cost Estimate", pdf.left, 20, { font: "F2" });
  pdf.gap(26);
  pdf.paragraph(`${input.courseName}`, 11, { bold: true });
  pdf.paragraph(`${input.universityName}, ${input.country}`, 10, { gray: 0.3 });
  pdf.paragraph(`${input.mode === "1st Year" ? "First year" : `Full course (${m.courseMonths} months)`}  |  Prepared on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, 9, { gray: 0.4 });
  pdf.gap(6);
  pdf.rule(0.75);
  pdf.gap(4);

  const fx = pdf.right - (showLocal ? 118 : 0); // right edge of the foreign-currency column
  const lx = pdf.right; // right edge of the local-currency column

  function heading(title: string, sub?: string, withCols = false) {
    pdf.ensure(48);
    pdf.gap(8);
    pdf.text(title, pdf.left, 12.5, { font: "F2" });
    if (withCols) {
      pdf.text(cur.trim(), fx, 8.5, { font: "F2", align: "right", gray: 0.45 });
      if (showLocal) pdf.text(m.localName!, lx, 8.5, { font: "F2", align: "right", gray: 0.45 });
    }
    pdf.gap(16);
    if (sub) { pdf.paragraph(sub, 8.5, { gray: 0.45 }); }
    pdf.rule(0.85);
  }

  function row(label: string, note: string | undefined, foreign: number | string | null, local?: number | null, opts: { bold?: boolean; negative?: boolean } = {}) {
    const labelW = (showLocal ? fx - 112 : fx - 90) - pdf.left;
    const noteLines = note ? Math.ceil((note.length * 8 * 0.5) / labelW) : 0;
    const h = 13 + noteLines * 10;
    pdf.ensure(h + 4);
    if (opts.bold) { pdf.band(h + 2); }
    pdf.gap(opts.bold ? 2 : 1);
    pdf.text(label, pdf.left + (opts.bold ? 6 : 0), 9.5, { font: opts.bold ? "F2" : "F1" });
    const fv = foreign === null ? "-" : typeof foreign === "string" ? foreign : `${opts.negative ? "-" : ""}${cur}${fmt(foreign)}`;
    pdf.text(fv, fx - (opts.bold && !showLocal ? 6 : 0), 9.5, { font: opts.bold ? "F4" : "F3", align: "right" });
    if (showLocal) {
      const lv = local !== undefined && local !== null ? fmt(local) : foreign !== null && typeof foreign === "number" && m.rate ? fmt(foreign * m.rate) : "-";
      pdf.text(lv, lx - (opts.bold ? 6 : 0), 9.5, { font: opts.bold ? "F4" : "F3", align: "right" });
    }
    pdf.gap(12);
    if (note) pdf.paragraph(note, 8, { gray: 0.45, x: pdf.left + (opts.bold ? 6 : 0), width: labelW });
    pdf.gap(opts.bold ? 3 : 2);
  }

  if (input.showVisaTables) {
    heading("Cost Before Visa", "What you pay before your visa is granted.", true);
    row("Tuition deposit", `Required by the university: ${cur}${fmt(m.requiredDeposit)} (${m.depositRule})${m.casDeposit > m.requiredDeposit ? `; you plan to pay ${cur}${fmt(m.casDeposit)}` : ""}`, m.casDeposit);
    if (m.ihs) row("Immigration Health Surcharge (IHS)", m.ihs.note, m.ihs.amount);
    row("Visa application fee", undefined, m.visaFee);
    if (m.medical) row("Medical test (TB)", undefined, m.medical.foreign, m.medical.local);
    if (m.airTicket) row("Air ticket", undefined, m.airTicket.foreign, m.airTicket.local);
    row("Total before visa", undefined, m.beforeVisaForeign, undefined, { bold: true });

    heading("Bank Statement", "The money you must show for your visa application, held for 28 days in a row.", true);
    row("Tuition fee still to pay", "First-year tuition less the deposit", m.tuitionDue);
    if (m.living) row("Living costs", m.living.note, m.living.amount);
    row("Show in your account", undefined, m.bankForeign, undefined, { bold: true });
  }

  heading("Estimated Total Cost", input.mode === "1st Year" ? "First year, plus the one-off visa costs." : `The whole ${m.courseMonths}-month course, plus the one-off visa costs.`);
  const tuitionLabel = m.years > 1 ? `Tuition (${Math.round(m.years * 10) / 10} years)` : "Tuition (first year)";
  const plain = (label: string, note: string | undefined, value: string, negative = false) => {
    const h = 13 + (note ? 10 : 0);
    pdf.ensure(h + 4);
    pdf.gap(1);
    pdf.text(label, pdf.left, 9.5);
    pdf.text(value, pdf.right, 9.5, { font: "F3", align: "right", color: negative ? [0.1, 0.45, 0.2] : undefined });
    pdf.gap(12);
    if (note) pdf.paragraph(note, 8, { gray: 0.45 });
    pdf.gap(2);
  };
  plain(tuitionLabel, undefined, m.tuitionKind === "amount" ? `${cur}${fmt(m.tuition)}` : m.tuitionKind === "free" ? "Free" : "Fee not provided");
  if (m.ihs) plain("Immigration Health Surcharge", m.ihs.note, `${cur}${fmt(m.ihs.amount)}`);
  if (m.visaFee > 0) plain("Visa application fee", undefined, `${cur}${fmt(m.visaFee)}`);
  if (m.medical) plain("Medical test", m.medical.custom ? "Your own figure" : undefined, m.medical.foreign !== null ? `${cur}${fmt(m.medical.foreign)}` : "-");
  if (m.airTicket) plain("Air ticket", m.airTicket.custom ? "Your own figure" : undefined, m.airTicket.foreign !== null ? `${cur}${fmt(m.airTicket.foreign)}` : "-");
  if (m.accommodation) plain("Accommodation", `${m.accommodation.place}: ${cur}${fmt(m.accommodation.monthly)} per month x ${m.accommodation.months} months`, `${cur}${fmt(m.accommodation.amount)}`);
  if (m.scholarship) plain(`Scholarship: ${m.scholarship.label}`, "Deducted from tuition", `-${cur}${fmt(m.scholarship.amount)}`, true);
  pdf.gap(2);
  pdf.ensure(24);
  pdf.band(20, [0.9, 0.95, 0.91]);
  pdf.gap(4);
  pdf.text("Estimated Total", pdf.left + 6, 11, { font: "F2" });
  pdf.text(`${cur}${fmt(m.total)}`, pdf.right - 6, 11, { font: "F4", align: "right" });
  pdf.gap(20);

  if (input.availableFunds > 0) {
    plain("Available funds", undefined, `${cur}${fmt(input.availableFunds)}`);
    plain("Funding gap", undefined, `${cur}${fmt(Math.max(0, m.total - input.availableFunds))}`);
  }

  pdf.gap(10);
  m.notes.forEach((n) => pdf.paragraph(n, 8.5, { gray: 0.35 }));
  if (m.uk) pdf.paragraph("Accommodation uses the average student rent for the region (Save the Student, National Student Accommodation Survey 2025). Your real rent depends on the room and the provider.", 8.5, { gray: 0.35 });
  pdf.gap(6);
  pdf.ensure(60);
  pdf.band(36, [0.99, 0.96, 0.88]);
  pdf.gap(5);
  pdf.paragraph(FEES_CAN_CHANGE_WARNING, 9, { gray: 0.3, x: pdf.left + 8, width: pdf.width - 16 });
  pdf.gap(14);
  pdf.paragraph("Prepared with the UnifinderAi cost calculator. This is an estimate, not an offer or a quote.", 8, { gray: 0.55 });
  return pdf.build();
}

export function downloadCostPdf(input: CostPdfInput) {
  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40);
  downloadPdf(buildCostPdf(input), `cost-estimate-${safe(input.universityName)}-${safe(input.courseName)}.pdf`);
}
