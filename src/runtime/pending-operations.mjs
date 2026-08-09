const MAX_SLOT = 0xffff;
const MAX_GENERATION = 0xffff;

export class PendingOperationError extends Error {
  constructor(code, message, details = {}, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "PendingOperationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const encodeToken = (slot, generation) =>
  (((generation & MAX_GENERATION) << 16) | (slot + 1)) >>> 0;

const decodeToken = token => ({
  slot: (token & MAX_SLOT) - 1,
  generation: token >>> 16,
});

const cancellationError = (reason, details) =>
  new PendingOperationError(
    "operation-cancelled",
    reason ?? "the pending operation was cancelled",
    details,
  );

export class PendingOperationRegistry {
  constructor({ capacity = 1024, onTransition } = {}) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > MAX_SLOT) {
      throw new PendingOperationError(
        "invalid-pending-capacity",
        `pending operation capacity must be from 1 through ${MAX_SLOT}`,
        { capacity },
      );
    }
    this.capacity = capacity;
    this.onTransition = onTransition;
    this.state = "open";
    this.epoch = 1;
    this.slots = [];
    this.live = 0;
    this.counters = {
      begun: 0,
      resolved: 0,
      rejected: 0,
      cancelled: 0,
      late: 0,
      cleanupRuns: 0,
      cleanupFailures: 0,
      observerFailures: 0,
    };
  }

  transition(event, entry, details = {}) {
    try {
      this.onTransition?.(
        Object.freeze({
          event,
          token: entry?.token ?? null,
          declarationId: entry?.plan.declarationId ?? null,
          epoch: this.epoch,
          ...details,
        }),
      );
    } catch {
      this.counters.observerFailures += 1;
    }
  }

  begin(plan, { cleanup = [], cancel } = {}) {
    if (this.state !== "open") {
      throw new PendingOperationError(
        "pending-registry-closed",
        "cannot begin an operation after pending-operation shutdown",
        { state: this.state, epoch: this.epoch },
      );
    }
    if (plan?.kind !== "pending-operation-v1" || plan.abiVersion !== 1) {
      throw new PendingOperationError(
        "invalid-pending-plan",
        "pending operation requires a version 1 generated plan",
      );
    }
    if (!Array.isArray(cleanup) || cleanup.some(item => typeof item !== "function")) {
      throw new PendingOperationError(
        "invalid-pending-cleanup",
        "pending cleanup must be an array of functions",
      );
    }
    if (cancel !== undefined && typeof cancel !== "function") {
      throw new PendingOperationError(
        "invalid-pending-cancel",
        "pending cancellation must be a function when supplied",
      );
    }
    if (this.live >= this.capacity) {
      throw new PendingOperationError(
        "pending-capacity",
        "pending operation registry is full",
        { capacity: this.capacity },
      );
    }

    let slot = this.slots.findIndex(entry => entry.state === "free" && !entry.retired);
    if (slot < 0) {
      if (this.slots.length >= this.capacity) {
        throw new PendingOperationError(
          "pending-capacity",
          "pending operation registry has no reusable slots",
          { capacity: this.capacity },
        );
      }
      slot = this.slots.length;
      this.slots.push({ generation: 1, state: "free", retired: false });
    }
    const entry = this.slots[slot];
    const token = encodeToken(slot, entry.generation);
    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    Object.assign(entry, {
      state: "pending",
      token,
      plan,
      cleanup: [...cleanup],
      cancel,
      resolvePromise,
      rejectPromise,
    });
    this.live += 1;
    this.counters.begun += 1;
    this.transition("begin", entry);
    return Object.freeze({ token, promise });
  }

  requirePending(token) {
    if (!Number.isInteger(token) || token <= 0 || token > 0xffff_ffff) {
      this.counters.late += 1;
      throw new PendingOperationError(
        "invalid-pending-token",
        "pending operation token is invalid",
        { token },
      );
    }
    const normalized = token >>> 0;
    const decoded = decodeToken(normalized);
    const entry = this.slots[decoded.slot];
    if (
      decoded.slot < 0 ||
      decoded.generation === 0 ||
      entry?.state !== "pending" ||
      entry.generation !== decoded.generation ||
      entry.token !== normalized
    ) {
      this.counters.late += 1;
      throw new PendingOperationError(
        "stale-pending-operation",
        "pending operation has already settled or belongs to another generation",
        { token: normalized },
      );
    }
    return { entry, slot: decoded.slot };
  }

  runCleanup(entry) {
    const failures = [];
    for (const operation of entry.cleanup.reverse()) {
      try {
        operation();
        this.counters.cleanupRuns += 1;
      } catch (error) {
        failures.push(error);
        this.counters.cleanupFailures += 1;
      }
    }
    entry.cleanup = [];
    return failures;
  }

  retire(slot, entry) {
    this.live -= 1;
    entry.state = "free";
    entry.token = undefined;
    entry.plan = undefined;
    entry.resolvePromise = undefined;
    entry.rejectPromise = undefined;
    entry.cancel = undefined;
    if (entry.generation === MAX_GENERATION) {
      entry.retired = true;
    } else {
      entry.generation += 1;
    }
    this.slots[slot] = entry;
  }

  settle(token, outcome, value) {
    const { entry, slot } = this.requirePending(token);
    const resolvePromise = entry.resolvePromise;
    const rejectPromise = entry.rejectPromise;
    const cleanupFailures = [];
    if (outcome === "cancel" && entry.cancel) {
      try {
        entry.cancel(entry.token);
      } catch (error) {
        cleanupFailures.push(error);
        this.counters.cleanupFailures += 1;
      }
    }
    cleanupFailures.push(...this.runCleanup(entry));
    const details = { outcome, cleanupFailures: cleanupFailures.length };
    this.transition(outcome, entry, details);
    this.retire(slot, entry);

    if (cleanupFailures.length > 0) {
      const error = new PendingOperationError(
        "pending-cleanup-failed",
        "pending operation cleanup failed",
        { token: token >>> 0, outcome, failures: cleanupFailures.length },
        cleanupFailures[0],
      );
      this.counters.rejected += 1;
      rejectPromise(error);
      return false;
    }
    if (outcome === "resolve") {
      this.counters.resolved += 1;
      resolvePromise(value);
    } else {
      if (outcome === "cancel") this.counters.cancelled += 1;
      else this.counters.rejected += 1;
      rejectPromise(value);
    }
    return true;
  }

  resolve(token, value) {
    return this.settle(token, "resolve", value);
  }

  reject(token, error) {
    return this.settle(token, "reject", error);
  }

  cancel(token, reason) {
    return this.settle(
      token,
      "cancel",
      cancellationError(reason, { token: token >>> 0, epoch: this.epoch }),
    );
  }

  shutdown(reason = "the runtime shut down before the operation settled") {
    if (this.state === "closed") return false;
    this.state = "closing";
    const tokens = this.slots
      .filter(entry => entry.state === "pending")
      .map(entry => entry.token);
    for (const token of tokens) this.cancel(token, reason);
    this.state = "closed";
    this.epoch += 1;
    return true;
  }

  snapshot() {
    return Object.freeze({
      state: this.state,
      epoch: this.epoch,
      capacity: this.capacity,
      live: this.live,
      ...this.counters,
    });
  }
}
