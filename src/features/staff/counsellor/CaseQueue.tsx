import { useState } from "react";
import { Card, CardBody, CardHeader, Avatar, StatusBadge, ProgressBar, Button, PageHeader, StatTile } from "../../../components/ui";
import { STUDENTS, APPLICATIONS } from "../../../data/mockData";

export default function CounsellorCaseQueue() {
  const [selected, setSelected] = useState<string | null>(STUDENTS[0].id);
  const assigned = STUDENTS.filter((s) => s.counsellorId === "c1");
  const student = STUDENTS.find((s) => s.id === selected);
  const apps = student ? APPLICATIONS.filter((a) => a.studentId === student.id) : [];

  return (
    <div>
      <PageHeader title="Counsellor Case Queue" subtitle="Assigned leads and students only." />
      <div className="mb-6 flex gap-4">
        <StatTile label="Assigned Students" value={String(assigned.length)} />
        <StatTile label="Awaiting Response" value="2" tone="amber" />
        <StatTile label="At Risk" value="1" tone="red" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-1">
          <CardHeader title="My students" />
          <CardBody className="space-y-1 p-2">
            {assigned.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50 ${selected === s.id ? "bg-[var(--brand-50)]" : ""}`}
              >
                <Avatar name={s.name} colorClass={s.avatarColor} />
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.country}</p>
                </div>
              </button>
            ))}
          </CardBody>
        </Card>

        <Card className="col-span-2">
          <CardHeader title={student ? student.name : "Select a student"} action={<Button variant="secondary">AI Copilot summary</Button>} />
          <CardBody className="space-y-3">
            {apps.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-100 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800">{a.university} — {a.course}</p>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-2"><ProgressBar value={a.progress} size="sm" /></div>
                <p className="mt-2 text-xs text-slate-500">Next action: {a.nextAction}</p>
              </div>
            ))}
            {apps.length === 0 && <p className="text-sm text-slate-400">No applications yet.</p>}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
