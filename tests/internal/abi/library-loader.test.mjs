import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { alpha as leanAlpha } from "../../../poc/lean-link-spike/descriptors.mjs";
import {
  __bridgeTest,
  createLibraryLoader,
} from "../../../poc/link-spike/loader.mjs";
import { compileJavaScriptProjection } from "../../../src/backends/javascript/projection.mjs";

const descriptor = ({
  id,
  dependencies = [],
  bindings = [],
  bindingIr,
  bindingIrSha256,
  integrity,
}) =>
  Object.freeze({
    id: `poc/${id}@0.0.0`,
    buildHash: `${id}-hash`,
    dependencies,
    integrity,
    bindingIr,
    bindingIrSha256,
    bindings: Object.freeze(bindings.map(binding => Object.freeze(binding))),
    sideModule: new URL(`file:///artifacts/${id}.so.wasm`),
  });

test("load returns one boring native API for the minimum dependency graph", async () => {
  const linkEvents = [];
  const linkerHandle = Object.freeze({ privateLinkerHandle: true });
  const module = {
    _bridge_call_alpha: value => value + 100,
    _bridge_call_beta: value => value + 1100,
    async loadDynamicLibrary(path) {
      linkEvents.push(path);
      await Promise.resolve();
      return linkerHandle;
    },
  };

  const alpha = descriptor({
    id: "alpha",
    bindings: [
      { kind: "function", name: "add", symbol: "_bridge_call_alpha" },
    ],
  });
  const beta = descriptor({
    id: "beta",
    dependencies: [alpha],
    bindings: [
      { kind: "function", name: "chain", symbol: "_bridge_call_beta" },
    ],
  });
  descriptor({ id: "unrelated" });

  const libraries = createLibraryLoader(module, { libraries: [beta] });
  const [first, concurrent] = await Promise.all([
    libraries.load("beta"),
    libraries.load("beta"),
  ]);

  assert.equal(first, concurrent);
  assert.equal(first, await libraries.load("beta"));
  assert.notEqual(first, linkerHandle);
  assert.equal(Object.isFrozen(first), true);
  assert.deepEqual(Object.keys(first), ["chain"]);
  assert.equal(Object.keys(first).some(name => name.startsWith("_")), false);
  assert.equal("_bridge_call_beta" in first, false);
  assert.equal(first.chain(9), 1109);
  assert.deepEqual(linkEvents, ["alpha.so.wasm", "beta.so.wasm"]);
  assert.equal(libraries.loaded.size, 2);
  await assert.rejects(libraries.load("unrelated"), /unknown library unrelated/);
});

test("load rejects underscore-prefixed public binding names", async () => {
  const module = {
    _bridge_bad: () => 0,
    async loadDynamicLibrary() {},
  };
  const invalid = descriptor({
    id: "invalid",
    bindings: [
      { kind: "function", name: "_bad", symbol: "_bridge_bad" },
    ],
  });

  await assert.rejects(
    createLibraryLoader(module).load(invalid),
    /public binding names cannot start with _/,
  );
});

test("native resource classes defer initialization and hide numeric handles", async () => {
  let initializationRuns = 0;
  let releasedHandle;
  let boxValue;
  const privateToken = (1 << 24) | (1 << 12) | 1;
  const module = {
    _bridge_initialize: () => {
      initializationRuns += 1;
      return 1;
    },
    _bridge_make_box: value => {
      boxValue = value;
      return privateToken;
    },
    _bridge_read_box: () => boxValue,
    _bridge_release: handle => {
      releasedHandle = handle;
    },
    async loadDynamicLibrary() {},
  };
  const readCall = {
    declarationId: "test:Box.read",
    name: "read",
    kind: "method",
    symbol: "_bridge_read_box",
    receiver: {
      typeId: "test:Box",
      ownership: "borrow",
      lifetime: { scope: "call", anchor: null },
    },
    result: { transport: "copy", ownership: "copy", lifetime: null },
    resultMode: "value",
  };
  const lifecycle = {
    kind: "resource-lifecycle-v1",
    abiVersion: 1,
    typeId: "test:Box",
    initialize: "_bridge_initialize",
    handle: { side: "lean", kind: 1 },
    identity: {
      projection: "canonical-wrapper",
      cache: "weak-per-runtime-token",
    },
    disposal: {
      policy: "required",
      explicit: true,
      runtimeShutdown: true,
      fallback: "none",
      cycles: "no-back-edges",
      symbol: "_bridge_release",
    },
    constructor: {
      declarationId: "test:Box.make",
      symbol: "_bridge_make_box",
      result: {
        typeId: "test:Box",
        ownership: "lease",
        lifetime: { scope: "explicit", anchor: null },
      },
      resultMode: "value",
    },
    methods: [readCall],
  };
  const boxes = descriptor({
    id: "boxes",
    bindings: [
      {
        kind: "class",
        name: "Box",
        typeId: "test:Box",
        lifecycle,
        methods: [
          {
            name: "read",
            declarationId: "test:Box.read",
            symbol: "_bridge_read_box",
            call: readCall,
          },
        ],
      },
    ],
  });

  const api = await createLibraryLoader(module).load(boxes);
  assert.equal(initializationRuns, 0);
  assert.deepEqual(Object.keys(api), ["Box"]);

  const box = new api.Box(42);
  assert.equal(initializationRuns, 1);
  assert.equal(box.read(), 42);
  assert.equal("handle" in box, false);
  assert.deepEqual(Object.keys(box), []);

  box.dispose();
  assert.equal(releasedHandle, privateToken);
  box.dispose();
  assert.throws(() => box.read(), /Box has been disposed/);
});

test("artifact integrity is checked before a side module is linked", async () => {
  const bytes = new Uint8Array([0, 97, 115, 109]);
  const expected = createHash("sha256").update(bytes).digest("hex");
  const events = [];
  const module = {
    async loadDynamicLibrary() {
      events.push("linked");
    },
  };
  const library = descriptor({ id: "integrity", integrity: expected });
  const loader = createLibraryLoader(module, {
    readArtifact: async () => {
      events.push("verified");
      return bytes;
    },
  });

  await loader.load(library);
  assert.deepEqual(events, ["verified", "linked"]);

  const corrupt = descriptor({ id: "corrupt", integrity: "0".repeat(64) });
  await assert.rejects(
    loader.load(corrupt),
    /library artifact integrity mismatch.*restore the locked artifact/,
  );
  assert.deepEqual(events, ["verified", "linked", "verified"]);
});

test("generated Promise bindings use the shared pending-operation domain", async () => {
  const bindingIr = structuredClone(leanAlpha.bindingIr);
  const declaration = bindingIr.declarations.find(
    item => item.id === "lean:Alpha.roundTrip",
  );
  declaration.resultMode = "promise";
  declaration.effects.push("async");
  const privateAbi = structuredClone(leanAlpha.privateAbi);
  privateAbi.declarations[declaration.id].adapter = {
    kind: "pending-operation-v1",
    abiVersion: 1,
    cancel: "_bridge_pending_cancel",
  };
  const projection = compileJavaScriptProjection(bindingIr, privateAbi);
  const binding = projection.bindings.find(item => item.declarationId === declaration.id);
  let behavior = "resolve";
  let module;
  module = {
    _bridge_lean_runtime_init: () => 1,
    _bridge_pending_cancel: () => 1,
    _bridge_lean_alpha_round_trip: (token, payload) => {
      if (behavior === "reject-start") return 0;
      queueMicrotask(() =>
        __bridgeTest.resolvePendingOperation(
          module,
          token,
          behavior === "invalid-result"
            ? { ...payload, count: -1 }
            : {
                ...payload,
                enabled: !payload.enabled,
                count: payload.count + 1,
              },
        ),
      );
      return 1;
    },
    async loadDynamicLibrary() {},
  };
  const library = descriptor({
    id: "async-alpha",
    bindingIr,
    bindingIrSha256: projection.bindingIrSha256,
    bindings: [binding],
  });
  const libraries = createLibraryLoader(module);
  const api = await libraries.load(library);

  const result = await api.roundTrip({
    enabled: true,
    count: 41,
    label: "pending",
    bytes: new Uint8Array([0, 255]),
    values: [1, 2, 3],
  });
  assert.deepEqual(result, {
    enabled: false,
    count: 42,
    label: "pending",
    bytes: new Uint8Array([0, 255]),
    values: [1, 2, 3],
  });
  assert.equal(libraries.diagnostics().pendingOperations.resolved, 1);
  assert.equal(libraries.diagnostics().pendingOperations.live, 0);

  behavior = "reject-start";
  await assert.rejects(
    api.roundTrip({
      enabled: true,
      count: 0,
      label: "rejected",
      bytes: new Uint8Array(),
      values: [],
    }),
    error => error.code === "pending-start-rejected",
  );
  assert.equal(libraries.diagnostics().pendingOperations.rejected, 1);

  behavior = "invalid-result";
  await assert.rejects(
    api.roundTrip({
      enabled: true,
      count: 0,
      label: "invalid",
      bytes: new Uint8Array(),
      values: [],
    }),
    error => error.code === "invalid-argument",
  );
  assert.equal(libraries.diagnostics().pendingOperations.resolved, 2);
  assert.equal(libraries.diagnostics().pendingOperations.live, 0);
});
