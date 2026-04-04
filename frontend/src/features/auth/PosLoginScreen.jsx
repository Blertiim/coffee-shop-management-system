import { useMemo } from "react";

import { usePosApp } from "../../context/PosAppContext";
import PosKeypad from "../pos/components/PosKeypad";
import usePosLogin from "./usePosLogin";

const formatPinDisplay = (pin) =>
  pin ? "*".repeat(Math.min(pin.length, 6)) : "Enter PIN";

const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

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

  return (
    <main className="pos-shell">
      <section className="grid min-h-[calc(100vh-24px)] grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.95fr]">
        <article className="pos-panel relative hidden overflow-hidden p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-10 -top-8 h-48 w-48 rounded-full bg-pos-accent/20 blur-2xl" />
          <div className="absolute -bottom-10 right-10 h-44 w-44 rounded-full bg-pos-accentSoft/20 blur-2xl" />

          <div className="relative z-10">
            <span className="pos-badge">Coffee POS</span>
            <h1 className="mt-4 text-[clamp(2rem,4.2vw,3.25rem)] font-bold leading-tight text-white">
              Banaku Touch System
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-pos-muted">
              Fast, clean, and reliable ordering flow for waiters and cashiers.
              Tap once, move fast, and keep tables under control.
            </p>
          </div>

          <div className="relative z-10 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="m-0 text-xs uppercase tracking-[0.14em] text-pos-muted">
              Shift ready
            </p>
            <div className="flex items-center justify-between">
              <p className="m-0 text-lg font-semibold text-white">Touchscreen optimized</p>
              <span className="rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">
                Online
              </span>
            </div>
          </div>
        </article>

        <article className="pos-panel flex flex-col p-4 sm:p-6 lg:p-6 xl:p-7">
          <div className="mb-5">
            <span className="pos-badge">Staff Login</span>
            <h2 className="pos-title mt-3">PIN Access</h2>
            <p className="pos-subtitle mt-2">
              Select your profile and enter PIN to continue.
            </p>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {staffProfiles.map((staff) => {
              const isActive = staff.id === selectedStaffId;

              return (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => selectStaff(staff.id)}
                  disabled={isLoadingProfiles}
                  className={`touch-tile flex min-h-[84px] items-center gap-3 rounded-2xl border p-3 ${
                    isActive
                      ? "border-pos-accent bg-pos-accent/20"
                      : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
                  }`}
                >
                  <span
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${
                      isActive ? "bg-pos-accent text-slate-950" : "bg-white/10 text-pos-text"
                    }`}
                  >
                    {initials(staff.name)}
                  </span>

                  <span className="flex flex-col text-left">
                    <span className="text-sm font-semibold text-white">{staff.name}</span>
                    <span className="text-xs uppercase tracking-wide text-pos-muted">
                      {staff.roleLabel || "Cafe staff"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex min-h-[82px] items-center justify-between rounded-2xl border border-white/10 bg-pos-panelSoft px-4">
            <div>
              <p className="m-0 text-xs uppercase tracking-wide text-pos-muted">Selected</p>
              <p className="m-0 mt-1 text-sm font-semibold text-white">
                {selectedStaff?.name || "No staff"}
              </p>
              <p className="m-0 text-xs text-pos-muted">{selectedRole}</p>
            </div>

            <p className="m-0 text-2xl font-bold tracking-[0.28em] text-pos-accent">
              {formatPinDisplay(pin)}
            </p>
          </div>

          {error ? (
            <div className="mb-3 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
              {error}
            </div>
          ) : null}

          <PosKeypad
            disabled={isSubmitting || isLoadingProfiles}
            confirmLabel={
              isLoadingProfiles
                ? "Loading Staff..."
                : isSubmitting
                  ? "Logging in..."
                  : "Login"
            }
            onDigit={appendDigit}
            onBackspace={backspace}
            onClear={clearPin}
            onConfirm={submit}
          />
        </article>
      </section>
    </main>
  );
}
