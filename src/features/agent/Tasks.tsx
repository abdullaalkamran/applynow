import { useState } from "react";
import { TaskBoard } from "../../components/tasks/TaskBoard";
import { getAgentTasks } from "../../utils/taskBoard";
import { AGENTS, CURRENT_AGENT_ID } from "../../data/mockData";

export default function AgentTasks() {
  const [, forceTick] = useState(0);
  const agent = AGENTS.find((a) => a.id === CURRENT_AGENT_ID)!;
  const tasks = getAgentTasks(CURRENT_AGENT_ID);
  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
        <p className="mt-1 text-sm text-slate-500">{openCount} open task{openCount === 1 ? "" : "s"} across your students.</p>
      </div>

      <TaskBoard
        tasks={tasks}
        from={{ id: agent.id, role: "agent", name: agent.name }}
        onChanged={() => forceTick((t) => t + 1)}
      />
    </div>
  );
}
