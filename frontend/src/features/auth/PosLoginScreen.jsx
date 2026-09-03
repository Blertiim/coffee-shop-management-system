import { useEffect, useMemo, useState } from "react";

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
      <path d="m5 7.5 5 5 5-5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PosLoginScreen() {
  const { loginSuccess } = usePosApp();
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (window.location.pathname !== "/") {
      window.history.replaceState({}, "", "/");
    }

    const updateClock = () => {
      setCurrentDateTime(new Date());
    };

    updateClock();

    const intervalId = window.setInterval(updateClock, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const selectedRole = useMemo(() => selectedStaff?.roleLabel || "Cafe staff", [selectedStaff]);
  const pinSlots = useMemo(() => buildPinSlots(pin), [pin]);
  const formattedDateTime = useMemo(() => {
    const year = currentDateTime.getFullYear();
    const month = String(currentDateTime.getMonth() + 1).padStart(2, "0");
    const day = String(currentDateTime.getDate()).padStart(2, "0");
    const hours = String(currentDateTime.getHours()).padStart(2, "0");
    const minutes = String(currentDateTime.getMinutes()).padStart(2, "0");
    const seconds = String(currentDateTime.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }, [currentDateTime]);
  const emptyStaffLabel = isLoadingProfiles
    ? "Loading staff..."
    : error
      ? "Cannot load staff"
      : "No staff available";

  return (
    <main className="pos-shell">
      <section className="relative overflow-hidden rounded-[28px] border border-[#d3e3fa] bg-[radial-gradient(circle_at_22%_22%,rgba(31,162,255,0.08)_0%,transparent_22%),radial-gradient(circle_at_76%_18%,rgba(31,109,204,0.06)_0%,transparent_18%),linear-gradient(135deg,#ffffff_0%,#f6faff_34%,#eef5ff_100%)] shadow-[0_26px_70px_rgba(20,55,110,0.1)]">
        <div className="relative grid min-h-[calc(100vh-24px)] grid-cols-1 gap-5 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_304px] md:items-center md:gap-6 lg:p-8 xl:grid-cols-[minmax(0,1.08fr)_1px_360px] xl:items-center xl:gap-8 xl:p-10">
          <article className="flex min-h-[260px] flex-col justify-center rounded-[28px] border border-[#d3e3fa] bg-white/70 px-5 py-7 backdrop-blur-[2px] sm:px-8 md:min-h-[340px] xl:min-h-[420px]">
            <div className="max-w-xl">
              <p className="m-0 text-[11px] uppercase tracking-[0.38em] text-[#5c7093]">
                Software Solutions
              </p>
              <h1 className="m-0 mt-3 text-[clamp(3.4rem,9vw,6.8rem)] font-semibold lowercase leading-none tracking-[-0.08em] text-[#1fa2ff]">
                shanku
              </h1>
              <p className="m-0 mt-2 text-xs font-bold uppercase tracking-[0.34em] text-[#5c7093]">
                # ROSIT BAR
              </p>
            </div>
          </article>

          <div className="hidden xl:block xl:h-[360px] xl:w-px xl:bg-[linear-gradient(180deg,transparent_0%,rgba(31,109,204,0.3)_20%,rgba(31,109,204,0.08)_80%,transparent_100%)]" />

          <article className="rounded-[24px] border border-[#d3e3fa] bg-white p-4 shadow-[0_24px_48px_rgba(20,55,110,0.1)] backdrop-blur-md sm:p-5 md:self-center xl:self-center">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-[10px] uppercase tracking-[0.34em] text-[#5c7093]">
                  PIN Access
                </p>
                <h2 className="m-0 mt-2 text-[1.55rem] font-semibold text-[#12213d]">
                  Staff Login
                </h2>
              </div>

              <span className="rounded-full border border-[#c7dcf7] bg-[#eef5ff] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#12213d]">
                Terminal
              </span>
            </div>

            <div className="mb-4 rounded-[18px] border border-[#e1ecfb] bg-[#f7faff] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
              <div className="min-w-0">
                <p className="m-0 text-[10px] uppercase tracking-[0.3em] text-[#5c7093]">
                  Select Staff
                </p>

                <div className="relative mt-3">
                  <select
                    value={selectedStaffId ?? ""}
                    onChange={(event) => selectStaff(Number(event.target.value))}
                    disabled={isSubmitting || isLoadingProfiles || staffProfiles.length === 0}
                    className="w-full appearance-none rounded-[14px] border border-[#c7dcf7] bg-white px-4 py-3 pr-11 text-sm font-semibold text-[#12213d] outline-none transition hover:border-[#8fb8ee] focus:border-[#1fa2ff] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {staffProfiles.length === 0 ? (
                      <option value="">{emptyStaffLabel}</option>
                    ) : null}

                    {staffProfiles.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} - {staff.roleLabel}
                      </option>
                    ))}
                  </select>

                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#5c7093]">
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
                          ? "border-[#1fa2ff] bg-[#1fa2ff] shadow-[0_0_10px_rgba(31,162,255,0.35)]"
                          : "border-[#c7dcf7] bg-white"
                      }`}
                    />
                  ))}
                </div>

                <span className="text-[10px] uppercase tracking-[0.24em] text-[#5c7093] lg:shrink-0">
                  4 digits
                </span>
              </div>
            </div>

            {error ? (
              <div className="mb-4 rounded-[16px] border border-[#f3c3c9] bg-[#fdedef] px-4 py-3 text-sm font-medium text-[#b3364a]">
                {error}
              </div>
            ) : null}

            <PosKeypad
              disabled={isSubmitting || isLoadingProfiles}
              confirmLabel={isLoadingProfiles ? "Loading" : isSubmitting ? "Logging" : "Enter"}
              staffTag={initials(selectedStaff?.name || "Waiter")}
              staffLabel={selectedRole}
              onDigit={appendDigit}
              onBackspace={backspace}
              onClear={clearPin}
              onConfirm={submit}
            />
          </article>

          <div className="pointer-events-none absolute bottom-4 right-4 z-10 sm:bottom-5 sm:right-5">
            <p className="m-0 font-mono text-[11px] font-medium tracking-[0.12em] text-[#5c7093]">
              {formattedDateTime}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
