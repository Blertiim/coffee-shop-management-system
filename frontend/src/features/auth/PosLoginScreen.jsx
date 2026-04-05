import { useMemo } from "react";

import { usePosApp } from "../../context/PosAppContext";
import PosKeypad from "../pos/components/PosKeypad";
import usePosLogin from "./usePosLogin";

const PIN_SLOT_COUNT = 4;

const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

const buildPinSlots = (pin) =>
  Array.from({ length: PIN_SLOT_COUNT }, (_, index) => ({
    key: `pin-slot-${index}`,
    filled: index < pin.length,
  }));

function SelectArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-none stroke-current">
      <path
        d="m5 7.5 5 5 5-5"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PosLoginScreen() {
  const { loginSuccess } = usePosApp();
  const {
    staffProfiles,
    selectedStaff,
    selectedStaffId,
    pin,
    error,
    isLoadingProfiles,
    isSubmitting,
    selectStaff,
    appendDigit,
    backspace,
    clearPin,
    submit,
  } = usePosLogin(loginSuccess);

  const selectedRole = useMemo(
    () => selectedStaff?.roleLabel || "Cafe staff",
    [selectedStaff]
  );
  const pinSlots = useMemo(() => buildPinSlots(pin), [pin]);

  return (
    <main className="pos-shell">
      <section className="relative overflow-hidden rounded-[28px] border border-[#182744] bg-[radial-gradient(circle_at_22%_22%,rgba(55,102,183,0.15)_0%,transparent_22%),radial-gradient(circle_at_76%_18%,rgba(31,67,128,0.1)_0%,transparent_18%),linear-gradient(135deg,#020408_0%,#060d18_34%,#0c1930_100%)] shadow-[0_26px_70px_rgba(0,0,0,0.42)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.02)_45%,transparent_100%)]" />
        <div className="relative grid min-h-[calc(100vh-24px)] grid-cols-1 gap-5 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_304px] md:items-center md:gap-6 lg:p-8 xl:grid-cols-[minmax(0,1.08fr)_1px_360px] xl:items-center xl:gap-8 xl:p-10">
          <article className="flex min-h-[260px] flex-col justify-center rounded-[28px] border border-[#182744] bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%)] px-5 py-7 backdrop-blur-[2px] sm:px-8 md:min-h-[340px] xl:min-h-[420px]">
            <div className="max-w-xl">
              <p className="m-0 text-[11px] uppercase tracking-[0.38em] text-[#8ea1c0]/44">
                Software Solutions
              </p>
              <h1 className="m-0 mt-3 text-[clamp(3.4rem,9vw,6.8rem)] font-semibold lowercase leading-none tracking-[-0.08em] text-[#ff7f79]">
                shanku
              </h1>
              <p className="m-0 mt-2 text-xs font-bold uppercase tracking-[0.34em] text-[#7d93bb]">
                # POS Terminal
              </p>
            </div>
          </article>

          <div className="hidden xl:block xl:h-[360px] xl:w-px xl:bg-[linear-gradient(180deg,transparent_0%,rgba(84,118,172,0.68)_20%,rgba(84,118,172,0.14)_80%,transparent_100%)]" />

          <article className="rounded-[24px] border border-[#313847] bg-[linear-gradient(180deg,rgba(36,42,54,0.96)_0%,rgba(17,21,29,0.98)_100%)] p-4 shadow-[0_24px_48px_rgba(0,0,0,0.38)] backdrop-blur-md sm:p-5 md:self-center xl:self-center">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-[10px] uppercase tracking-[0.34em] text-[#a3acbc]">
                  PIN Access
                </p>
                <h2 className="m-0 mt-2 text-[1.55rem] font-semibold text-white">
                  Staff Login
                </h2>
              </div>

              <span className="rounded-full border border-[#50586a] bg-[#171c25] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4dbea]">
                Terminal
              </span>
            </div>

            <div className="mb-4 rounded-[18px] border border-[#323947] bg-[linear-gradient(180deg,rgba(11,15,21,0.96)_0%,rgba(14,18,25,0.98)_100%)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="min-w-0">
                <p className="m-0 text-[10px] uppercase tracking-[0.3em] text-[#8e99ab]">
                  Select Staff
                </p>

                <div className="relative mt-3">
                  <select
                    value={selectedStaffId ?? ""}
                    onChange={(event) => selectStaff(Number(event.target.value))}
                    disabled={isSubmitting || isLoadingProfiles || staffProfiles.length === 0}
                    className="w-full appearance-none rounded-[14px] border border-[#485262] bg-[#1a202a] px-4 py-3 pr-11 text-sm font-semibold text-white outline-none transition hover:border-[#6d7990] focus:border-[#9aa4b5] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {staffProfiles.length === 0 ? (
                      <option value="">No staff available</option>
                    ) : null}

                    {staffProfiles.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} - {staff.roleLabel}
                      </option>
                    ))}
                  </select>

                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#c2cada]">
                    <SelectArrowIcon />
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2.5 sm:gap-4 md:gap-5 lg:gap-[14px]">
                  {pinSlots.map((slot) => (
                    <span
                      key={slot.key}
                      className={`h-3.5 w-3.5 rounded-full border transition sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-[18px] lg:w-[18px] ${
                        slot.filled
                          ? "border-[#d7dce5] bg-[#f3f5f8] shadow-[0_0_10px_rgba(255,255,255,0.18)]"
                          : "border-[#495262] bg-[#131820]"
                      }`}
                    />
                  ))}
                </div>

                <span className="text-[10px] uppercase tracking-[0.24em] text-[#9ca5b4] lg:shrink-0">
                  4 digits
                </span>
              </div>
            </div>

            {error ? (
              <div className="mb-4 rounded-[16px] border border-[#6d3b3f] bg-[#2b1619] px-4 py-3 text-sm font-medium text-[#ffd7d2]">
                {error}
              </div>
            ) : null}

            <PosKeypad
              disabled={isSubmitting || isLoadingProfiles}
              confirmLabel={
                isLoadingProfiles
                  ? "Loading"
                  : isSubmitting
                    ? "Logging"
                  : "Enter"
              }
              staffTag={initials(selectedStaff?.name || "Waiter")}
              staffLabel={selectedRole}
              onDigit={appendDigit}
              onBackspace={backspace}
              onClear={clearPin}
              onConfirm={submit}
            />
          </article>
        </div>
      </section>
    </main>
  );
}
