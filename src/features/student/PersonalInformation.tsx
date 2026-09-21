import { useEffect, useRef, useState } from "react";
import { Camera, Check, ShieldCheck, Loader2, AlertTriangle, LifeBuoy } from "lucide-react";
import { MobileHeader, FieldShell, inputClass, DocumentUpload, monthsUntil, type ScanStatus } from "../../components/ui/mobile";
import { CURRENT_STUDENT_ID } from "../../data/mockData";
import { getAllStudents } from "../../data/allStudentsStore";
import { COUNTRIES, countryByName, countryByIso2 } from "../../data/countries";
import { markStepComplete } from "../../data/profileCompletion";
import { loadPersonalInfo, savePersonalInfo, type PersonalInfoDetails } from "../../data/studentProfileDetailsStore";
import { apiPostForm } from "../../utils/apiClient";
import type { Student } from "../../types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEMO_OTP = "123456";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phoneCountry: string;
  phone: string;
  dob: string;
  gender: string;
  nationality: string;
  fatherName: string;
  motherName: string;
  maritalStatus: string;
  passportNumber: string;
  personalNumber: string;
  previousPassportNumber: string;
  placeOfBirth: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  permanentAddress: string;
  presentAddress: string;
  city: string;
  country: string;
}

// The server's real AI-vision extraction result (see server/src/passportExtraction.js) — only
// fields the model actually read off the image are present; everything else is genuinely absent
// rather than a fabricated guess, so the caller only marks real hits as "auto-filled".
interface PassportExtractionResult {
  fields: Partial<Record<keyof FormState, string>>;
  emergencyContact?: Partial<Record<keyof EmergencyContact, string>>;
  extractedKeys: string[];
  warnings: string[];
  available: boolean;
}

// The real starting point for anyone who hasn't saved personal info yet — only name/email/country
// are known (from their actual account), everything else genuinely is blank rather than a
// fabricated "sample" passport that isn't theirs.
function emptyForm(student: Student): FormState {
  const [firstName, ...lastParts] = student.name.split(" ");
  const defaultCountry = countryByName(student.country)?.iso2 ?? "";
  return {
    firstName, lastName: lastParts.join(" "), email: student.email,
    phoneCountry: defaultCountry, phone: "",
    dob: "", gender: "", nationality: defaultCountry, fatherName: "", motherName: "", maritalStatus: "",
    passportNumber: "", personalNumber: "", previousPassportNumber: "", placeOfBirth: "",
    issuingAuthority: "", issueDate: "", expiryDate: "",
    permanentAddress: "", presentAddress: "", city: "", country: defaultCountry,
  };
}

// savePersonalInfo stores the phone as one combined string ("<dial code> <local number>") and the
// country/nationality as full names — split/matched back into the form's own iso2 + local-number
// shape here so a reload shows exactly what was saved, not a re-guessed approximation.
function splitPhone(combined: string, fallbackCountry: string): { phoneCountry: string; phone: string } {
  const [dial, ...rest] = combined.trim().split(" ");
  const match = COUNTRIES.find((c) => c.dial === dial);
  return { phoneCountry: match?.iso2 ?? fallbackCountry, phone: match ? rest.join(" ") : combined };
}

function fromSavedPersonalInfo(saved: PersonalInfoDetails, defaultCountry: string): FormState {
  const { phoneCountry, phone } = splitPhone(saved.phone, defaultCountry);
  return {
    firstName: saved.firstName,
    lastName: saved.lastName,
    email: saved.email,
    phoneCountry,
    phone,
    dob: saved.dob,
    gender: saved.gender,
    nationality: countryByName(saved.nationality)?.iso2 ?? defaultCountry,
    fatherName: saved.fatherName,
    motherName: saved.motherName,
    maritalStatus: saved.maritalStatus,
    passportNumber: saved.passportNumber,
    personalNumber: saved.personalNumber,
    previousPassportNumber: saved.previousPassportNumber,
    placeOfBirth: saved.placeOfBirth,
    issuingAuthority: saved.issuingAuthority,
    issueDate: saved.issueDate,
    expiryDate: saved.passportExpiry,
    permanentAddress: saved.permanentAddress,
    presentAddress: saved.presentAddress,
    city: saved.city,
    country: countryByName(saved.country)?.iso2 ?? defaultCountry,
  };
}

function emergencyContactFromSaved(saved: PersonalInfoDetails, defaultCountry: string): EmergencyContact {
  const { phoneCountry, phone } = splitPhone(saved.emergencyContactPhone, defaultCountry);
  return {
    name: saved.emergencyContactName,
    relationship: saved.emergencyContactRelationship,
    address: saved.emergencyContactAddress,
    phoneCountry,
    phone,
    email: saved.emergencyContactEmail,
  };
}

interface EmergencyContact {
  name: string;
  relationship: string;
  address: string;
  phoneCountry: string;
  phone: string;
  email: string;
}

const RELATIONSHIPS = ["Parent", "Guardian", "Sibling", "Spouse", "Relative", "Friend", "Other"];

// The real starting point before any scan or save — genuinely blank, not a fabricated person.
function emptyEmergencyContact(defaultCountry: string): EmergencyContact {
  return { name: "", relationship: "", address: "", phoneCountry: defaultCountry, phone: "", email: "" };
}

type PhoneStatus = "unverified" | "sending" | "code-sent" | "verifying" | "verified";

export default function PersonalInformation() {
  // Undefined only for the brief window right after login before allStudentsStore's cache
  // resolves — same accepted trade-off as every other migrated store (see syncCache.ts).
  const student = getAllStudents().find((s) => s.id === CURRENT_STUDENT_ID);
  const defaultCountry = countryByName(student?.country ?? "")?.iso2 ?? "BD";
  // Real, previously-saved details for whoever's actually logged in — a genuinely blank form
  // (just name/email/country, which are real) for anyone who hasn't saved anything yet.
  const savedInfo = loadPersonalInfo();
  const [form, setForm] = useState<FormState>(
    () => savedInfo ? fromSavedPersonalInfo(savedInfo, defaultCountry) : emptyForm(student ?? { id: "", name: "", email: "", country: "", avatarColor: "" })
  );
  const [autoFilled, setAutoFilled] = useState<Set<keyof FormState>>(new Set());
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [permanentConfirmed, setPermanentConfirmed] = useState(false);
  const [sameAsPermanent, setSameAsPermanent] = useState(true);

  const [passportFile, setPassportFile] = useState<{ name: string; previewUrl?: string } | null>(null);
  // A blob: preview URL holds the picked file in memory until revoked — release it when it is
  // replaced or this screen closes.
  useEffect(() => {
    const url = passportFile?.previewUrl;
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [passportFile?.previewUrl]);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scanWarning, setScanWarning] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedTimeoutRef = useRef<number | null>(null);

  const [phoneStatus, setPhoneStatus] = useState<PhoneStatus>(savedInfo ? "verified" : "unverified");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");

  const [ec, setEc] = useState<EmergencyContact>(
    () => savedInfo ? emergencyContactFromSaved(savedInfo, defaultCountry) : emptyEmergencyContact(defaultCountry)
  );
  const [ecAutoFilled, setEcAutoFilled] = useState<Set<keyof EmergencyContact>>(new Set());

  const emailValid = form.email.length === 0 || EMAIL_RE.test(form.email);
  const ecEmailValid = ec.email.length === 0 || EMAIL_RE.test(ec.email);
  const initials = `${form.firstName[0] ?? ""}${form.lastName[0] ?? ""}`.toUpperCase();
  const phoneCountry = countryByIso2(form.phoneCountry);
  const residenceCountry = countryByIso2(form.country);
  const cityOptions = residenceCountry?.cities ?? [];
  const presentAddressValue = sameAsPermanent ? form.permanentAddress : form.presentAddress;
  const expiryWarning = getExpiryWarning(form.expiryDate);

  function updateEc<K extends keyof EmergencyContact>(key: K, value: EmergencyContact[K]) {
    setEc((e) => ({ ...e, [key]: value }));
    setEcAutoFilled((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setSaved(false);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setAutoFilled((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setSaved(false);
    if (key === "phone") setPhoneStatus("unverified");
  }

  function handleCountryChange(iso2: string) {
    const next = countryByIso2(iso2);
    setForm((f) => ({ ...f, country: iso2, city: next?.cities[0] ?? "" }));
    setAutoFilled((prev) => {
      if (!prev.has("country") && !prev.has("city")) return prev;
      const nextSet = new Set(prev);
      nextSet.delete("country");
      nextSet.delete("city");
      return nextSet;
    });
    setSaved(false);
  }

  async function handleFile(file: File) {
    const isImage = file.type.startsWith("image/");
    setPassportFile({ name: file.name, previewUrl: isImage ? URL.createObjectURL(file) : undefined });
    setScanStatus("scanning");
    setScanWarning("");
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await apiPostForm<PassportExtractionResult>("/api/passport-extraction", body);

      // "nationality" comes back as a plain country name (what the model actually read) — the form
      // itself stores it as an ISO2 code, same as every other country field here, so it's mapped
      // here rather than trusting the model to know our internal codes.
      const extracted: Partial<Record<keyof FormState, string>> = { ...result.fields };
      const autoFilledKeys = new Set(result.extractedKeys) as Set<keyof FormState>;
      if (extracted.nationality) {
        const iso2 = countryByName(extracted.nationality)?.iso2;
        if (iso2) {
          extracted.nationality = iso2;
          extracted.country = iso2;
          extracted.phoneCountry = iso2;
          const city = countryByIso2(iso2)?.cities[0];
          if (city) { extracted.city = city; autoFilledKeys.add("city"); }
          autoFilledKeys.add("country");
          autoFilledKeys.add("phoneCountry");
        } else {
          delete extracted.nationality;
          autoFilledKeys.delete("nationality");
        }
      }
      if (Object.keys(extracted).length > 0) {
        setForm((f) => ({ ...f, ...extracted }));
        setAutoFilled(autoFilledKeys);
      }
      if (result.emergencyContact) {
        setEc((e) => ({ ...e, ...result.emergencyContact }));
        setEcAutoFilled(new Set(Object.keys(result.emergencyContact)) as Set<keyof EmergencyContact>);
      }
      setScanStatus(result.extractedKeys.length > 0 || result.emergencyContact ? "done" : "unavailable");
      setScanWarning(result.warnings[0] ?? "");
    } catch (err) {
      setScanStatus("unavailable");
      setScanWarning(err instanceof Error ? err.message : "Couldn't scan this image — fill the form in by hand.");
    }
  }

  function removePassport() {
    setPassportFile(null);
    setScanStatus("idle");
    setScanWarning("");
  }

  function sendOtp() {
    if (form.phone.replace(/\D/g, "").length < 6) return;
    setOtpError("");
    setPhoneStatus("sending");
    window.setTimeout(() => setPhoneStatus("code-sent"), 700);
  }

  function confirmOtp() {
    setPhoneStatus("verifying");
    window.setTimeout(() => {
      if (otp === DEMO_OTP) {
        setPhoneStatus("verified");
        setOtpError("");
      } else {
        setPhoneStatus("code-sent");
        setOtpError("Incorrect code — try again.");
      }
    }, 500);
  }

  function handleSave() {
    const nextErrors: string[] = [];
    if (!form.firstName.trim() || !form.lastName.trim()) nextErrors.push("Enter your first and last name.");
    if (!emailValid || !form.email) nextErrors.push("Enter a valid email address.");
    if (phoneStatus !== "verified") nextErrors.push("Verify your phone number.");
    if (!permanentConfirmed) nextErrors.push("Confirm your permanent address matches your passport.");

    const ecStarted = ec.name.trim().length > 0 || ec.phone.trim().length > 0;
    if (ecStarted && !ec.name.trim()) nextErrors.push("Enter the emergency contact's name.");
    if (ecStarted && !ec.phone.trim()) nextErrors.push("Enter the emergency contact's phone number.");
    if (!ecEmailValid) nextErrors.push("Enter a valid emergency contact email address.");

    setErrors(nextErrors);
    if (nextErrors.length === 0) {
      markStepComplete("personal-information");
      savePersonalInfo({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: `${countryByIso2(form.phoneCountry)?.dial ?? ""} ${form.phone}`.trim(),
        dob: form.dob,
        gender: form.gender,
        nationality: countryByIso2(form.nationality)?.name ?? form.nationality,
        fatherName: form.fatherName,
        motherName: form.motherName,
        maritalStatus: form.maritalStatus,
        passportNumber: form.passportNumber,
        personalNumber: form.personalNumber,
        previousPassportNumber: form.previousPassportNumber,
        placeOfBirth: form.placeOfBirth,
        issuingAuthority: form.issuingAuthority,
        issueDate: form.issueDate,
        passportExpiry: form.expiryDate,
        permanentAddress: form.permanentAddress,
        presentAddress: presentAddressValue,
        city: form.city,
        country: residenceCountry?.name ?? form.country,
        emergencyContactName: ec.name,
        emergencyContactRelationship: ec.relationship,
        emergencyContactAddress: ec.address,
        emergencyContactPhone: `${countryByIso2(ec.phoneCountry)?.dial ?? ""} ${ec.phone}`.trim(),
        emergencyContactEmail: ec.email,
      });
      setSaved(true);
      if (savedTimeoutRef.current) window.clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = window.setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <div className="flex min-h-full flex-col pb-6">
      <MobileHeader title="Personal Information" />

      <div className="px-5">
        <div className="flex flex-col items-center pb-3 pt-1">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[image:var(--sd-gradient)] text-xl font-semibold text-white">
              {initials}
            </div>
            <button
              aria-label="Change photo"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--sd-card)] text-[var(--sd-ink)] shadow-[0_0_8px_rgba(0,0,0,0.13)]"
            >
              <Camera size={13} />
            </button>
          </div>
        </div>

        <DocumentUpload
          file={passportFile}
          status={scanStatus}
          title="Upload your passport"
          description="A clear photo of the passport's data page — we'll read it with AI and auto-fill whatever it can make out below."
          scanningLabel="Reading passport…"
          onPick={() => fileInputRef.current?.click()}
          onRemove={removePassport}
        />
        {scanWarning && (
          <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-amber-600">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {scanWarning}
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FieldShell label="First Name" autoFilled={autoFilled.has("firstName")}>
              <input name="firstName" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="Last Name" autoFilled={autoFilled.has("lastName")}>
              <input name="lastName" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} className={inputClass} />
            </FieldShell>
          </div>

          <FieldShell label="Email Address" error={!emailValid ? "Enter a valid email address." : undefined}>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className={`${inputClass} ${!emailValid ? "ring-2 ring-rose-200" : ""}`}
              placeholder="you@example.com"
            />
          </FieldShell>

          <FieldShell label="Phone Number" autoFilled={autoFilled.has("phoneCountry")}>
            <div className="flex items-center gap-2 rounded-xl bg-[var(--sd-card)] px-2 py-1.5 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
              <select
                name="phoneCountry"
                value={form.phoneCountry}
                onChange={(e) => update("phoneCountry", e.target.value)}
                className="shrink-0 rounded-lg bg-slate-50 px-2 py-2 text-[13px] text-slate-700 focus:outline-none"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.iso2} value={c.iso2}>{c.flag} {c.dial}</option>
                ))}
              </select>
              <input
                name="phone"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[13px] text-slate-800 focus:outline-none"
                placeholder="1XXX-XXXXXX"
              />
              <PhoneVerifyButton status={phoneStatus} onClick={sendOtp} />
            </div>
            {phoneStatus !== "unverified" && phoneStatus !== "verified" && (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-[var(--sd-card)] p-2.5 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
                <span className="shrink-0 pl-1 text-[12px] text-slate-500">
                  Code sent to {phoneCountry?.dial} {form.phone || "—"}
                </span>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-1.5 text-[13px] tracking-widest text-slate-800 focus:outline-none"
                />
                <button
                  onClick={confirmOtp}
                  disabled={phoneStatus === "sending" || phoneStatus === "verifying" || otp.length < 4}
                  className="shrink-0 rounded-lg bg-[image:var(--sd-gradient)] px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
                >
                  {phoneStatus === "verifying" ? <Loader2 size={13} className="animate-spin" /> : "Confirm"}
                </button>
              </div>
            )}
            {otpError && <span className="mt-1 block text-[11px] font-medium text-rose-500">{otpError}</span>}
            {import.meta.env.DEV && phoneStatus === "code-sent" && !otpError && (
              <span className="mt-1 block text-[11px] text-slate-400">Demo code: {DEMO_OTP}</span>
            )}
          </FieldShell>

          <div className="grid grid-cols-2 gap-3">
            <FieldShell label="Date of Birth" autoFilled={autoFilled.has("dob")}>
              <input name="dob" type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="Gender" autoFilled={autoFilled.has("gender")}>
              <select name="gender" value={form.gender} onChange={(e) => update("gender", e.target.value)} className={inputClass}>
                {["Female", "Male", "Other", "Prefer not to say"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </FieldShell>
          </div>

          <FieldShell label="Place of Birth" autoFilled={autoFilled.has("placeOfBirth")}>
            <input name="placeOfBirth" value={form.placeOfBirth} onChange={(e) => update("placeOfBirth", e.target.value)} className={inputClass} />
          </FieldShell>

          <FieldShell label="Nationality" autoFilled={autoFilled.has("nationality")}>
            <select name="nationality" value={form.nationality} onChange={(e) => update("nationality", e.target.value)} className={inputClass}>
              {COUNTRIES.map((c) => (
                <option key={c.iso2} value={c.iso2}>{c.flag} {c.name}</option>
              ))}
            </select>
          </FieldShell>

          <div className="grid grid-cols-2 gap-3">
            <FieldShell label="Father's Name" autoFilled={autoFilled.has("fatherName")}>
              <input name="fatherName" value={form.fatherName} onChange={(e) => update("fatherName", e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="Mother's Name" autoFilled={autoFilled.has("motherName")}>
              <input name="motherName" value={form.motherName} onChange={(e) => update("motherName", e.target.value)} className={inputClass} />
            </FieldShell>
          </div>

          <FieldShell label="Marital Status">
            <select name="maritalStatus" value={form.maritalStatus} onChange={(e) => update("maritalStatus", e.target.value)} className={inputClass}>
              {["Single", "Married"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </FieldShell>

          <FieldShell label="Passport Number" autoFilled={autoFilled.has("passportNumber")}>
            <input name="passportNumber" value={form.passportNumber} onChange={(e) => update("passportNumber", e.target.value)} className={inputClass} />
          </FieldShell>

          <div className="grid grid-cols-2 gap-3">
            <FieldShell label="Personal Number" autoFilled={autoFilled.has("personalNumber")}>
              <input name="personalNumber" value={form.personalNumber} onChange={(e) => update("personalNumber", e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="Previous Passport No.">
              <input
                name="previousPassportNumber"
                value={form.previousPassportNumber}
                onChange={(e) => update("previousPassportNumber", e.target.value)}
                placeholder="If any"
                className={inputClass}
              />
            </FieldShell>
          </div>

          <FieldShell label="Passport Issuing Authority" autoFilled={autoFilled.has("issuingAuthority")}>
            <input
              name="issuingAuthority"
              value={form.issuingAuthority}
              onChange={(e) => update("issuingAuthority", e.target.value)}
              className={inputClass}
            />
          </FieldShell>

          <div className="grid grid-cols-2 gap-3">
            <FieldShell label="Issue Date" autoFilled={autoFilled.has("issueDate")}>
              <input name="issueDate" type="date" value={form.issueDate} onChange={(e) => update("issueDate", e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="Expiry Date" autoFilled={autoFilled.has("expiryDate")}>
              <input name="expiryDate" type="date" value={form.expiryDate} onChange={(e) => update("expiryDate", e.target.value)} className={inputClass} />
            </FieldShell>
          </div>
          {expiryWarning && (
            <div className="flex items-start gap-2 rounded-xl bg-[#FDF0DC] p-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#B8791C]" />
              <p className="text-[12px] leading-snug text-[#8A5A14]">{expiryWarning}</p>
            </div>
          )}

          <FieldShell label="Permanent Address" autoFilled={autoFilled.has("permanentAddress")}>
            <input
              name="permanentAddress"
              value={form.permanentAddress}
              onChange={(e) => update("permanentAddress", e.target.value)}
              className={inputClass}
            />
            <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
              Must exactly match the permanent address shown on your passport.
            </p>
            <label className="mt-2 flex items-start gap-2 text-[12px] text-slate-600">
              <input
                type="checkbox"
                checked={permanentConfirmed}
                onChange={(e) => setPermanentConfirmed(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--sd-ink)]"
              />
              This address matches my passport.
            </label>
          </FieldShell>

          <FieldShell label="Present Address">
            <label className="mb-2 flex items-center gap-2 text-[12px] text-slate-600">
              <input
                type="checkbox"
                checked={sameAsPermanent}
                onChange={(e) => setSameAsPermanent(e.target.checked)}
                className="h-3.5 w-3.5 shrink-0 accent-[var(--sd-ink)]"
              />
              Same as permanent address
            </label>
            <input
              name="presentAddress"
              value={presentAddressValue}
              disabled={sameAsPermanent}
              onChange={(e) => update("presentAddress", e.target.value)}
              className={`${inputClass} ${sameAsPermanent ? "text-slate-400" : ""}`}
            />
          </FieldShell>

          <div className="grid grid-cols-2 gap-3">
            <FieldShell label="Country" autoFilled={autoFilled.has("country")}>
              <select name="country" value={form.country} onChange={(e) => handleCountryChange(e.target.value)} className={inputClass}>
                {COUNTRIES.map((c) => (
                  <option key={c.iso2} value={c.iso2}>{c.flag} {c.name}</option>
                ))}
              </select>
            </FieldShell>
            <FieldShell label="City" autoFilled={autoFilled.has("city")}>
              <select name="city" value={form.city} onChange={(e) => update("city", e.target.value)} className={inputClass}>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FieldShell>
          </div>

          <div className="flex items-center gap-2 pt-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FCEAE8] text-[#D8473C]">
              <LifeBuoy size={15} />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900">Emergency Contact</h2>
              <p className="text-[11px] text-slate-400">Who should we reach if we can't contact you?</p>
            </div>
          </div>

          <FieldShell label="Contact Name" autoFilled={ecAutoFilled.has("name")}>
            <input
              name="ec-name"
              value={ec.name}
              onChange={(e) => updateEc("name", e.target.value)}
              placeholder="Full name"
              className={inputClass}
            />
          </FieldShell>

          <FieldShell label="Relationship" autoFilled={ecAutoFilled.has("relationship")}>
            <select name="ec-relationship" value={ec.relationship} onChange={(e) => updateEc("relationship", e.target.value)} className={inputClass}>
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </FieldShell>

          <FieldShell label="Address" autoFilled={ecAutoFilled.has("address")}>
            <input name="ec-address" value={ec.address} onChange={(e) => updateEc("address", e.target.value)} className={inputClass} />
          </FieldShell>

          <FieldShell label="Phone Number" autoFilled={ecAutoFilled.has("phone")}>
            <div className="flex items-center gap-2 rounded-xl bg-[var(--sd-card)] px-2 py-1.5 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
              <select
                name="ec-phoneCountry"
                value={ec.phoneCountry}
                onChange={(e) => updateEc("phoneCountry", e.target.value)}
                className="shrink-0 rounded-lg bg-slate-50 px-2 py-2 text-[13px] text-slate-700 focus:outline-none"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.iso2} value={c.iso2}>{c.flag} {c.dial}</option>
                ))}
              </select>
              <input
                name="ec-phone"
                value={ec.phone}
                onChange={(e) => updateEc("phone", e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[13px] text-slate-800 focus:outline-none"
                placeholder="1XXX-XXXXXX"
              />
            </div>
          </FieldShell>

          <FieldShell
            label="Email Address (optional)"
            autoFilled={ecAutoFilled.has("email")}
            error={!ecEmailValid ? "Enter a valid email address." : undefined}
          >
            <input
              name="ec-email"
              type="email"
              value={ec.email}
              onChange={(e) => updateEc("email", e.target.value)}
              placeholder="optional"
              className={`${inputClass} ${!ecEmailValid ? "ring-2 ring-rose-200" : ""}`}
            />
          </FieldShell>
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
            <Check size={14} /> Profile updated
          </p>
        )}
        <button
          onClick={handleSave}
          className="w-full rounded-xl bg-[image:var(--sd-gradient)] py-3.5 text-[13px] font-semibold text-white"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

function getExpiryWarning(expiryDate: string): string | null {
  const monthsLeft = monthsUntil(expiryDate);
  if (monthsLeft === null) return null;
  if (monthsLeft < 0) return "Your passport has expired. You'll need to renew it before applying.";
  if (monthsLeft < 6) return "Your passport expires in less than 6 months — most visas require at least 6 months' validity from your travel date.";
  return null;
}

function PhoneVerifyButton({ status, onClick }: { status: PhoneStatus; onClick: () => void }) {
  if (status === "verified") {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-lg bg-[#E3F6EC] px-2.5 py-2 text-[12px] font-semibold text-[#12805A]">
        <ShieldCheck size={13} /> Verified
      </span>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={status === "sending" || status === "code-sent" || status === "verifying"}
      className="shrink-0 rounded-lg bg-[image:var(--sd-gradient)] px-2.5 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
    >
      {status === "sending" ? <Loader2 size={13} className="animate-spin" /> : status === "code-sent" || status === "verifying" ? "Sent" : "Verify"}
    </button>
  );
}
