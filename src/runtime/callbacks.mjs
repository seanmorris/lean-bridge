const HANDLE_SLOT_MASK = 0x0fff;
const HANDLE_GENERATION_MASK = 0x0fff;
const HANDLE_KIND_MASK = 0x7f;

const encodeHostToken = (slot, generation, kind) =>
  (
    0x8000_0000 |
    ((kind & HANDLE_KIND_MASK) << 24) |
    ((generation & HANDLE_GENERATION_MASK) << 12) |
    (slot + 1)
  ) >>> 0;

const decodeHostToken = token => ({
  side: token >>> 31,
  kind: (token >>> 24) & HANDLE_KIND_MASK,
  generation: (token >>> 12) & HANDLE_GENERATION_MASK,
  slot: (token & HANDLE_SLOT_MASK) - 1,
});

export class CallbackRuntimeError extends Error {
  constructor(code, message, details = {}, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "CallbackRuntimeError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}, cause) => {
  throw new CallbackRuntimeError(code, message, details, cause);
};

const assertPlan = plan => {
  if (
    plan?.kind !== "callback-signature-v1" ||
    plan.abiVersion !== 1 ||
    typeof plan.signatureId !== "string" ||
    !Number.isSafeInteger(plan.reentry?.maxDepth) ||
    plan.reentry.maxDepth < 1
  ) {
    fail(
      "invalid-callback-plan",
      "callback execution requires a generated callback signature version 1 plan",
    );
  }
  return plan;
};

export class CallbackRegistry {
  constructor({ capacity = 1024, handleKind = 1, onFrame } = {}) {
    if (
      !Number.isSafeInteger(capacity) ||
      capacity < 1 ||
      capacity > HANDLE_SLOT_MASK
    ) {
      fail(
        "invalid-callback-capacity",
        `callback capacity must be from 1 through ${HANDLE_SLOT_MASK}`,
        { capacity },
      );
    }
    if (
      !Number.isSafeInteger(handleKind) ||
      handleKind < 1 ||
      handleKind > HANDLE_KIND_MASK
    ) {
      fail(
        "invalid-callback-kind",
        `callback handle kind must be from 1 through ${HANDLE_KIND_MASK}`,
        { handleKind },
      );
    }
    if (onFrame !== undefined && typeof onFrame !== "function") {
      fail("invalid-frame-observer", "callback frame observer must be a function");
    }
    this.capacity = capacity;
    this.handleKind = handleKind;
    this.onFrame = onFrame;
    this.state = "open";
    this.epoch = 1;
    this.slots = [];
    this.tokensByFunction = new WeakMap();
    this.frames = [];
    this.nextFrameId = 1;
    this.counters = {
      retained: 0,
      canonicalHits: 0,
      released: 0,
      invoked: 0,
      rejected: 0,
      exceptions: 0,
      maxDepth: 0,
      deferredReleases: 0,
      observerFailures: 0,
    };
  }

  reject(code, message, details = {}, cause) {
    this.counters.rejected += 1;
    fail(code, message, { epoch: this.epoch, ...details }, cause);
  }

  observe(event, frame, details = {}) {
    try {
      this.onFrame?.(
        Object.freeze({
          event,
          frameId: frame.id,
          parentFrameId: frame.parentId,
          token: frame.token,
          signatureId: frame.signatureId,
          direction: frame.direction,
          depth: frame.depth,
          ...details,
        }),
      );
    } catch {
      this.counters.observerFailures += 1;
    }
  }

  requireOpen() {
    if (this.state !== "open") {
      this.reject(
        "callback-registry-closed",
        "cannot use callbacks after callback registry shutdown",
        { state: this.state },
      );
    }
  }

  resolve(token, plan) {
    assertPlan(plan);
    if (!Number.isInteger(token) || token <= 0 || token > 0xffff_ffff) {
      this.reject("invalid-callback-token", "callback token is invalid", { token });
    }
    const normalized = token >>> 0;
    const decoded = decodeHostToken(normalized);
    const entry = this.slots[decoded.slot];
    if (
      decoded.side !== 1 ||
      decoded.kind !== this.handleKind ||
      decoded.slot < 0 ||
      decoded.generation === 0 ||
      entry?.state !== "live" ||
      entry.generation !== decoded.generation ||
      entry.token !== normalized
    ) {
      this.reject(
        "stale-callback-token",
        "callback token is stale or belongs to another registry",
        { token: normalized, expectedKind: this.handleKind },
      );
    }
    if (entry.signatureId !== plan.signatureId) {
      this.reject(
        "callback-signature-mismatch",
        "callback token was retained for a different generated signature",
        {
          token: normalized,
          expected: entry.signatureId,
          actual: plan.signatureId,
        },
      );
    }
    return { entry, slot: decoded.slot };
  }

  resolveRetained(token) {
    if (!Number.isInteger(token) || token <= 0 || token > 0xffff_ffff) {
      this.reject("invalid-callback-token", "callback token is invalid", { token });
    }
    const normalized = token >>> 0;
    const decoded = decodeHostToken(normalized);
    const entry = this.slots[decoded.slot];
    if (
      decoded.side !== 1 ||
      decoded.kind !== this.handleKind ||
      decoded.slot < 0 ||
      decoded.generation === 0 ||
      entry?.state !== "live" ||
      entry.generation !== decoded.generation ||
      entry.token !== normalized
    ) {
      this.reject(
        "stale-callback-token",
        "callback token is stale or belongs to another registry",
        { token: normalized, expectedKind: this.handleKind },
      );
    }
    return { entry, slot: decoded.slot };
  }

  retain(callback, plan) {
    this.requireOpen();
    assertPlan(plan);
    if (typeof callback !== "function") {
      this.reject("invalid-callback", "retained callback must be a function");
    }
    let tokensBySignature = this.tokensByFunction.get(callback);
    const existing = tokensBySignature?.get(plan.signatureId);
    if (existing !== undefined) {
      const { entry } = this.resolve(existing, plan);
      entry.leases += 1;
      this.counters.retained += 1;
      this.counters.canonicalHits += 1;
      return existing;
    }

    let slot = this.slots.findIndex(entry => entry.state === "free" && !entry.retired);
    if (slot < 0) {
      if (this.slots.length >= this.capacity) {
        this.reject("callback-capacity", "callback registry is full", {
          capacity: this.capacity,
        });
      }
      slot = this.slots.length;
      this.slots.push({
        state: "free",
        generation: 1,
        retired: false,
      });
    }
    const entry = this.slots[slot];
    const token = encodeHostToken(slot, entry.generation, this.handleKind);
    Object.assign(entry, {
      state: "live",
      token,
      callback,
      plan,
      direction: "host",
      signatureId: plan.signatureId,
      leases: 1,
      active: 0,
      calls: 0,
      releaseDeferred: false,
    });
    tokensBySignature ??= new Map();
    tokensBySignature.set(plan.signatureId, token);
    this.tokensByFunction.set(callback, tokensBySignature);
    this.counters.retained += 1;
    return token;
  }

  removeForwardEntry(entry) {
    const tokensBySignature = this.tokensByFunction.get(entry.callback);
    tokensBySignature?.delete(entry.signatureId);
    if (tokensBySignature?.size === 0) {
      this.tokensByFunction.delete(entry.callback);
    }
  }

  retire(slot, entry) {
    this.removeForwardEntry(entry);
    entry.state = "free";
    entry.token = undefined;
    entry.callback = undefined;
    entry.plan = undefined;
    entry.direction = undefined;
    entry.signatureId = undefined;
    entry.leases = 0;
    entry.active = 0;
    entry.calls = 0;
    entry.releaseDeferred = false;
    if (entry.generation === HANDLE_GENERATION_MASK) {
      entry.retired = true;
    } else {
      entry.generation += 1;
    }
    this.slots[slot] = entry;
  }

  release(token, plan) {
    this.requireOpen();
    const { entry, slot } = this.resolve(token, plan);
    if (entry.leases < 1) {
      this.reject(
        "callback-release-underflow",
        "callback has no retained lease to release",
        { token: entry.token },
      );
    }
    const remaining = entry.leases - 1;
    if (remaining === 0 && entry.active > 0) {
      if (plan.selfDisposal === "reject") {
        this.reject(
          "callback-active",
          "callback cannot release its final lease while it is running",
          { token: token >>> 0, active: entry.active },
        );
      }
      entry.leases = 0;
      entry.releaseDeferred = true;
      this.counters.released += 1;
      this.counters.deferredReleases += 1;
      return 0;
    }
    entry.leases = remaining;
    this.counters.released += 1;
    if (remaining === 0) this.retire(slot, entry);
    return remaining;
  }

  enterFrame(entry) {
    const parent = this.frames.at(-1);
    if (parent?.plan.reentry.policy === "disallowed") {
      this.reject(
        "callback-reentry-disallowed",
        "the active callback signature disallows nested bridge entry",
        { parentFrameId: parent.id, parentSignatureId: parent.signatureId },
      );
    }
    const depthLimit = Math.min(
      entry.plan.reentry.maxDepth,
      ...this.frames.map(frame => frame.plan.reentry.maxDepth),
    );
    if (this.frames.length >= depthLimit) {
      this.reject(
        "callback-depth-exceeded",
        "callback re-entry depth exceeded the generated signature budget",
        { depth: this.frames.length, maxDepth: depthLimit },
      );
    }
    const frame = {
      id: this.nextFrameId,
      parentId: parent?.id ?? null,
      token: entry.token,
      signatureId: entry.signatureId,
      plan: entry.plan,
      direction: entry.direction,
      depth: this.frames.length + 1,
    };
    this.nextFrameId += 1;
    this.frames.push(frame);
    entry.active += 1;
    this.counters.maxDepth = Math.max(this.counters.maxDepth, frame.depth);
    this.observe("enter", frame);
    return frame;
  }

  leaveFrame(frame, entry, slot, outcome) {
    const current = this.frames.pop();
    if (current !== frame) {
      this.state = "poisoned";
      this.reject(
        "callback-frame-corruption",
        "callback frames did not unwind in last-in-first-out order",
        { expectedFrameId: frame.id, actualFrameId: current?.id ?? null },
      );
    }
    entry.active -= 1;
    this.observe("leave", frame, { outcome });
    if (entry.releaseDeferred && entry.active === 0 && entry.leases === 0) {
      this.retire(slot, entry);
    }
  }

  invoke(token, plan, args = []) {
    this.requireOpen();
    if (!Array.isArray(args)) {
      this.reject("invalid-callback-arguments", "callback arguments must be an array");
    }
    const { entry, slot } = this.resolve(token, plan);
    return this.invokeEntry(entry, slot, args);
  }

  invokeRetained(token, args = []) {
    this.requireOpen();
    if (!Array.isArray(args)) {
      this.reject("invalid-callback-arguments", "callback arguments must be an array");
    }
    const { entry, slot } = this.resolveRetained(token);
    return this.invokeEntry(entry, slot, args);
  }

  invokeNative(token, plan, operation, args = []) {
    this.requireOpen();
    assertPlan(plan);
    if (!Number.isInteger(token) || token <= 0 || token > 0xffff_ffff) {
      this.reject("invalid-callback-token", "native callback token is invalid", {
        token,
      });
    }
    if (typeof operation !== "function") {
      this.reject(
        "invalid-callback",
        "native callback operation must be a function",
      );
    }
    if (!Array.isArray(args)) {
      this.reject("invalid-callback-arguments", "callback arguments must be an array");
    }
    const entry = {
      token: token >>> 0,
      callback: operation,
      plan,
      direction: "lean",
      signatureId: plan.signatureId,
      leases: 1,
      active: 0,
      calls: 0,
      releaseDeferred: false,
    };
    return this.invokeEntry(entry, undefined, args);
  }

  beforeNativeCall() {
    const frame = this.frames.at(-1);
    if (frame?.plan.reentry.policy === "disallowed") {
      this.reject(
        "callback-reentry-disallowed",
        "the active callback signature disallows nested bridge entry",
        { parentFrameId: frame.id, parentSignatureId: frame.signatureId },
      );
    }
  }

  invokeEntry(entry, slot, args) {
    if (entry.plan.invocation === "once" && entry.calls > 0) {
      this.reject(
        "callback-already-invoked",
        "a once callback cannot be invoked more than once",
        { token: entry.token },
      );
    }
    const frame = this.enterFrame(entry);
    entry.calls += 1;
    this.counters.invoked += 1;
    let result;
    try {
      result = entry.callback(...args);
    } catch (error) {
      this.counters.exceptions += 1;
      this.leaveFrame(frame, entry, slot, "throw");
      throw error;
    }
    if (result && typeof result.then === "function") {
      return Promise.resolve(result).then(
        value => {
          this.leaveFrame(frame, entry, slot, "return");
          return value;
        },
        error => {
          this.counters.exceptions += 1;
          this.leaveFrame(frame, entry, slot, "throw");
          throw error;
        },
      );
    }
    this.leaveFrame(frame, entry, slot, "return");
    return result;
  }

  shutdown() {
    if (this.state === "closed") return false;
    if (this.frames.length > 0) {
      this.reject(
        "callback-active",
        "cannot shut down the callback registry while callbacks are running",
        { activeFrames: this.frames.length },
      );
    }
    for (let slot = 0; slot < this.slots.length; slot += 1) {
      const entry = this.slots[slot];
      if (entry.state === "live") this.retire(slot, entry);
    }
    this.state = "closed";
    this.epoch += 1;
    return true;
  }

  snapshot() {
    return Object.freeze({
      state: this.state,
      epoch: this.epoch,
      capacity: this.capacity,
      live: this.slots.filter(entry => entry.state === "live").length,
      activeFrames: this.frames.length,
      frames: Object.freeze(
        this.frames.map(frame =>
          Object.freeze({
            id: frame.id,
            parentId: frame.parentId,
            token: frame.token,
            signatureId: frame.signatureId,
            direction: frame.direction,
            depth: frame.depth,
          }),
        ),
      ),
      ...this.counters,
    });
  }
}
