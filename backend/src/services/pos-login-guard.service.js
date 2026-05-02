const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const ATTEMPT_DELAY_MS = 3 * 1000;
const STATE_TTL_MS = 24 * 60 * 60 * 1000;

const attemptStates = new Map();
const cooldownStates = new Map();

const normalizeIdentifier = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeIpAddress = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : "unknown";

const buildScopeKey = (identifier, ipAddress) =>
  `${normalizeIpAddress(ipAddress)}:${normalizeIdentifier(identifier) || "unknown"}`;

const getAttemptState = (identifier, now) => {
  const key = normalizeIdentifier(identifier);

  if (!key) {
    return {
      key,
      state: {
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: now,
      },
    };
  }

  const existing = attemptStates.get(key);

  if (!existing) {
    return {
      key,
      state: {
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: now,
      },
    };
  }

  if (existing.lockedUntil && existing.lockedUntil <= now) {
    const resetState = {
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: now,
    };

    attemptStates.set(key, resetState);

    return {
      key,
      state: resetState,
    };
  }

  return {
    key,
    state: existing,
  };
};

const cleanupExpiredState = () => {
  const now = Date.now();

  for (const [key, state] of attemptStates.entries()) {
    const lockoutExpired = !state.lockedUntil || state.lockedUntil <= now;
    const stale = state.updatedAt + STATE_TTL_MS <= now;

    if (lockoutExpired && (state.failedAttempts <= 0 || stale)) {
      attemptStates.delete(key);
    }
  }

  for (const [key, state] of cooldownStates.entries()) {
    if (state.nextAllowedAt <= now) {
      cooldownStates.delete(key);
    }
  }
};

const cleanupInterval = setInterval(cleanupExpiredState, 60 * 1000);

if (typeof cleanupInterval.unref === "function") {
  cleanupInterval.unref();
}

const getPosLoginBlock = ({ identifier, ipAddress, now = Date.now() }) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const { state } = getAttemptState(normalizedIdentifier, now);

  if (state.lockedUntil && state.lockedUntil > now) {
    return {
      type: "lockout",
      retryAfterMs: state.lockedUntil - now,
      lockedUntil: state.lockedUntil,
    };
  }

  const scopeKey = buildScopeKey(normalizedIdentifier, ipAddress);
  const cooldownState = cooldownStates.get(scopeKey);

  if (cooldownState && cooldownState.nextAllowedAt > now) {
    return {
      type: "cooldown",
      retryAfterMs: cooldownState.nextAllowedAt - now,
      nextAllowedAt: cooldownState.nextAllowedAt,
    };
  }

  return null;
};

const registerFailedPosLoginAttempt = ({
  identifier,
  ipAddress,
  now = Date.now(),
}) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const scopeKey = buildScopeKey(normalizedIdentifier, ipAddress);
  const { key, state } = getAttemptState(normalizedIdentifier, now);

  const nextState = {
    failedAttempts: state.failedAttempts + 1,
    lockedUntil: state.lockedUntil,
    updatedAt: now,
  };

  if (nextState.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    nextState.failedAttempts = MAX_FAILED_ATTEMPTS;
    nextState.lockedUntil = now + LOCKOUT_MS;
  }

  if (key) {
    attemptStates.set(key, nextState);
  }

  cooldownStates.set(scopeKey, {
    nextAllowedAt: now + ATTEMPT_DELAY_MS,
  });

  return {
    failedAttempts: nextState.failedAttempts,
    lockedUntil: nextState.lockedUntil,
    nextAllowedAt: now + ATTEMPT_DELAY_MS,
  };
};

const clearPosLoginAttemptState = ({ identifier, ipAddress } = {}) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (normalizedIdentifier) {
    attemptStates.delete(normalizedIdentifier);

    for (const key of cooldownStates.keys()) {
      if (key.endsWith(`:${normalizedIdentifier}`)) {
        cooldownStates.delete(key);
      }
    }
  }

  if (ipAddress) {
    cooldownStates.delete(buildScopeKey(normalizedIdentifier, ipAddress));
  }
};

module.exports = {
  ATTEMPT_DELAY_MS,
  LOCKOUT_MS,
  MAX_FAILED_ATTEMPTS,
  clearPosLoginAttemptState,
  getPosLoginBlock,
  registerFailedPosLoginAttempt,
};
