// The Fees tab's budget tools: one course picker that drives both the cost calculator and the visa cost sheet.
import { useState } from "react";
import type { University } from "../types";
import type { CountryRecord } from "../data/countryRegistry";
import { CostCalculator } from "./CostCalculator";
import { VisaCostBreakdown } from "./VisaCostBreakdown";

export function FeesPlanner({ university, course, country }: { university: University; course?: University["courses"][number]; country?: CountryRecord }) {
  const [name, setName] = useState(course?.name ?? university.courses[0]?.name ?? "");
  const selected = university.courses.find((c) => c.name === name) ?? university.courses[0];
  return (
    <>
      <CostCalculator
        university={university}
        course={selected}
        onCourseChange={setName}
        recommendedFundsUSD={country?.recommendedFundsUSD}
        ihsPerYear={country?.visaCostConfig?.healthSurchargePerYear}
      />
      {country?.visaCostConfig && <VisaCostBreakdown university={university} course={selected} config={country.visaCostConfig} />}
    </>
  );
}
