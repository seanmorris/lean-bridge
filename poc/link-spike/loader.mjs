const identity = descriptor => `${descriptor.id}#${descriptor.buildHash}`;

const VALUE_FRAME_V1_BYTES = 60;
const valueFrameOffsets = Object.freeze({
  abiVersion: 0,
  byteSize: 4,
  status: 8,
  detail: 12,
  enabled: 16,
  count: 20,
  labelPointer: 24,
  labelLength: 28,
  labelCapacity: 32,
  bytesPointer: 36,
  bytesLength: 40,
  bytesCapacity: 44,
  valuesPointer: 48,
  valuesLength: 52,
  valuesCapacity: 56,
});
const frameErrorCodes = Object.freeze([
  "ok",
  "abi-version-mismatch",
  "frame-size-mismatch",
  "runtime-not-ready",
  "invalid-bool",
  "copy-limit-exceeded",
  "pointer-out-of-range",
  "output-capacity-exceeded",
  "internal-frame-error",
]);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const runtimeContexts = new WeakMap();
const wrapperStates = new WeakMap();
let nextRuntimeIdentity = 1;

export class LeanBridgeError extends Error {
  constructor(message, { code, library, operation, details = {} }) {
    super(message);
    this.name = "LeanBridgeError";
    this.code = code;
    this.library = library;
    this.operation = operation;
    this.details = Object.freeze({ ...details });
  }
}

const bytesFrom = value =>
  value instanceof Uint8Array
    ? value
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

const readArtifact = async url => {
  if (url.protocol === "file:") {
    const { readFile } = await import("node:fs/promises");
    return bytesFrom(await readFile(url));
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to read ${url}: HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
};

const sha256 = async bytes => {
  const result = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(result)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
};

const verifyIntegrity = async (descriptor, read) => {
  if (!descriptor.integrity) return;
  const actual = await sha256(await read(descriptor.sideModule));
  if (actual !== descriptor.integrity) {
    throw new Error(
      `library artifact integrity mismatch for ${descriptor.id}: expected ${descriptor.integrity}, received ${actual}; restore the locked artifact or review and relock the package`,
    );
  }
};

const resolvePrivateFunction = (module, descriptor, symbol) => {
  const implementation = module[symbol];
  if (typeof implementation !== "function") {
    throw new Error(`missing private ABI symbol ${symbol} for ${descriptor.id}`);
  }
  return implementation;
};

const assertPublicName = name => {
  if (name.startsWith("_")) {
    throw new Error(`public binding names cannot start with _: ${name}`);
  }
};

const bridgeError = (descriptor, binding, code, message, details) =>
  new LeanBridgeError(message, {
    code,
    library: descriptor.id,
    operation: binding.name,
    details,
  });

const classIdentity = (descriptor, bindingName) =>
  `${identity(descriptor)}:${bindingName}`;

const decodeHandleToken = token => ({
  side: token >>> 31,
  kind: (token >>> 24) & 0x7f,
  generation: (token >>> 12) & 0x0fff,
  slot: token & 0x0fff,
});

const encodeHostToken = (slot, generation, kind) =>
  (
    0x8000_0000 |
    ((kind & 0x7f) << 24) |
    ((generation & 0x0fff) << 12) |
    (slot + 1)
  ) >>> 0;

class RuntimeRegistry {
  constructor(module, options) {
    this.module = module;
    this.runtimeId = nextRuntimeIdentity;
    nextRuntimeIdentity += 1;
    this.epoch = 1;
    this.state = "open";
    this.entries = new Map();
    this.classes = new Map();
    this.hostSlots = [];
    this.hostObjectTokens = new WeakMap();
    this.pendingFinalizations = [];
    this.createWeakReference =
      options.createWeakReference ?? (target => new WeakRef(target));
    this.counters = {
      wrappersCreated: 0,
      canonicalHits: 0,
      borrows: 0,
      activeBorrows: 0,
      leasesAcquired: 0,
      leasesReleased: 0,
      finalized: 0,
      rejected: 0,
      hostValuesCreated: 0,
      hostCanonicalHits: 0,
      hostBorrows: 0,
      hostActiveBorrows: 0,
      hostLeasesAcquired: 0,
      hostLeasesReleased: 0,
      hostRejected: 0,
    };
    const createFinalizationRegistry =
      options.createFinalizationRegistry ??
      (callback =>
        typeof FinalizationRegistry === "function"
          ? new FinalizationRegistry(callback)
          : undefined);
    this.finalizer = createFinalizationRegistry(holding => {
      this.pendingFinalizations.push(holding);
    });
  }

  reject(descriptor, binding, code, message, details = {}) {
    this.counters.rejected += 1;
    throw bridgeError(descriptor, binding, code, message, {
      runtimeId: this.runtimeId,
      epoch: this.epoch,
      ...details,
    });
  }

  beforeCall(descriptor, binding) {
    this.drainFinalizers();
    if (this.state !== "open") {
      this.reject(
        descriptor,
        binding,
        "runtime-shut-down",
        `the Lean runtime for ${descriptor.id} has been shut down`,
      );
    }
  }

  validateToken(descriptor, binding, token) {
    if (!Number.isInteger(token) || token === 0) {
      this.reject(
        descriptor,
        binding,
        "invalid-handle-token",
        `${binding.name} returned an invalid resource token`,
      );
    }
    const decoded = decodeHandleToken(token >>> 0);
    const expectedSide = binding.handle?.side === "lean" ? 0 : undefined;
    if (
      expectedSide === undefined ||
      decoded.side !== expectedSide ||
      decoded.kind !== binding.handle.kind ||
      decoded.slot === 0 ||
      decoded.generation === 0
    ) {
      this.reject(
        descriptor,
        binding,
        "invalid-handle-token",
        `${binding.name} returned a token with the wrong side or nominal kind`,
        {
          expectedSide: binding.handle?.side,
          expectedKind: binding.handle?.kind,
        },
      );
    }
    return token >>> 0;
  }

  registerClass(descriptor, binding, projectedClass) {
    this.classes.set(classIdentity(descriptor, binding.name), {
      descriptor,
      binding,
      projectedClass,
    });
  }

  rejectHost(code, message, details = {}) {
    this.counters.hostRejected += 1;
    throw new LeanBridgeError(message, {
      code,
      library: "bridge/host-registry",
      operation: "hostValue",
      details: {
        runtimeId: this.runtimeId,
        epoch: this.epoch,
        ...details,
      },
    });
  }

  validateHostKind(kind) {
    if (!Number.isInteger(kind) || kind < 1 || kind > 0x7f) {
      this.rejectHost(
        "invalid-handle-kind",
        "host value kind must be an integer from 1 through 127",
        { kind },
      );
    }
  }

  resolveHostEntry(token, expectedKind) {
    this.validateHostKind(expectedKind);
    if (!Number.isInteger(token) || token === 0) {
      this.rejectHost("invalid-handle-token", "host value token is invalid");
    }
    const normalized = token >>> 0;
    const decoded = decodeHandleToken(normalized);
    if (
      decoded.side !== 1 ||
      decoded.kind !== expectedKind ||
      decoded.slot === 0 ||
      decoded.generation === 0
    ) {
      this.rejectHost(
        "wrong-handle-kind",
        "host value token has the wrong side or nominal kind",
        { expectedKind },
      );
    }
    const entry = this.hostSlots[decoded.slot - 1];
    if (
      !entry?.value ||
      entry.retired ||
      entry.kind !== expectedKind ||
      entry.generation !== decoded.generation ||
      entry.leases === 0
    ) {
      this.rejectHost(
        "stale-handle-token",
        "host value token is stale or belongs to another runtime",
        { expectedKind },
      );
    }
    return { entry, normalized, slot: decoded.slot - 1 };
  }

  internHostValue(value, kind) {
    if (this.state !== "open") {
      this.rejectHost("runtime-shut-down", "cannot retain a host value after shutdown");
    }
    this.validateHostKind(kind);
    if (
      (typeof value !== "object" || value === null) &&
      typeof value !== "function"
    ) {
      this.rejectHost(
        "invalid-host-value",
        "retained host values must have object identity",
      );
    }
    let tokensByKind = this.hostObjectTokens.get(value);
    const existingToken = tokensByKind?.get(kind);
    if (existingToken !== undefined) {
      const { entry } = this.resolveHostEntry(existingToken, kind);
      entry.leases += 1;
      this.counters.hostCanonicalHits += 1;
      this.counters.hostLeasesAcquired += 1;
      return existingToken;
    }

    let slot = this.hostSlots.findIndex(entry => !entry.value && !entry.retired);
    if (slot < 0) {
      if (this.hostSlots.length >= 0x0fff) {
        this.rejectHost("registry-capacity", "host value registry is full");
      }
      slot = this.hostSlots.length;
      this.hostSlots.push({
        value: undefined,
        generation: 1,
        kind: 0,
        leases: 0,
        retired: false,
      });
    }
    const entry = this.hostSlots[slot];
    if (entry.generation === 0) entry.generation = 1;
    entry.value = value;
    entry.kind = kind;
    entry.leases = 1;
    const token = encodeHostToken(slot, entry.generation, kind);
    if (!tokensByKind) {
      tokensByKind = new Map();
      this.hostObjectTokens.set(value, tokensByKind);
    }
    tokensByKind.set(kind, token);
    this.counters.hostValuesCreated += 1;
    this.counters.hostLeasesAcquired += 1;
    return token;
  }

  borrowHostValue(token, kind, operation) {
    const { entry } = this.resolveHostEntry(token, kind);
    this.counters.hostBorrows += 1;
    this.counters.hostActiveBorrows += 1;
    try {
      return operation(entry.value);
    } finally {
      this.counters.hostActiveBorrows -= 1;
    }
  }

  releaseHostValue(token, kind) {
    const { entry } = this.resolveHostEntry(token, kind);
    entry.leases -= 1;
    this.counters.hostLeasesReleased += 1;
    if (entry.leases !== 0) return entry.leases;
    const tokensByKind = this.hostObjectTokens.get(entry.value);
    tokensByKind?.delete(kind);
    if (tokensByKind?.size === 0) this.hostObjectTokens.delete(entry.value);
    entry.value = undefined;
    entry.kind = 0;
    if (entry.generation === 0x0fff) {
      entry.retired = true;
    } else {
      entry.generation += 1;
    }
    return 0;
  }

  clearHostValues() {
    for (const entry of this.hostSlots) {
      if (!entry.value || entry.leases === 0) continue;
      const tokensByKind = this.hostObjectTokens.get(entry.value);
      tokensByKind?.delete(entry.kind);
      if (tokensByKind?.size === 0) this.hostObjectTokens.delete(entry.value);
      this.counters.hostLeasesReleased += entry.leases;
      entry.value = undefined;
      entry.kind = 0;
      entry.leases = 0;
    }
  }

  attach(wrapper, descriptor, binding, token, release) {
    const normalized = this.validateToken(descriptor, binding, token);
    const bindingKey = classIdentity(descriptor, binding.name);
    const entryKey = `${bindingKey}:${normalized}`;
    const existing = this.entries.get(entryKey)?.reference.deref();
    if (existing) {
      this.reject(
        descriptor,
        binding,
        "duplicate-owned-handle",
        `${binding.name} returned a resource token that already has a live owner`,
      );
    }
    const state = {
      context: this,
      epoch: this.epoch,
      bindingKey,
      entryKey,
      token: normalized,
      descriptor,
      binding,
      release,
      disposed: false,
    };
    wrapperStates.set(wrapper, state);
    this.entries.set(entryKey, {
      reference: this.createWeakReference(wrapper),
      token: normalized,
      epoch: this.epoch,
      bindingKey,
      descriptor,
      binding,
      release,
    });
    this.finalizer?.register(
      wrapper,
      {
        entryKey,
        token: normalized,
        epoch: this.epoch,
        bindingKey,
        descriptor,
        binding,
        release,
      },
      wrapper,
    );
    this.counters.wrappersCreated += 1;
    this.counters.leasesAcquired += 1;
  }

  requireReceiver(wrapper, descriptor, binding) {
    const state = wrapperStates.get(wrapper);
    if (!state) {
      this.reject(
        descriptor,
        binding,
        "invalid-receiver",
        `${binding.name} requires a generated ${binding.name} instance`,
      );
    }
    if (state.context !== this) {
      this.reject(
        descriptor,
        binding,
        "cross-runtime-handle",
        `${binding.name} belongs to a different Lean runtime`,
      );
    }
    if (state.bindingKey !== classIdentity(descriptor, binding.name)) {
      this.reject(
        descriptor,
        binding,
        "wrong-handle-kind",
        `${binding.name} received a different nominal resource type`,
      );
    }
    if (state.disposed) {
      this.reject(
        descriptor,
        binding,
        "resource-disposed",
        `${binding.name} has been disposed`,
      );
    }
    if (state.epoch !== this.epoch || this.state !== "open") {
      this.reject(
        descriptor,
        binding,
        "runtime-epoch-expired",
        `${binding.name} belongs to an expired runtime epoch`,
      );
    }
    return state;
  }

  liftResource(token, descriptor, method, result) {
    const target = this.classes.get(classIdentity(descriptor, result.name));
    if (!target) {
      this.reject(
        descriptor,
        method,
        "unknown-resource-type",
        `${method.name} returned unknown resource type ${result.name}`,
      );
    }
    const normalized = this.validateToken(
      descriptor,
      target.binding,
      token,
    );
    const entryKey = `${classIdentity(descriptor, result.name)}:${normalized}`;
    const wrapper = this.entries.get(entryKey)?.reference.deref();
    if (!wrapper) {
      this.reject(
        descriptor,
        method,
        result.ownership === "borrowed"
          ? "unrooted-borrow"
          : "missing-retained-owner",
        `${method.name} returned a resource without a live canonical owner`,
        { ownership: result.ownership, resource: result.name },
      );
    }
    this.counters.canonicalHits += 1;
    return wrapper;
  }

  invoke(wrapper, descriptor, binding, method, args) {
    this.beforeCall(descriptor, method);
    const state = this.requireReceiver(wrapper, descriptor, binding);
    this.counters.borrows += 1;
    this.counters.activeBorrows += 1;
    try {
      const result = method.implementation(state.token, ...args);
      if (method.result?.kind === "resource") {
        return this.liftResource(result, descriptor, method, method.result);
      }
      return result;
    } finally {
      this.counters.activeBorrows -= 1;
    }
  }

  releaseEntry(entry, wrapper, reason) {
    this.entries.delete(entry.entryKey ?? `${entry.bindingKey}:${entry.token}`);
    if (wrapper) {
      const state = wrapperStates.get(wrapper);
      if (state) state.disposed = true;
      this.finalizer?.unregister(wrapper);
    }
    const remaining = entry.release(entry.token) >>> 0;
    if (remaining === 0xffff_ffff) {
      this.reject(
        entry.descriptor,
        entry.binding,
        "stale-handle-token",
        `${entry.binding.name} cleanup rejected a stale resource token`,
        { cleanup: reason },
      );
    }
    this.counters.leasesReleased += 1;
    if (reason === "finalizer") this.counters.finalized += 1;
  }

  dispose(wrapper, descriptor, binding) {
    const state = wrapperStates.get(wrapper);
    if (state?.context === this && state.disposed) return false;
    const live = this.requireReceiver(wrapper, descriptor, binding);
    this.releaseEntry(
      {
        ...live,
        entryKey: live.entryKey,
      },
      wrapper,
      "dispose",
    );
    return true;
  }

  drainFinalizers() {
    while (this.pendingFinalizations.length > 0) {
      const holding = this.pendingFinalizations.shift();
      if (holding.epoch !== this.epoch || this.state !== "open") continue;
      const entry = this.entries.get(holding.entryKey);
      if (!entry || entry.reference.deref() !== undefined) continue;
      this.releaseEntry({ ...holding }, undefined, "finalizer");
    }
  }

  snapshot() {
    this.drainFinalizers();
    return Object.freeze({
      runtimeId: this.runtimeId,
      epoch: this.epoch,
      state: this.state,
      resources: Object.freeze({
        live: this.entries.size,
        wrappersCreated: this.counters.wrappersCreated,
        canonicalHits: this.counters.canonicalHits,
        rejected: this.counters.rejected,
      }),
      borrows: Object.freeze({
        total: this.counters.borrows,
        active: this.counters.activeBorrows,
      }),
      leases: Object.freeze({
        acquired: this.counters.leasesAcquired,
        released: this.counters.leasesReleased,
        finalized: this.counters.finalized,
      }),
      hostValues: Object.freeze({
        live: this.hostSlots.filter(entry => entry.value && entry.leases > 0)
          .length,
        created: this.counters.hostValuesCreated,
        canonicalHits: this.counters.hostCanonicalHits,
        rejected: this.counters.hostRejected,
        borrows: this.counters.hostBorrows,
        activeBorrows: this.counters.hostActiveBorrows,
        leasesAcquired: this.counters.hostLeasesAcquired,
        leasesReleased: this.counters.hostLeasesReleased,
      }),
      pendingFinalizations: this.pendingFinalizations.length,
    });
  }

  shutdown() {
    if (this.state === "closed") return true;
    this.drainFinalizers();
    for (const [entryKey, entry] of [...this.entries]) {
      const wrapper = entry.reference.deref();
      this.releaseEntry({ ...entry, entryKey }, wrapper, "shutdown");
    }
    this.clearHostValues();
    const shutdown = this.module._bridge_lean_runtime_shutdown;
    if (typeof shutdown !== "function" || !shutdown()) {
      throw new Error("the Lean runtime rejected bridge shutdown");
    }
    this.state = "closed";
    this.epoch += 1;
    return true;
  }
}

const getRuntimeContext = (module, options = {}) => {
  let context = runtimeContexts.get(module);
  if (!context) {
    context = new RuntimeRegistry(module, options);
    runtimeContexts.set(module, context);
  }
  return context;
};

// Internal POC probes. Generated consumer packages do not export these hooks.
export const __bridgeTest = Object.freeze({
  internHostValue: (module, value, kind) =>
    getRuntimeContext(module).internHostValue(value, kind),
  borrowHostValue: (module, token, kind, operation) =>
    getRuntimeContext(module).borrowHostValue(token, kind, operation),
  releaseHostValue: (module, token, kind) =>
    getRuntimeContext(module).releaseHostValue(token, kind),
  diagnostics: module => getRuntimeContext(module).snapshot(),
});

const initializeBinding = (module, descriptor, binding) => {
  if (!binding.initialize) return;
  const initialize = resolvePrivateFunction(
    module,
    descriptor,
    binding.initialize,
  );
  if (!initialize()) {
    throw bridgeError(
      descriptor,
      binding,
      "runtime-not-ready",
      `failed to initialize the Lean runtime for ${descriptor.id}`,
    );
  }
};

const validateUInt32 = (descriptor, binding, field, value) => {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw bridgeError(
      descriptor,
      binding,
      "invalid-argument",
      `${binding.name}.${field} must be an unsigned 32-bit integer`,
      { field, expected: "uint32" },
    );
  }
  return value;
};

const validateValueFrameInput = (descriptor, binding, adapter, value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw bridgeError(
      descriptor,
      binding,
      "invalid-argument",
      `${binding.name} expects a record value`,
      { expected: "record" },
    );
  }
  if (typeof value.enabled !== "boolean") {
    throw bridgeError(
      descriptor,
      binding,
      "invalid-argument",
      `${binding.name}.enabled must be a boolean`,
      { field: "enabled", expected: "boolean" },
    );
  }
  validateUInt32(descriptor, binding, "count", value.count);
  if (typeof value.label !== "string") {
    throw bridgeError(
      descriptor,
      binding,
      "invalid-argument",
      `${binding.name}.label must be a string`,
      { field: "label", expected: "string" },
    );
  }
  if (!(value.bytes instanceof Uint8Array)) {
    throw bridgeError(
      descriptor,
      binding,
      "invalid-argument",
      `${binding.name}.bytes must be a Uint8Array`,
      { field: "bytes", expected: "Uint8Array" },
    );
  }
  if (!Array.isArray(value.values) && !(value.values instanceof Uint32Array)) {
    throw bridgeError(
      descriptor,
      binding,
      "invalid-argument",
      `${binding.name}.values must be an array of unsigned 32-bit integers`,
      { field: "values", expected: "readonly uint32[]" },
    );
  }
  for (const item of value.values) {
    validateUInt32(descriptor, binding, "values[]", item);
  }

  const label = textEncoder.encode(value.label);
  if (
    label.byteLength > adapter.maxCopyBytes ||
    value.bytes.byteLength > adapter.maxCopyBytes ||
    value.values.length > adapter.maxArrayLength
  ) {
    throw bridgeError(
      descriptor,
      binding,
      "copy-limit-exceeded",
      `${binding.name} input exceeds the declared copied-value limit`,
      {
        labelBytes: label.byteLength,
        byteArrayBytes: value.bytes.byteLength,
        arrayLength: value.values.length,
        maxCopyBytes: adapter.maxCopyBytes,
        maxArrayLength: adapter.maxArrayLength,
      },
    );
  }
  return { label, bytes: value.bytes, values: value.values };
};

const assertValueFrameAdapter = (descriptor, binding, adapter) => {
  if (
    adapter.abiVersion !== 1 ||
    adapter.byteSize !== VALUE_FRAME_V1_BYTES
  ) {
    throw bridgeError(
      descriptor,
      binding,
      "unsupported-adapter",
      `${binding.name} requests an unsupported value-frame layout`,
      {
        abiVersion: adapter.abiVersion,
        byteSize: adapter.byteSize,
      },
    );
  }
};

const projectValueFrameFunction = (
  module,
  descriptor,
  binding,
  implementation,
  context,
) => {
  const adapter = binding.adapter;
  assertValueFrameAdapter(descriptor, binding, adapter);
  const allocate = resolvePrivateFunction(module, descriptor, "_malloc");
  const free = resolvePrivateFunction(module, descriptor, "_free");

  return value => {
    context.beforeCall(descriptor, binding);
    const copied = validateValueFrameInput(
      descriptor,
      binding,
      adapter,
      value,
    );
    initializeBinding(module, descriptor, binding);
    const allocations = [];
    const reserve = byteLength => {
      const pointer = allocate(Math.max(1, byteLength));
      if (!pointer) {
        throw bridgeError(
          descriptor,
          binding,
          "allocation-failed",
          `${binding.name} could not allocate ${byteLength} boundary bytes`,
          { byteLength },
        );
      }
      allocations.push(pointer);
      return pointer;
    };

    try {
      const labelPointer = reserve(copied.label.byteLength);
      const bytesPointer = reserve(copied.bytes.byteLength);
      const valuesPointer = reserve(copied.values.length * Uint32Array.BYTES_PER_ELEMENT);
      const framePointer = reserve(VALUE_FRAME_V1_BYTES);

      let heapBytes = new Uint8Array(module.HEAP8.buffer);
      heapBytes.set(copied.label, labelPointer);
      heapBytes.set(copied.bytes, bytesPointer);
      let heapView = new DataView(module.HEAP8.buffer);
      for (let index = 0; index < copied.values.length; index += 1) {
        heapView.setUint32(valuesPointer + index * 4, copied.values[index], true);
      }

      heapView.setUint32(
        framePointer + valueFrameOffsets.abiVersion,
        adapter.abiVersion,
        true,
      );
      heapView.setUint32(
        framePointer + valueFrameOffsets.byteSize,
        VALUE_FRAME_V1_BYTES,
        true,
      );
      heapView.setUint32(framePointer + valueFrameOffsets.status, 0, true);
      heapView.setUint32(framePointer + valueFrameOffsets.detail, 0, true);
      heapView.setUint32(
        framePointer + valueFrameOffsets.enabled,
        value.enabled ? 1 : 0,
        true,
      );
      heapView.setUint32(
        framePointer + valueFrameOffsets.count,
        value.count,
        true,
      );
      for (const [pointerOffset, lengthOffset, capacityOffset, pointer, length] of [
        [
          valueFrameOffsets.labelPointer,
          valueFrameOffsets.labelLength,
          valueFrameOffsets.labelCapacity,
          labelPointer,
          copied.label.byteLength,
        ],
        [
          valueFrameOffsets.bytesPointer,
          valueFrameOffsets.bytesLength,
          valueFrameOffsets.bytesCapacity,
          bytesPointer,
          copied.bytes.byteLength,
        ],
        [
          valueFrameOffsets.valuesPointer,
          valueFrameOffsets.valuesLength,
          valueFrameOffsets.valuesCapacity,
          valuesPointer,
          copied.values.length,
        ],
      ]) {
        heapView.setUint32(framePointer + pointerOffset, pointer, true);
        heapView.setUint32(framePointer + lengthOffset, length, true);
        heapView.setUint32(framePointer + capacityOffset, length, true);
      }

      const status = implementation(framePointer) >>> 0;
      heapView = new DataView(module.HEAP8.buffer);
      const frameStatus = heapView.getUint32(
        framePointer + valueFrameOffsets.status,
        true,
      );
      const detail = heapView.getUint32(
        framePointer + valueFrameOffsets.detail,
        true,
      );
      if (status !== 0) {
        const code = frameErrorCodes[status] ?? "unknown-frame-error";
        throw bridgeError(
          descriptor,
          binding,
          code,
          `${binding.name} failed at the typed Lean boundary: ${code}`,
          { status, frameStatus, detail },
        );
      }
      if (frameStatus !== 0) {
        throw bridgeError(
          descriptor,
          binding,
          "inconsistent-frame-status",
          `${binding.name} returned inconsistent frame status`,
          { status, frameStatus, detail },
        );
      }

      const labelLength = heapView.getUint32(
        framePointer + valueFrameOffsets.labelLength,
        true,
      );
      const bytesLength = heapView.getUint32(
        framePointer + valueFrameOffsets.bytesLength,
        true,
      );
      const valuesLength = heapView.getUint32(
        framePointer + valueFrameOffsets.valuesLength,
        true,
      );
      heapBytes = new Uint8Array(module.HEAP8.buffer);
      const label = textDecoder.decode(
        heapBytes.slice(labelPointer, labelPointer + labelLength),
      );
      const bytes = heapBytes.slice(bytesPointer, bytesPointer + bytesLength);
      heapView = new DataView(module.HEAP8.buffer);
      const values = [];
      for (let index = 0; index < valuesLength; index += 1) {
        values.push(heapView.getUint32(valuesPointer + index * 4, true));
      }

      return Object.freeze({
        enabled:
          heapView.getUint32(
            framePointer + valueFrameOffsets.enabled,
            true,
          ) !== 0,
        count: heapView.getUint32(
          framePointer + valueFrameOffsets.count,
          true,
        ),
        label,
        bytes,
        values: Object.freeze(values),
      });
    } finally {
      for (const pointer of allocations.reverse()) free(pointer);
    }
  };
};

const projectFunction = (module, descriptor, binding, context) => {
  const implementation = resolvePrivateFunction(
    module,
    descriptor,
    binding.symbol,
  );
  if (!binding.adapter) {
    return (...args) => {
      context.beforeCall(descriptor, binding);
      initializeBinding(module, descriptor, binding);
      return implementation(...args);
    };
  }
  if (binding.adapter.kind === "value-frame-v1") {
    return projectValueFrameFunction(
      module,
      descriptor,
      binding,
      implementation,
      context,
    );
  }
  throw bridgeError(
    descriptor,
    binding,
    "unsupported-adapter",
    `unsupported binding adapter ${binding.adapter.kind}`,
    { kind: binding.adapter.kind },
  );
};

const projectClass = (module, descriptor, binding, context) => {
  const bindingKey = classIdentity(descriptor, binding.name);
  const cached = context.classes.get(bindingKey)?.projectedClass;
  if (cached) return cached;
  if (!binding.handle) {
    throw new Error(`resource binding ${binding.name} is missing handle metadata`);
  }
  const construct = resolvePrivateFunction(
    module,
    descriptor,
    binding.constructor,
  );
  const initialize = binding.initialize
    ? resolvePrivateFunction(module, descriptor, binding.initialize)
    : undefined;
  const dispose = resolvePrivateFunction(module, descriptor, binding.dispose);
  const methods = (binding.methods ?? []).map(method => {
    assertPublicName(method.name);
    return {
      ...method,
      implementation: resolvePrivateFunction(module, descriptor, method.symbol),
    };
  });

  class ProjectedResource {
    constructor(...args) {
      context.beforeCall(descriptor, binding);
      if (initialize && !initialize()) {
        throw new Error(`failed to initialize runtime for ${descriptor.id}`);
      }
      const handle = construct(...args);
      if (!handle) throw new Error(`failed to construct ${binding.name}`);
      context.attach(this, descriptor, binding, handle, dispose);
    }

    dispose() {
      context.dispose(this, descriptor, binding);
    }
  }

  Object.defineProperty(ProjectedResource, "name", { value: binding.name });
  for (const method of methods) {
    Object.defineProperty(ProjectedResource.prototype, method.name, {
      value(...args) {
        return context.invoke(this, descriptor, binding, method, args);
      },
    });
  }
  if (Symbol.dispose) {
    Object.defineProperty(ProjectedResource.prototype, Symbol.dispose, {
      value: ProjectedResource.prototype.dispose,
    });
  }

  context.registerClass(descriptor, binding, ProjectedResource);
  return ProjectedResource;
};

const projectBindings = (module, descriptor, context) => {
  const api = Object.create(null);

  for (const binding of descriptor.bindings ?? []) {
    assertPublicName(binding.name);

    if (binding.kind === "function") {
      Object.defineProperty(api, binding.name, {
        enumerable: true,
        value: projectFunction(module, descriptor, binding, context),
      });
    } else if (binding.kind === "class") {
      Object.defineProperty(api, binding.name, {
        enumerable: true,
        value: projectClass(module, descriptor, binding, context),
      });
    } else {
      throw new Error(
        `unsupported binding kind ${binding.kind} in ${descriptor.id}`,
      );
    }
  }

  return Object.freeze(api);
};

export const createLibrarySurface = (module, descriptor, options = {}) =>
  projectBindings(module, descriptor, getRuntimeContext(module, options));

export const createLibraryLoader = (module, options = {}) => {
  const context = getRuntimeContext(module, options);
  const loaded = new Map();
  const pending = new Map();
  const read = options.readArtifact ?? readArtifact;

  const load = async (descriptor, ancestry = []) => {
    const key = identity(descriptor);
    if (loaded.has(key)) return loaded.get(key);
    if (ancestry.includes(key)) {
      throw new Error(`library dependency cycle at ${key}`);
    }
    if (pending.has(key)) return pending.get(key);

    const operation = (async () => {
      const dependencyAncestry = [...ancestry, key];
      for (const dependency of descriptor.dependencies) {
        await load(dependency, dependencyAncestry);
      }

      // Emscripten routes dynamic-library names through the module locator.
      // Passing an absolute path here would be prefixed a second time by the
      // default Node locator. The production descriptor loader will build the
      // same name→URL map used by PHP-Wasm's locateFile pattern.
      const path = decodeURIComponent(
        descriptor.sideModule.pathname.split("/").at(-1),
      );

      await verifyIntegrity(descriptor, read);
      await module.loadDynamicLibrary(path, {
        global: true,
        loadAsync: true,
        nodelete: true,
      });
      const api = projectBindings(module, descriptor, context);
      loaded.set(key, api);
      return api;
    })();

    pending.set(key, operation);
    try {
      return await operation;
    } finally {
      pending.delete(key);
    }
  };

  return Object.freeze({
    load,
    loaded,
    diagnostics: () => context.snapshot(),
    shutdown: () => context.shutdown(),
  });
};
