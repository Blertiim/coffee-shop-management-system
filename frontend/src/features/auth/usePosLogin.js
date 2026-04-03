import { useMemo, useState } from "react";

import { login } from "./authApi";
import { POS_STAFF } from "./posStaff";

export default function usePosLogin(onLoginSuccess) {
  const [selectedStaffId, setSelectedStaffId] = useState(POS_STAFF[0]?.id || "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedStaff = useMemo(
    () => POS_STAFF.find((staff) => staff.id === selectedStaffId) || POS_STAFF[0] || null,
    [selectedStaffId]
  );

  const selectStaff = (staffId) => {
    setSelectedStaffId(staffId);
    setPin("");
    setError("");
  };

  const appendDigit = (digit) => {
    setPin((current) => `${current}${digit}`);
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
      setError("No staff profile is configured for this POS.");
      return;
    }

    if (!pin) {
      setError("Enter the PIN to continue.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await login({
        email: selectedStaff.email,
        password: pin,
      });

      await onLoginSuccess(response, selectedStaff);
    } catch (requestError) {
      setError(requestError.message || "Wrong PIN. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    staffProfiles: POS_STAFF,
    selectedStaff,
    selectedStaffId,
    pin,
    error,
    isSubmitting,
    selectStaff,
    appendDigit,
    backspace,
    clearPin,
    submit,
  };
}
