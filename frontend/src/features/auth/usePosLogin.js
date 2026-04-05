import { useEffect, useMemo, useState } from "react";

import { getPosStaffProfiles, posLogin } from "./authApi";

const POS_PROFILE_ROLES = new Set(["waiter", "manager"]);
const PIN_LENGTH = 4;

const normalizeRole = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const toRoleLabel = (role) => {
  const normalized = normalizeRole(role);
  if (normalized === "admin") {
    return "Admin";
  }
  if (normalized === "manager") {
    return "Manager";
  }
  if (normalized === "waiter") {
    return "Waiter";
  }
  return "Staff";
};

const mapProfile = (profile) => ({
  id: profile.id,
  name: profile.name || profile.fullName || "Staff",
  role: normalizeRole(profile.role),
  roleLabel: toRoleLabel(profile.role),
  status: profile.status || "active",
});

export default function usePosLogin(onLoginSuccess) {
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadProfiles = async () => {
      setIsLoadingProfiles(true);
      setError("");

      try {
        const response = await getPosStaffProfiles(controller.signal);
        const profiles = Array.isArray(response)
          ? response
              .map(mapProfile)
              .filter((profile) => POS_PROFILE_ROLES.has(profile.role))
          : [];

        if (!isMounted) {
          return;
        }

        setStaffProfiles(profiles);
        setSelectedStaffId((current) => {
          if (current && profiles.some((profile) => profile.id === current)) {
            return current;
          }

          return profiles[0]?.id ?? null;
        });

        if (profiles.length === 0) {
          setError("No active waiter or manager found. Create/enable staff first.");
        }
      } catch (requestError) {
        if (!isMounted || requestError.name === "AbortError") {
          return;
        }

        setError(requestError.message || "Cannot load POS staff profiles.");
      } finally {
        if (isMounted) {
          setIsLoadingProfiles(false);
        }
      }
    };

    loadProfiles();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const selectedStaff = useMemo(
    () =>
      staffProfiles.find((staff) => staff.id === selectedStaffId) ||
      staffProfiles[0] ||
      null,
    [selectedStaffId, staffProfiles]
  );

  const selectStaff = (staffId) => {
    setSelectedStaffId(staffId);
    setPin("");
    setError("");
  };

  const appendDigit = (digit) => {
    setPin((current) => (current.length >= PIN_LENGTH ? current : `${current}${digit}`));
    setError("");
  };

  const backspace = () => {
    setPin((current) => current.slice(0, -1));
    setError("");
  };

  const clearPin = () => {
    setPin("");
    setError("");
  };

  const submit = async () => {
    if (!selectedStaff) {
      setError("Select a staff profile first.");
      return;
    }

    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
      setError("Enter a valid 4-digit PIN.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await posLogin({
        userId: selectedStaff.id,
        pin,
      });

      await onLoginSuccess(response, selectedStaff);
    } catch (requestError) {
      setError(requestError.message || "Wrong PIN. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
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
  };
}
