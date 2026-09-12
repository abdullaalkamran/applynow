// Turns a real application into a real commission figure — no separate hard-coded commission
// amount anywhere. Commission is always tuition fee × (base rate + any university bonus), and it
// only becomes claimable once the student's status is actually "Enrolled" (agents can see the
// estimate the whole way through, but can't invoice it until enrolment is confirmed).

import { getAllUniversities } from "../data/universityCatalogStore";
import { getCommissionRate } from "../data/commissionRatesStore";
import type { Application } from "../types";

export interface CommissionBreakdown {
  universityId: string | null;
  tuitionFeeUSD: number;
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
  const rate = university ? getCommissionRate(university.id) : { ratePercent: 0, bonusPercent: 0, bonusLabel: "" };
  const baseAmount = Math.round(tuitionFeeUSD * (rate.ratePercent / 100));
  const bonusAmount = Math.round(tuitionFeeUSD * (rate.bonusPercent / 100));
  return {
    universityId: university?.id ?? null,
    tuitionFeeUSD,
    ratePercent: rate.ratePercent,
    bonusPercent: rate.bonusPercent,
    bonusLabel: rate.bonusLabel,
    baseAmount,
    bonusAmount,
    totalAmount: baseAmount + bonusAmount,
    claimable: app.status === "Enrolled",
  };
}
