import { Messenger } from "../../components/Messenger";
import { ROLE_HOME } from "../../layouts/nav";
import { useRole } from "../../context/RoleContext";
import { BackButton } from "../../components/ui";

/** Shared "Messages" page for the roles that use the common staff/admin shell (admission,
 * compliance, data, finance, admin) — student, counsellor and agent each have their own
 * bespoke-chrome version of this same page, but all wrap the same Messenger component. */
export default function SharedMessages() {
  const { role } = useRole();
  return (
    <div>
      <BackButton fallback={ROLE_HOME[role]} />
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Messages</h1>
        <p className="mt-1 text-sm text-slate-500">Direct messages with students and colleagues connected to your cases.</p>
      </div>
      <Messenger />
    </div>
  );
}
