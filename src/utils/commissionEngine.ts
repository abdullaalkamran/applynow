// Turns a real application into a real commission figure — no separate hard-coded commission
// amount anywhere. Commission is the university's agreed base (either tuition fee × rate, or a
// fixed amount per enrolment — see commissionRatesStore.ts) plus any platform bonus (always a %
// of tuition), and it only becomes claimable once the student's status is actually "Enrolled"
// (agents can see the estimate the whole way through, but can't invoice it until enrolment is
// confirmed). A university with no rate set yields 0 and `rateSet: false`.

import { getAllUniversities } from "../data/universityCatalogStore";
import { getCommissionRate, hasCommissionRate, EMPTY_RATE, type CommissionMode } from "../data/commissionRatesStore";
import type { Application } from "../types";

export interface CommissionBreakdown {
  universityId: string | null;
  tuitionFeeUSD: number;
  // Whether an admin has actually set a rate for this university — false means the 0 below is
  // "unknown", not "free".
  rateSet: boolean;
  mode: CommissionMode;
  fixedAmountUSD: number;
  ratePercent: number;
  bonusPercent: number;
  bonusLabel: string;
  baseAmount: number;
  bonusAmount: number;
  totalAmount: number;
  claimable: boolean;
}

/** The real tuition figure behind an application — the matched course's fee, falling back to the
 * university's own "Tuition Fee" line item if the course can't be matched by name. */
export function tuitionFeeFor(app: Application): number {
  const university = getAllUniversities().find((u) => u.name === app.university);
  if (!university) return 0;
  const course = university.courses.find((c) => c.name === app.course);
  if (course) return course.feeUSD;
  return university.fees.find((f) => f.label === "Tuition Fee")?.amount ?? 0;
}

export function commissionFor(app: Application): CommissionBreakdown {
  const university = getAllUniversities().find((u) => u.name === app.university);
  const tuitionFeeUSD = tuitionFeeFor(app);
  const rate = university ? getCommissionRate(university.id) : EMPTY_RATE;
  const baseAmount = rate.mode === "fixed" ? Math.round(rate.fixedAmountUSD) : Math.round(tuitionFeeUSD * (rate.ratePercent / 100));
  const bonusAmount = Math.round(tuitionFeeUSD * (rate.bonusPercent / 100));
  return {
    universityId: university?.id ?? null,
    tuitionFeeUSD,
    rateSet: university ? hasCommissionRate(university.id) : false,
    mode: rate.mode,
    fixedAmountUSD: rate.fixedAmountUSD,
    ratePercent: rate.ratePercent,
    bonusPercent: rate.bonusPercent,
    bonusLabel: rate.bonusLabel,
    baseAmount,
    bonusAmount,
    totalAmount: baseAmount + bonusAmount,
    claimable: app.status === "Enrolled",
  };
}
