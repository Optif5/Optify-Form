import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import optifyLogo from "@/assets/optify-logo.png";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Optify — Restaurant Operations Diagnostic" },
      {
        name: "description",
        content:
          "Optify redesigns how restaurants operate. Begin a structured diagnostic for your outlets.",
      },
      { property: "og:title", content: "Optify — Restaurant Operations Diagnostic" },
      {
        property: "og:description",
        content: "Calm. Precise. Strategic. Begin the Optify restaurant diagnostic.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: IntakePage,
});

/* ---------------- Schema ---------------- */

const OUTLETS = [
  "1 outlet / cloud kitchen",
  "2–6 outlets",
  "6–10 outlets",
  "10+ outlets",
] as const;

const TEAM_SIZES = [
  "1–20 team members",
  "21–29 team members",
  "30–70 team members",
  "70+ team members",
] as const;

const CHALLENGES = [
  "Staff mistakes",
  "Wastage control",
  "No clear SOPs",
  "Poor task tracking",
  "Training inconsistency",
  "Scaling feels chaotic",
  "Lack of real-time visibility",
  "Other",
] as const;

const CONTACT_METHODS = ["WhatsApp", "Phone Call", "Email", "Instagram"] as const;
type ContactMethod = (typeof CONTACT_METHODS)[number];

const handleRegex = /^@?[a-zA-Z0-9._]{2,30}$/;

type CountryOption = {
  iso2: string;
  name: string;
  dialCode: string;
};

type FormState = {
  fullName: string;
  restaurantName: string;
  outlets: (typeof OUTLETS)[number] | "";
  teamSize: (typeof TEAM_SIZES)[number] | "";
  challenges: (typeof CHALLENGES)[number][];
  otherChallenge: string;
  preferredContactMethod: ContactMethod | "";
  selectedPhoneCountry: string;
  phoneNationalNumber: string;
  contactDetail: string;
};

const EMPTY: FormState = {
  fullName: "",
  restaurantName: "",
  outlets: "",
  teamSize: "",
  challenges: [],
  otherChallenge: "",
  preferredContactMethod: "",
  selectedPhoneCountry: "",
  phoneNationalNumber: "",
  contactDetail: "",
};

const FALLBACK_COUNTRIES: CountryOption[] = [
  { iso2: "US", name: "United States", dialCode: "+1" },
  { iso2: "GB", name: "United Kingdom", dialCode: "+44" },
  { iso2: "SA", name: "Saudi Arabia", dialCode: "+966" },
];

const TOTAL_STEPS = 5;

/* ---------------- Page ---------------- */

function IntakePage() {
  const [values, setValues] = useState<FormState>(EMPTY);
  const [step, setStep] = useState(0); // 0..4 question cards, 5 = review
  const [direction, setDirection] = useState<1 | -1>(1);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>(FALLBACK_COUNTRIES);

  useEffect(() => {
    const controller = new AbortController();
    fetch("https://restcountries.com/v3.1/all?fields=name,idd,cca2", {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Country list request failed");
        return res.json() as Promise<
          { cca2?: string; name?: { common?: string }; idd?: { root?: string; suffixes?: string[] } }[]
        >;
      })
      .then((rows) => {
        const opts = rows
          .flatMap((c) => {
            if (!c.cca2 || !c.name?.common || !c.idd?.root || !c.idd?.suffixes?.length) return [];
            return c.idd.suffixes.map((suffix) => ({
              iso2: c.cca2,
              name: c.name!.common!,
              dialCode: `${c.idd!.root!}${suffix}`,
            }));
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        if (opts.length > 0) setCountryOptions(opts);
      })
      .catch((err) => {
        console.warn("[Optify] Failed to load full country calling code list:", err);
      });
    return () => controller.abort();
  }, []);

  function setField<K extends keyof FormState>(key: K, v: FormState[K]) {
    setValues((s) => ({ ...s, [key]: v }));
    setFieldError(null);
  }

  function toggleChallenge(option: (typeof CHALLENGES)[number]) {
    setValues((s) => {
      const exists = s.challenges.includes(option);
      const next = exists
        ? s.challenges.filter((o) => o !== option)
        : [...s.challenges, option];
      return { ...s, challenges: next };
    });
    setFieldError(null);
  }

  const stepValid = useMemo(() => stepIsValid(step, values), [step, values]);

  function next() {
    const err = stepError(step, values);
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError(null);
    setDirection(1);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function back() {
    setFieldError(null);
    setDirection(-1);
    setStep((s) => Math.max(0, s - 1));
  }

  function goToStep(target: number) {
    if (target === step) return;
    if (target < 0 || target >= TOTAL_STEPS) return;
    if (target > step) {
      // Only allow forward jumps if all intermediate steps are valid
      for (let s = step; s < target; s++) {
        const err = stepError(s, values);
        if (err) {
          setFieldError(err);
          return;
        }
      }
    }
    setFieldError(null);
    setDirection(target > step ? 1 : -1);
    setStep(target);
  }

  async function submit() {
    // Final validation across all steps before sending
    for (let s = 0; s < TOTAL_STEPS; s++) {
      const err = stepError(s, values);
      if (err) {
        setStep(s);
        setFieldError(err);
        setStatus("idle");
        return;
      }
    }

    setStatus("submitting");
    setFieldError(null);

    const payload = {
      fullName: values.fullName.trim(),
      restaurantName: values.restaurantName.trim(),
      outlets: values.outlets,
      teamSize: values.teamSize,
      challenges: values.challenges,
      otherChallenge: values.challenges.includes("Other") ? values.otherChallenge.trim() : "",
      preferredContactMethod: values.preferredContactMethod,
      contactDetail: values.contactDetail.trim(),
    };

    try {
      const res = await fetch(
        "https://script.google.com/a/macros/optify.ae/s/AKfycbyuGEuTOey17yaERwv_VE5kLdBEKWW6sqh3ZJvSrb8sl6xsnKEAm5gApRmImFZ9XBUqYg/exec",
        {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      // With no-cors, response is opaque; treat reaching here as success.
      void res;
      setStatus("done");
    } catch (e) {
      console.error("[Optify] Submission failed:", e);
      setFieldError("Submission failed. Please try again.");
      setStatus("error");
    }
  }

  function reset() {
    setValues(EMPTY);
    setStep(0);
    setStatus("idle");
    setDirection(1);
  }

  return (
    <div className="relative min-h-screen overflow-hidden contour-bg">
      {/* Header */}
      <header className="relative z-30 px-5 sm:px-8 md:px-12 pt-6 pb-4 flex items-center justify-between">
        <img
          src={optifyLogo}
          alt="Optify"
          className="h-14 sm:h-16 md:h-20 w-auto select-none"
          draggable={false}
        />
      </header>

      {/* Echo wordmark */}
      <div aria-hidden className="pointer-events-none absolute -right-10 -bottom-10 select-none">
        <span className="echo-text font-medium tracking-tight text-[28vw] sm:text-[22vw] md:text-[18vw] leading-none">
          optify
        </span>
      </div>

      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-8 pt-4 sm:pt-10 pb-16">
        {status === "done" ? (
          <Confirmation onReset={reset} />
        ) : (
          <>
            {/* Stack viewport */}
            <div className="relative mx-auto w-full max-w-xl">
              {/* Stacked ghost cards behind */}
              <StackBackdrop step={step} total={TOTAL_STEPS + 1} />

              {/* Active card */}
              <div className="relative" style={{ minHeight: 460 }}>
                <AnimatePresence custom={direction} mode="wait">
                  <motion.div
                    key={step}
                    custom={direction}
                    initial={{ opacity: 0, y: direction === 1 ? 60 : -40, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: direction === 1 ? -80 : 60, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.9 }}
                    className="relative"
                  >
                    <CardShell
                      indexLabel={step >= TOTAL_STEPS ? "06" : String(step + 1).padStart(2, "0")}
                      caption={STEP_META[step].caption}
                      title={STEP_META[step].title}
                    >
                      {step === 0 && (
                        <div className="grid grid-cols-1 gap-4">
                          <TextField
                            id="fullName"
                            label="Full name"
                            value={values.fullName}
                            onChange={(v) => setField("fullName", v)}
                            placeholder="Your full name"
                            autoComplete="name"
                          />
                          <TextField
                            id="restaurantName"
                            label="Restaurant / brand"
                            value={values.restaurantName}
                            onChange={(v) => setField("restaurantName", v)}
                            placeholder="e.g. Lumière Kitchen"
                            autoComplete="organization"
                          />
                        </div>
                      )}

                      {step === 1 && (
                        <SelectGrid
                          value={values.outlets}
                          onSelect={(v) => setField("outlets", v as FormState["outlets"])}
                          options={OUTLETS as readonly string[]}
                        />
                      )}

                      {step === 2 && (
                        <SelectGrid
                          value={values.teamSize}
                          onSelect={(v) => setField("teamSize", v as FormState["teamSize"])}
                          options={TEAM_SIZES as readonly string[]}
                        />
                      )}

                      {step === 3 && (
                        <>
                          <p className="label-micro mb-4">SELECT ALL THAT APPLY</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {CHALLENGES.map((opt) => {
                              const selected = values.challenges.includes(opt);
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => toggleChallenge(opt)}
                                  className={`tactile flex items-center gap-3 text-left px-4 py-3.5 rounded-2xl border transition-all ${
                                    selected
                                      ? "border-primary/50 bg-primary/[0.06]"
                                      : "border-border bg-background/50 hover:bg-background"
                                  }`}
                                >
                                  <span
                                    className={`flex items-center justify-center w-5 h-5 rounded-md border transition-colors ${
                                      selected ? "bg-primary border-primary" : "border-foreground/25"
                                    }`}
                                    aria-hidden
                                  >
                                    {selected && (
                                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path
                                          d="M2 6.5L5 9.5L10 3"
                                          stroke="currentColor"
                                          strokeWidth="1.6"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="text-primary-foreground"
                                        />
                                      </svg>
                                    )}
                                  </span>
                                  <span className="text-[15px]">{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                          {values.challenges.includes("Other") && (
                            <div className="mt-4">
                              <TextField
                                id="otherChallenge"
                                label="Tell us more"
                                value={values.otherChallenge}
                                onChange={(v) => setField("otherChallenge", v)}
                                placeholder="Describe the challenge in a sentence"
                                maxLength={280}
                              />
                            </div>
                          )}
                        </>
                      )}

                      {step === 4 && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            {CONTACT_METHODS.map((m) => {
                              const selected = values.preferredContactMethod === m;
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => {
                                    setValues((s) => ({
                                      ...s,
                                      preferredContactMethod: m,
                                      contactDetail: "",
                                      phoneNationalNumber: "",
                                      selectedPhoneCountry: "",
                                    }));
                                    setFieldError(null);
                                  }}
                                  className={`tactile px-4 py-3.5 rounded-2xl border text-[15px] transition-all ${
                                    selected
                                      ? "border-primary/55 bg-primary/[0.08] text-primary"
                                      : "border-border bg-background/50 hover:bg-background"
                                  }`}
                                >
                                  {m}
                                </button>
                              );
                            })}
                          </div>

                          {values.preferredContactMethod &&
                            values.preferredContactMethod !== "WhatsApp" &&
                            values.preferredContactMethod !== "Phone Call" && (
                            <div className="mt-4">
                              <TextField
                                id="contactDetail"
                                label={contactLabel(values.preferredContactMethod)}
                                value={values.contactDetail}
                                onChange={(v) => setField("contactDetail", v)}
                                type={values.preferredContactMethod === "Email" ? "email" : "text"}
                                inputMode={
                                  values.preferredContactMethod === "WhatsApp" ||
                                  values.preferredContactMethod === "Phone Call"
                                    ? "tel"
                                    : values.preferredContactMethod === "Email"
                                    ? "email"
                                    : "text"
                                }
                                placeholder={contactPlaceholder(values.preferredContactMethod)}
                                autoComplete={
                                  values.preferredContactMethod === "Email"
                                    ? "email"
                                    : values.preferredContactMethod === "WhatsApp" ||
                                      values.preferredContactMethod === "Phone Call"
                                    ? "tel"
                                    : "off"
                                }
                              />
                            </div>
                          )}

                          {(values.preferredContactMethod === "WhatsApp" ||
                            values.preferredContactMethod === "Phone Call") && (
                            <div className="mt-4">
                              <InternationalPhoneField
                                id="contactPhone"
                                label={contactLabel(values.preferredContactMethod)}
                                countries={countryOptions}
                                selectedCountry={values.selectedPhoneCountry}
                                nationalNumber={values.phoneNationalNumber}
                                onChange={(next) => {
                                  setValues((s) => ({
                                    ...s,
                                    selectedPhoneCountry: next.countryIso2,
                                    phoneNationalNumber: next.localNumber,
                                    contactDetail: next.e164,
                                  }));
                                  setFieldError(null);
                                }}
                              />
                            </div>
                          )}
                        </>
                      )}

                      {step === TOTAL_STEPS && <ReviewSummary values={values} />}

                      {fieldError && (
                        <p className="label-micro text-primary mt-4">{fieldError}</p>
                      )}

                      {/* Card actions */}
                      <div className="mt-7 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={back}
                          disabled={step === 0 || status === "submitting"}
                          className="tactile inline-flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border border-border bg-background/50 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden>
                            <path
                              d="M13 5H1m0 0l4-4M1 5l4 4"
                              stroke="currentColor"
                              strokeWidth="1.25"
                              strokeLinecap="square"
                            />
                          </svg>
                          Back
                        </button>

                        {step < TOTAL_STEPS ? (
                          <button
                            type="button"
                            onClick={next}
                            disabled={!stepValid}
                            className={`tactile inline-flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-2xl text-primary-foreground bg-primary disabled:opacity-40 disabled:cursor-not-allowed`}
                            style={{ boxShadow: "var(--bloom-soft)" }}
                          >
                            Continue
                            <svg width="16" height="10" viewBox="0 0 18 10" fill="none" aria-hidden>
                              <path
                                d="M1 5h15m0 0L12 1m4 4l-4 4"
                                stroke="currentColor"
                                strokeWidth="1.25"
                                strokeLinecap="square"
                              />
                            </svg>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={submit}
                            disabled={status === "submitting"}
                            className="tactile idle-pulse inline-flex items-center gap-3 px-6 py-3 text-sm font-medium rounded-2xl text-primary-foreground bg-primary disabled:opacity-80"
                            style={{ boxShadow: "var(--bloom-soft)" }}
                          >
                            {status === "submitting" ? (
                              <>
                                <Spinner />
                                <span className="label-micro text-primary-foreground/90">
                                  SYSTEM PROCESSING
                                </span>
                              </>
                            ) : (
                              <>
                                Submit assessment
                                <svg width="16" height="10" viewBox="0 0 18 10" fill="none" aria-hidden>
                                  <path
                                    d="M1 5h15m0 0L12 1m4 4l-4 4"
                                    stroke="currentColor"
                                    strokeWidth="1.25"
                                    strokeLinecap="square"
                                  />
                                </svg>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </CardShell>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Progress indicator — numbered dots */}
              <nav
                aria-label="Form progress"
                className="mt-7 flex items-center justify-center gap-3 sm:gap-4"
              >
                {Array.from({ length: TOTAL_STEPS + 1 }).map((_, i) => {
                  const isActive = i === step;
                  const isComplete = i < step;
                  const isFinalCheck = i === TOTAL_STEPS;
                  const showCheck = isComplete || (isFinalCheck && !isActive);
                  // Allow click on real step circles (not the final review check),
                  // either backward to any prior step or forward only when all
                  // intermediate steps are valid.
                  let canClick = false;
                  if (!isActive && !isFinalCheck) {
                    if (i < step) {
                      canClick = true;
                    } else {
                      canClick = true;
                      for (let s = step; s < i; s++) {
                        if (stepError(s, values)) {
                          canClick = false;
                          break;
                        }
                      }
                    }
                  }
                  const baseClass = `flex items-center justify-center rounded-full font-medium tabular-nums transition-all duration-500 ease-out ${
                    isActive
                      ? "h-8 w-8 text-[12px] bg-primary text-primary-foreground"
                      : showCheck
                      ? "h-6 w-6 text-[11px] border border-primary/40 text-primary/70 bg-primary/[0.06]"
                      : "h-6 w-6 text-[11px] border border-foreground/15 text-foreground/35 bg-transparent"
                  }`;
                  if (canClick) {
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => goToStep(i)}
                        aria-label={`Go to step ${i + 1}`}
                        className={`${baseClass} cursor-pointer hover:bg-primary/15 hover:border-primary/60 hover:text-primary hover:shadow-[var(--bloom-soft)] focus:outline-none focus-visible:shadow-[var(--bloom-focus)]`}
                      >
                        {showCheck ? "✓" : i + 1}
                      </button>
                    );
                  }
                  return (
                    <span
                      key={i}
                      aria-current={isActive ? "step" : undefined}
                      className={baseClass}
                      style={isActive ? { boxShadow: "var(--bloom-soft)" } : undefined}
                    >
                      {showCheck ? "✓" : i + 1}
                    </span>
                  );
                })}
              </nav>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ---------------- Step config & validation ---------------- */

const STEP_META: { caption: string; title: string }[] = [
  { caption: "YOUR DETAILS", title: "Let's start with your identity." },
  { caption: "OPERATION SIZE", title: "How many outlets do you currently operate?" },
  { caption: "TEAM STRUCTURE", title: "What is your current team size?" },
  { caption: "SYSTEM GAPS", title: "What are your biggest operational challenges?" },
  { caption: "CONTACT CHANNEL", title: "How should we reach you?" },
  { caption: "READY TO SEND", title: "Review your details before submission." },
];

function stepIsValid(step: number, v: FormState): boolean {
  return stepError(step, v) === null;
}

function stepError(step: number, v: FormState): string | null {
  switch (step) {
    case 0:
      if (v.fullName.trim().length < 2) return "Enter your full name";
      if (v.restaurantName.trim().length < 2) return "Enter your restaurant or brand";
      return null;
    case 1:
      return v.outlets ? null : "Select an option";
    case 2:
      return v.teamSize ? null : "Select an option";
    case 3:
      if (v.challenges.length === 0) return "Select at least one challenge";
      if (v.challenges.includes("Other") && !v.otherChallenge.trim())
        return "Tell us a bit more about the other challenge";
      return null;
    case 4: {
      if (!v.preferredContactMethod) return "Choose a contact channel";
      const m = v.preferredContactMethod;
      const val = v.contactDetail.trim();
      if (val.length < 2) return "Enter your contact detail";
      if (m === "WhatsApp" || m === "Phone Call") {
        if (!v.selectedPhoneCountry) return "Select a country/region code";
        if (!isReasonablyValidInternationalPhone(val)) return "Enter a valid phone number";
      }
      if (m === "Email" && !z.string().email().safeParse(val).success)
        return "Enter a valid email";
      if (m === "Instagram" && !handleRegex.test(val))
        return "Enter a valid handle (e.g. @yourbrand)";
      return null;
    }
    default:
      return null;
  }
}

/* ---------------- Pieces ---------------- */

function contactLabel(m: ContactMethod) {
  switch (m) {
    case "WhatsApp": return "WhatsApp number";
    case "Phone Call": return "Phone number";
    case "Email": return "Email address";
    case "Instagram": return "Instagram handle";
  }
}
function contactPlaceholder(m: ContactMethod) {
  switch (m) {
    case "WhatsApp": return "98xxx xxxxx";
    case "Phone Call": return "98xxx xxxxx";
    case "Email": return "you@brand.com";
    case "Instagram": return "@yourbrand";
  }
}

function normalizePhoneDigits(raw: string) {
  return raw.replace(/[^\d]/g, "");
}

function composeE164(dialCode: string, localNumber: string) {
  const normalizedDialCode = dialCode.startsWith("+") ? dialCode : `+${dialCode}`;
  const localDigits = normalizePhoneDigits(localNumber);
  return `${normalizedDialCode}${localDigits}`;
}

function isReasonablyValidInternationalPhone(value: string) {
  if (!/^\+\d{8,15}$/.test(value)) return false;
  return !/^(\+\d)\1+$/.test(value);
}

function countryFlag(iso2: string) {
  if (!/^[A-Z]{2}$/.test(iso2)) return "🏳️";
  return String.fromCodePoint(...iso2.split("").map((char) => 127397 + char.charCodeAt(0)));
}

const COUNTRY_SHORT_LABELS: Record<string, string> = {
  IN: "IND",
  SA: "KSA",
};

function countryShortLabel(country: CountryOption) {
  return COUNTRY_SHORT_LABELS[country.iso2] ?? country.name;
}

function StackBackdrop({ step, total }: { step: number; total: number }) {
  const remaining = Math.max(0, total - step - 1);
  const ghosts = Math.min(2, remaining);
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      {Array.from({ length: ghosts }).map((_, i) => {
        const depth = i + 1;
        return (
          <div
            key={i}
            className="absolute left-1/2 -translate-x-1/2 rounded-3xl border border-border bg-card/60 backdrop-blur-md"
            style={{
              top: depth * 14,
              width: `calc(100% - ${depth * 28}px)`,
              height: "100%",
              opacity: 1 - depth * 0.35,
              boxShadow: "var(--bloom-soft)",
              zIndex: -depth,
            }}
          />
        );
      })}
    </div>
  );
}

function CardShell({
  indexLabel, caption, title, children,
}: {
  indexLabel: string;
  caption: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="relative rounded-3xl border border-border bg-card/85 backdrop-blur-md p-6 sm:p-8"
      style={{ boxShadow: "var(--bloom-soft)" }}
    >
      <div className="mb-5">
        <div className="label-micro flex items-center gap-2.5">
          <span className="tabular-nums">{indexLabel}</span>
          <span className="w-3 h-px bg-primary/60" />
          <span>{caption}</span>
        </div>
        <h2 className="mt-3 text-xl sm:text-2xl font-medium tracking-tight text-foreground leading-snug">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function TextField({
  id, label, value, onChange, type = "text", placeholder, autoComplete, maxLength, inputMode,
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; type?: string; placeholder?: string;
  autoComplete?: string; maxLength?: number;
  inputMode?: "text" | "tel" | "email" | "numeric";
}) {
  return (
    <div className="reactive-focus relative rounded-2xl border border-border bg-background/60 px-5 pt-3 pb-3.5">
      <label htmlFor={id} className="label-micro">{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full bg-transparent outline-none text-base sm:text-lg placeholder:text-foreground/30 tracking-tight"
      />
    </div>
  );
}

function InternationalPhoneField({
  id,
  label,
  countries,
  selectedCountry,
  nationalNumber,
  onChange,
}: {
  id: string;
  label: string;
  countries: CountryOption[];
  selectedCountry: string;
  nationalNumber: string;
  onChange: (next: { countryIso2: string; localNumber: string; e164: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCountry = countries.find((c) => c.iso2 === selectedCountry) ?? countries[0];
  const triggerLabel = activeCountry
    ? `${countryShortLabel(activeCountry)} (${activeCountry.dialCode})`
    : "Select country";

  return (
    <div className="reactive-focus relative rounded-2xl border border-border bg-background/60 px-5 pt-3 pb-3.5">
      <label htmlFor={id} className="label-micro">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="tactile inline-flex min-w-0 max-w-[58%] items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm hover:bg-background focus:outline-none focus-visible:shadow-[var(--bloom-focus)]"
              aria-label="Select country code"
            >
              {activeCountry && <span aria-hidden>{countryFlag(activeCountry.iso2)}</span>}
              <span className="truncate">{triggerLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[320px] p-0">
            <Command>
              <CommandInput placeholder="Search country or code..." />
              <CommandList>
                <CommandEmpty>No country found.</CommandEmpty>
                {countries.map((country) => (
                  <CommandItem
                    key={`${country.iso2}-${country.dialCode}`}
                    value={`${country.name} ${countryShortLabel(country)} ${country.dialCode} ${country.iso2}`}
                    onSelect={() => {
                      const e164 = composeE164(country.dialCode, nationalNumber);
                      onChange({
                        countryIso2: country.iso2,
                        localNumber: nationalNumber,
                        e164,
                      });
                      setOpen(false);
                    }}
                    className="justify-between"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2 truncate">
                      <span aria-hidden>{countryFlag(country.iso2)}</span>
                      <span className="truncate">{countryShortLabel(country)}</span>
                    </span>
                    <span className="ml-2 inline-flex items-center gap-2 text-muted-foreground">
                      {country.dialCode}
                      {selectedCountry === country.iso2 && <Check className="h-4 w-4 text-primary" />}
                    </span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <input
          id={id}
          name={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={nationalNumber}
          onChange={(e) => {
            const nextLocalNumber = e.target.value;
            const e164 = activeCountry ? composeE164(activeCountry.dialCode, nextLocalNumber) : "";
            onChange({
              countryIso2: activeCountry?.iso2 ?? "",
              localNumber: nextLocalNumber,
              e164,
            });
          }}
          placeholder="Phone number"
          className="min-w-0 flex-1 bg-transparent outline-none text-base sm:text-lg placeholder:text-foreground/30 tracking-tight"
        />
      </div>
    </div>
  );
}

function SelectGrid({
  value, onSelect, options,
}: {
  value: string; onSelect: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={`tactile flex items-center justify-between text-left px-5 py-4 rounded-2xl border transition-all ${
              selected
                ? "border-primary/55 bg-primary/[0.07]"
                : "border-border bg-background/50 hover:bg-background"
            }`}
          >
            <span className="text-[15px] sm:text-base">{opt}</span>
            <span
              className={`w-2.5 h-2.5 rounded-full border transition-colors ${
                selected ? "bg-primary border-primary" : "border-foreground/25"
              }`}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

function ReviewSummary({ values }: { values: FormState }) {
  const rows: { k: string; v: string }[] = [
    { k: "Name", v: values.fullName || "—" },
    { k: "Brand", v: values.restaurantName || "—" },
    { k: "Outlets", v: values.outlets || "—" },
    { k: "Team", v: values.teamSize || "—" },
    {
      k: "Challenges",
      v:
        values.challenges.length === 0
          ? "—"
          : values.challenges
              .map((c) =>
                c === "Other" && values.otherChallenge ? `Other: ${values.otherChallenge}` : c
              )
              .join(", "),
    },
    {
      k: "Contact",
      v:
        values.preferredContactMethod && values.contactDetail
          ? `${values.preferredContactMethod} — ${values.contactDetail}`
          : "—",
    },
  ];
  return (
    <dl className="divide-y divide-border rounded-2xl border border-border bg-background/40 overflow-hidden">
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-3 gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
          <dt className="label-micro col-span-1 self-center">{r.k}</dt>
          <dd className="col-span-2 text-[15px] text-foreground/85 break-words">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block w-3.5 h-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin"
    />
  );
}

function Confirmation({ onReset }: { onReset: () => void }) {
  return (
    <section
      className="enter mx-auto max-w-xl rounded-3xl border border-border bg-card/85 backdrop-blur-md p-8 sm:p-12 text-center"
      style={{ boxShadow: "var(--bloom-soft)" }}
    >
      <div className="mx-auto inline-flex items-center gap-2 label-micro">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        <span style={{ color: "var(--success)" }}>FORM COMPLETED</span>
      </div>
      <h2 className="mt-6 text-2xl sm:text-3xl font-medium tracking-tight">
        One of our consultants will contact you shortly.
      </h2>
      <button
        type="button"
        onClick={onReset}
        className="tactile mt-8 inline-flex items-center gap-3 px-6 py-3 text-sm font-medium tracking-wide text-primary border border-primary/40 rounded-2xl hover:bg-primary/5"
      >
        Submit another
      </button>
    </section>
  );
}
