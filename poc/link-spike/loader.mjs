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
) => {
  const adapter = binding.adapter;
  assertValueFrameAdapter(descriptor, binding, adapter);
  const allocate = resolvePrivateFunction(module, descriptor, "_malloc");
  const free = resolvePrivateFunction(module, descriptor, "_free");

  return value => {
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

const projectFunction = (module, descriptor, binding) => {
  const implementation = resolvePrivateFunction(
    module,
    descriptor,
    binding.symbol,
  );
  if (!binding.adapter) {
    return (...args) => {
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

const projectClass = (module, descriptor, binding) => {
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
  const handles = new WeakMap();

  class ProjectedResource {
    constructor(...args) {
      if (initialize && !initialize()) {
        throw new Error(`failed to initialize runtime for ${descriptor.id}`);
      }
      const handle = construct(...args);
      if (!handle) throw new Error(`failed to construct ${binding.name}`);
      handles.set(this, handle);
    }

    dispose() {
      const handle = handles.get(this);
      if (handle === undefined) return;
      handles.delete(this);
      dispose(handle);
    }
  }

  Object.defineProperty(ProjectedResource, "name", { value: binding.name });
  for (const method of methods) {
    Object.defineProperty(ProjectedResource.prototype, method.name, {
      value(...args) {
        const handle = handles.get(this);
        if (handle === undefined) {
          throw new Error(`${binding.name} has been disposed`);
        }
        return method.implementation(handle, ...args);
      },
    });
  }
  if (Symbol.dispose) {
    Object.defineProperty(ProjectedResource.prototype, Symbol.dispose, {
      value: ProjectedResource.prototype.dispose,
    });
  }

  return ProjectedResource;
};

const projectBindings = (module, descriptor) => {
  const api = Object.create(null);

  for (const binding of descriptor.bindings ?? []) {
    assertPublicName(binding.name);

    if (binding.kind === "function") {
      Object.defineProperty(api, binding.name, {
        enumerable: true,
        value: projectFunction(module, descriptor, binding),
      });
    } else if (binding.kind === "class") {
      Object.defineProperty(api, binding.name, {
        enumerable: true,
        value: projectClass(module, descriptor, binding),
      });
    } else {
      throw new Error(
        `unsupported binding kind ${binding.kind} in ${descriptor.id}`,
      );
    }
  }

  return Object.freeze(api);
};

export const createLibrarySurface = (module, descriptor) =>
  projectBindings(module, descriptor);

export const createLibraryLoader = (module, options = {}) => {
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
      const api = createLibrarySurface(module, descriptor);
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

  return Object.freeze({ load, loaded });
};
