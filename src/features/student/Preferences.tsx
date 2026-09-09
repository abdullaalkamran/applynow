import { useRef, useState, type ReactNode } from "react";
import { Check, Bell, GraduationCap, Globe2, BookOpen, Wallet } from "lucide-react";
import { MobileHeader, Toggle, Chip } from "../../components/ui/mobile";
import { COUNTRIES } from "../../data/countries";
import { markStepComplete } from "../../data/profileCompletion";
import { FIELDS_OF_STUDY } from "../../data/fields";

const STUDY_LEVELS = ["Bachelor's", "Master's", "PhD", "Diploma"];
const INTAKES = ["January", "May", "September", "Any"];
const BUDGETS = ["Under £20k", "£20k – £30k", "£30k – £40k", "£40k+"];
const ACCOMMODATIONS = ["University Halls", "Private Rental", "Homestay", "No preference"];
const LANGUAGES = ["English", "Bengali"];
const FIELDS = [...FIELDS_OF_STUDY, "Other"];

const DESTINATION_CODES = ["GB", "US", "CA", "AU", "IE", "DE", "AE"];
const DESTINATIONS = DESTINATION_CODES
  .map((code) => COUNTRIES.find((c) => c.iso2 === code))
  .filter((c): c is NonNullable<typeof c> => Boolean(c));

const DEFAULT_DESTINATIONS = new Set(["GB", "AU", "CA"]);
const DEFAULT_FIELDS = new Set(["Data Science & AI", "Computer Science & IT"]);

export default function Preferences() {
  const [destinations, setDestinations] = useState<Set<string>>(new Set(DEFAULT_DESTINATIONS));
  const [studyLevel, setStudyLevel] = useState("Master's");
  const [fields, setFields] = useState<Set<string>>(new Set(DEFAULT_FIELDS));
  const [intake, setIntake] = useState("January");
  const [budget, setBudget] = useState("£30k – £40k");
  const [accommodation, setAccommodation] = useState("University Halls");
  const [scholarshipInterest, setScholarshipInterest] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [smsUpdates, setSmsUpdates] = useState(true);
  const [whatsappUpdates, setWhatsappUpdates] = useState(false);
  const [pushUpdates, setPushUpdates] = useState(true);
  const [contactLanguage, setContactLanguage] = useState("English");

  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const savedTimeoutRef = useRef<number | null>(null);

  function toggleSetValue(set: Set<string>, setSet: (s: Set<string>) => void, value: string) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setSet(next);
    setSaved(false);
  }

  function handleSave() {
    const nextErrors: string[] = [];
    if (destinations.size === 0) nextErrors.push("Choose at least one preferred destination.");
    if (fields.size === 0) nextErrors.push("Choose at least one field of interest.");

    setErrors(nextErrors);
    if (nextErrors.length === 0) {
      markStepComplete("preferences");
      setSaved(true);
      if (savedTimeoutRef.current) window.clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = window.setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <div className="flex min-h-full flex-col pb-6">
      <MobileHeader title="Preferences" />

      <div className="px-5">
        <p className="mb-4 text-[13px] text-slate-500">
          Tell us what you're looking for so we can tailor recommendations and reminders.
        </p>

        <div className="space-y-3">
          <Section icon={<GraduationCap size={15} />} title="Study Goals">
            <SubLabel>Study Level</SubLabel>
            <ChipRow>
              {STUDY_LEVELS.map((l) => (
                <Chip key={l} label={l} selected={studyLevel === l} onClick={() => { setStudyLevel(l); setSaved(false); }} />
              ))}
            </ChipRow>

            <SubLabel className="mt-3.5">Preferred Intake</SubLabel>
            <ChipRow>
              {INTAKES.map((i) => (
                <Chip key={i} label={i} selected={intake === i} onClick={() => { setIntake(i); setSaved(false); }} />
              ))}
            </ChipRow>
          </Section>

          <Section icon={<Globe2 size={15} />} title="Destinations" subtitle="Where you'd like to study">
            <ChipRow>
              {DESTINATIONS.map((c) => (
                <Chip
                  key={c.iso2}
                  label={`${c.flag} ${c.name}`}
                  selected={destinations.has(c.iso2)}
                  icon={destinations.has(c.iso2) ? <Check size={11} /> : undefined}
                  onClick={() => toggleSetValue(destinations, setDestinations, c.iso2)}
                />
              ))}
            </ChipRow>
          </Section>

          <Section icon={<BookOpen size={15} />} title="Fields of Interest">
            <ChipRow>
              {FIELDS.map((f) => (
                <Chip key={f} label={f} selected={fields.has(f)} icon={fields.has(f) ? <Check size={11} /> : undefined} onClick={() => toggleSetValue(fields, setFields, f)} />
              ))}
            </ChipRow>
          </Section>

          <Section icon={<Wallet size={15} />} title="Budget & Living">
            <SubLabel>Estimated Annual Budget</SubLabel>
            <ChipRow>
              {BUDGETS.map((b) => (
                <Chip key={b} label={b} selected={budget === b} onClick={() => { setBudget(b); setSaved(false); }} />
              ))}
            </ChipRow>

            <SubLabel className="mt-3.5">Accommodation</SubLabel>
            <ChipRow>
              {ACCOMMODATIONS.map((a) => (
                <Chip key={a} label={a} selected={accommodation === a} onClick={() => { setAccommodation(a); setSaved(false); }} />
              ))}
            </ChipRow>
          </Section>

          <Section icon={<Bell size={15} />} title="Notifications & Alerts">
            <Toggle
              checked={scholarshipInterest}
              onChange={(v) => { setScholarshipInterest(v); setSaved(false); }}
              label="Scholarship opportunities"
              description="Notify me about scholarships I may be eligible for."
            />
            <div className="my-3 h-px bg-slate-100" />
            <div className="space-y-2.5">
              <Toggle checked={emailUpdates} onChange={(v) => { setEmailUpdates(v); setSaved(false); }} label="Email" />
              <Toggle checked={smsUpdates} onChange={(v) => { setSmsUpdates(v); setSaved(false); }} label="SMS" />
              <Toggle checked={whatsappUpdates} onChange={(v) => { setWhatsappUpdates(v); setSaved(false); }} label="WhatsApp" />
              <Toggle checked={pushUpdates} onChange={(v) => { setPushUpdates(v); setSaved(false); }} label="Push notifications" />
            </div>
            <div className="my-3 h-px bg-slate-100" />
            <SubLabel>Preferred Contact Language</SubLabel>
            <ChipRow>
              {LANGUAGES.map((l) => (
                <Chip key={l} label={l} selected={contactLanguage === l} onClick={() => { setContactLanguage(l); setSaved(false); }} />
              ))}
            </ChipRow>
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto bg-[var(--sd-bg)] px-5 pb-2 pt-4">
        {errors.length > 0 && (
          <div className="mb-2 rounded-xl bg-[#FCEAE8] p-3">
            {errors.map((e) => (
              <p key={e} className="text-[12px] font-medium text-[#B8382C]">{e}</p>
            ))}
          </div>
        )}
        {saved && (
          <p className="mb-2 flex items-center justify-center gap-1.5 text-[13px] font-medium text-[var(--sd-teal)]">
            <Check size={14} /> Preferences updated
          </p>
        )}
        <button
          onClick={handleSave}
          className="w-full rounded-xl bg-[var(--sd-ink)] py-3.5 text-[13px] font-semibold text-white"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

function Section({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm shadow-black/[0.03]">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7EEFC] text-[#2955C4]">
          {icon}
        </div>
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function SubLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mb-1.5 text-xs font-medium text-slate-500 ${className}`}>{children}</p>;
}

function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}
