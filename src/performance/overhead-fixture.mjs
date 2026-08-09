import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { compileJavaScriptProjection } from "../backends/javascript/projection.mjs";
import { alpha } from "../../poc/lean-link-spike/descriptors.mjs";
import { alphaPrivateAbi } from "../../poc/lean-link-spike/private-abi.mjs";

const clone = value => structuredClone(value);

const uint32Parameter = name => ({
  name,
  type: { kind: "primitive", name: "uint32" },
  ownership: "copy",
  lifetime: null,
  mutability: "immutable",
  optional: false,
  default: null,
});

const uint32Result = () => ({
  type: { kind: "primitive", name: "uint32" },
  ownership: "copy",
  lifetime: null,
});

const makeFunction = ({ id, name, parameters, resultMode, effects, summary, details }) => ({
  id,
  name,
  kind: "function",
  owner: null,
  overloadKey: `${name}(${parameters.map(parameter => "uint32").join(",")})`,
  typeParameters: [],
  receiver: null,
  parameters,
  result: uint32Result(),
  mutability: "immutable",
  effects,
  failure: { mode: "none", errors: [], unexpected: "poison-runtime" },
  resultMode,
  capabilities: ["capability:shared-runtime"],
  assurance: [],
  documentation: { summary, details },
  source: {
    producer: "bridge",
    declaration: `Alpha.${name}`,
    extensions: { "lean-wasm.org/performance-fixture": "generated-adapter" },
  },
});

const bindingIr = clone(alpha.bindingIr);
bindingIr.declarations.push(
  makeFunction({
    id: "bridge:Alpha.deferBoxValue",
    name: "deferBoxValue",
    parameters: [uint32Parameter("value")],
    resultMode: "promise",
    effects: ["allocates", "async"],
    summary: "Resolve a copied value through an ordinary Promise.",
    details: "The private adapter schedules work after the initiating Wasm stack returns and settles exactly once.",
  }),
  makeFunction({
    id: "bridge:Alpha.sequence",
    name: "sequence",
    parameters: [uint32Parameter("start"), uint32Parameter("count")],
    resultMode: "iterator",
    effects: ["allocates"],
    summary: "Iterate copied UInt32 values through the generated iterator protocol.",
    details: "The adapter owns a generation-safe cursor and invokes a Lean closure for every yielded value.",
  }),
);

const privateAbi = clone(alphaPrivateAbi);
privateAbi.declarations["bridge:Alpha.deferBoxValue"] = {
  symbol: "_bridge_lean_alpha_defer_box_value",
  adapter: {
    kind: "pending-operation-v1",
    abiVersion: 1,
    cancel: "_bridge_lean_alpha_cancel_defer_box_value",
  },
};
privateAbi.declarations["bridge:Alpha.sequence"] = {
  symbol: "_bridge_overhead_sequence_create",
  adapter: {
    kind: "iterator-v1",
    abiVersion: 1,
    side: "lean",
    handleKind: 3,
    next: "_bridge_overhead_sequence_next",
    dispose: "_bridge_overhead_sequence_dispose",
  },
};

const projection = compileJavaScriptProjection(bindingIr, privateAbi);

export const overheadDescriptor = Object.freeze({
  ...alpha,
  id: "performance/lean-alpha-overhead@1.0.0",
  buildHash: `${alpha.buildHash}:${projection.bindingIrSha256}`,
  bindingIr,
  bindingIrSha256: projection.bindingIrSha256,
  privateAbi,
  bindings: projection.bindings,
});

const SLOT_MASK = 0x0fff;
const GENERATION_MASK = 0x0fff;
const KIND = 3;
const CAPACITY = 1024;

const encodeToken = (slot, generation) => (
  (KIND << 24) |
  ((generation & GENERATION_MASK) << 12) |
  (slot + 1)
) >>> 0;

export const installOverheadIteratorRuntime = module => {
  const slots = [];
  let transform;
  let created = 0;
  let released = 0;
  let calls = 0;

  const create = (start, count) => {
    let slot = slots.findIndex(entry => entry && entry.state === "free" && !entry.retired);
    if (slot < 0) {
      if (slots.length >= CAPACITY) return 0;
      slot = slots.length;
      slots.push({ generation: 1, state: "free", retired: false });
    }
    const entry = slots[slot];
    entry.state = "live";
    entry.start = start >>> 0;
    entry.count = count >>> 0;
    entry.index = 0;
    entry.token = encodeToken(slot, entry.generation);
    created += 1;
    return entry.token;
  };

  const resolve = token => {
    const slot = (token & SLOT_MASK) - 1;
    const generation = (token >>> 12) & GENERATION_MASK;
    const kind = token >>> 24;
    const entry = slots[slot];
    return kind === KIND && generation !== 0 && entry?.state === "live" &&
      entry.generation === generation && entry.token === (token >>> 0)
      ? { entry, slot }
      : null;
  };

  const next = (token, pointer) => {
    const resolved = resolve(token >>> 0);
    if (!resolved || !transform) return 1;
    const view = new DataView(module.HEAP8.buffer);
    view.setUint32(pointer, 1, true);
    view.setUint32(pointer + 4, 20, true);
    view.setUint32(pointer + 12, 0, true);
    if (resolved.entry.index >= resolved.entry.count) {
      view.setUint32(pointer + 8, 1, true);
      return 0;
    }
    const input = (resolved.entry.start + resolved.entry.index) >>> 0;
    const value = transform(input);
    resolved.entry.index += 1;
    calls += 1;
    view.setUint32(pointer + 8, 0, true);
    view.setUint32(pointer + 16, value >>> 0, true);
    return 0;
  };

  const dispose = token => {
    const resolved = resolve(token >>> 0);
    if (!resolved) return 0xffff_ffff;
    const { entry } = resolved;
    entry.state = "free";
    entry.token = undefined;
    entry.start = undefined;
    entry.count = undefined;
    entry.index = undefined;
    if (entry.generation === GENERATION_MASK) entry.retired = true;
    else entry.generation += 1;
    released += 1;
    return slots.filter(candidate => candidate?.state === "live").length;
  };

  Object.defineProperties(module, {
    _bridge_overhead_sequence_create: { configurable: true, value: create },
    _bridge_overhead_sequence_next: { configurable: true, value: next },
    _bridge_overhead_sequence_dispose: { configurable: true, value: dispose },
  });

  return Object.freeze({
    setTransform(value) {
      if (typeof value !== "function") throw new TypeError("sequence transform must be callable");
      transform = value;
    },
    diagnostics: () => Object.freeze({
      created,
      released,
      calls,
      live: slots.filter(entry => entry?.state === "live").length,
    }),
  });
};

export const overheadBindingIrSha256 = hashBindingIr(bindingIr);
