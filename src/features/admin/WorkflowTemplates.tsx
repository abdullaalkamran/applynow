import { Table, PageHeader } from "../../components/ui";
import { STAGE_ORDER, STAGE_LABEL } from "../../types/journey";

// The journey every application follows is defined in code (types/journey.ts, server/src/journeyLogic.js),
// so this page shows that real definition rather than a list of made-up templates.
export default function AdminWorkflowTemplates() {
  return (
    <div>
      <PageHeader
        title="Application Journey"
        subtitle="The stages every application moves through, from application to enrolment."
      />
      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["#", "Stage"]}>
          {STAGE_ORDER.map((stage, i) => (
            <tr key={stage} className="hover:bg-slate-50">
              <td className="px-5 py-3 text-slate-400">{i + 1}</td>
              <td className="px-5 py-3 font-medium text-slate-800">{STAGE_LABEL[stage]}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
