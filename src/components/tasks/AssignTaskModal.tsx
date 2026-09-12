import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "../ui";
import { addTask, type TaskPerson } from "../../data/tasksStore";
import { recipientsFor } from "../../utils/taskAssignment";

export function AssignTaskModal({
  from,
  onClose,
  onCreated,
}: {
  from: TaskPerson;
  onClose: () => void;
  onCreated: () => void;
}) {
  const recipients = recipientsFor(from);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState(recipients[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");

  const assignee = recipients.find((r) => r.id === assigneeId);
  const canSubmit = title.trim() && !!assignee;

  function handleSubmit() {
    if (!assignee) return;
    const isStudent = assignee.role === "student";
    addTask({
      title,
      description,
      assignedTo: assignee,
      assignedBy: from,
      dueDate: dueDate || undefined,
      studentId: isStudent ? assignee.id : undefined,
      studentName: isStudent ? assignee.name : undefined,
    });
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-800">Assign a task</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <label className="block text-xs font-medium text-slate-500">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Upload bank statement"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Description (optional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Assign to
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              >
                {recipients.length === 0 && <option value="">No one available</option>}
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.role})</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Due date (optional)
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>Assign Task</Button>
        </div>
      </div>
    </div>
  );
}
