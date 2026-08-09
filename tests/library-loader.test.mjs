import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createLibraryLoader } from "../poc/link-spike/loader.mjs";

const descriptor = ({ id, dependencies = [], bindings = [], integrity }) =>
  Object.freeze({
    id: `poc/${id}@0.0.0`,
    buildHash: `${id}-hash`,
    dependencies,
    integrity,
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

  const libraries = createLibraryLoader(module);
  const [first, concurrent] = await Promise.all([
    libraries.load(beta),
    libraries.load(beta),
  ]);

  assert.equal(first, concurrent);
  assert.equal(first, await libraries.load(beta));
  assert.notEqual(first, linkerHandle);
  assert.equal(Object.isFrozen(first), true);
  assert.deepEqual(Object.keys(first), ["chain"]);
  assert.equal(Object.keys(first).some(name => name.startsWith("_")), false);
  assert.equal("_bridge_call_beta" in first, false);
  assert.equal(first.chain(9), 1109);
  assert.deepEqual(linkEvents, ["alpha.so.wasm", "beta.so.wasm"]);
  assert.equal(libraries.loaded.size, 2);
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
  const boxes = descriptor({
    id: "boxes",
    bindings: [
      {
        kind: "class",
        name: "Box",
        initialize: "_bridge_initialize",
        constructor: "_bridge_make_box",
        dispose: "_bridge_release",
        handle: { side: "lean", kind: 1 },
        methods: [{ name: "read", symbol: "_bridge_read_box" }],
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
