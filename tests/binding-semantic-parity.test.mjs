import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { generatePythonBindingPackage } from "../src/backends/python/generate.mjs";
import {
  BindingSemanticParityError,
  compileBindingSemanticContract,
  compileCrossLanguageSemanticParity,
  hashBindingSemanticContract,
} from "../src/binding-ir/semantic-parity.mjs";

const run = promisify(execFile);

const writePackage = async (directory, files) => {
  for (const [relativePath, source] of Object.entries(files)) {
    const destination = join(directory, relativePath);
    await mkdir(join(destination, ".."), { recursive: true });
    await writeFile(destination, source);
  }
};

const advancedFixture = () => {
  const ir = structuredClone(alpha.bindingIr);
  const declaration = ir.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  const asynchronous = structuredClone(declaration);
  asynchronous.id = "bridge:Alpha.roundTripAsync";
  asynchronous.name = "roundTripAsync";
  asynchronous.overloadKey = "roundTripAsync(Payload)";
  asynchronous.resultMode = "promise";
  asynchronous.effects.push("async");
  asynchronous.documentation.summary = "Return the copied payload through an asynchronous host call.";
  asynchronous.source.producer = "bridge";
  asynchronous.source.declaration = "Alpha.roundTripAsync";
  asynchronous.assurance = [];
  ir.declarations.push(asynchronous);

  declaration.name = "echo";
  declaration.overloadKey = "echo<T>(T)";
  declaration.typeParameters = [{ id: "T", representation: "copied", constraints: [] }];
  declaration.parameters = [{
    name: "value",
    type: { kind: "parameter", id: "T" },
    ownership: "copy",
    lifetime: null,
    mutability: "immutable",
    optional: false,
    default: null,
  }];
  declaration.result = {
    type: { kind: "parameter", id: "T" },
    ownership: "copy",
    lifetime: null,
  };
  declaration.source.extensions["lean-wasm.org/specializations"] = [
    { id: "uint32", type: { kind: "primitive", name: "uint32" } },
    { id: "string", type: { kind: "primitive", name: "string" } },
  ];
  return ir;
};

test("one semantic contract resolves callable, ownership, error, documentation, and assurance facts", () => {
  const contract = compileBindingSemanticContract(alpha.bindingIr);
  const payload = contract.types.find(type => type.id === "lean:Alpha.Payload");
  const box = contract.types.find(type => type.id === "lean:Alpha.Box");
  const identity = contract.declarations.find(item => item.id === "bridge:Alpha.Box.identity");
  const callback = contract.declarations.find(item => item.id === "lean:Alpha.withCallback");

  assert.equal(payload.representation, "copied");
  assert.equal(payload.fields[1].type.name, "uint32");
  assert.equal(box.resource.disposal, "required");
  assert.equal(identity.callable.result.ownership, "borrow");
  assert.equal(identity.callable.result.lifetime.anchor, "receiver");
  assert.deepEqual(callback.failure.errors, ["error:callback-threw"]);
  assert.equal(callback.assurance[0].state, "trusted-boundary");
  assert.match(callback.documentation.summary, /JavaScript transform/);
  assert.equal(hashBindingSemanticContract(contract).length, 64);
  assert.equal(Object.isFrozen(contract.declarations), true);
});

test("JavaScript, PHP, Python, C, C++, and Rust packages bind to one semantic contract", () => {
  const report = compileCrossLanguageSemanticParity(alpha.bindingIr);
  assert.deepEqual(report.packages.map(item => item.backend), [
    "javascript",
    "php",
    "python",
    "c",
    "cpp",
    "rust",
  ]);
  assert.equal(new Set(report.packages.map(item => item.bindingIrSha256)).size, 1);
  assert.equal(new Set(report.packages.map(item => item.semanticContractSha256)).size, 1);
  assert.deepEqual(report.packages.map(item => item.projection.delivery), [
    { value: "value" },
    { value: "value" },
    { value: "value" },
    { value: "value and output parameter" },
    { value: "value" },
    { value: "value" },
  ]);
});

test("JavaScript and Python preserve finite generics and asynchronous delivery from the same IR", () => {
  const report = compileCrossLanguageSemanticParity(advancedFixture(), {
    backends: ["javascript", "python"],
  });
  const generic = report.contract.declarations.find(item => item.name === "echo");
  const asynchronous = report.contract.declarations.find(item => item.name === "roundTripAsync");

  assert.deepEqual(generic.genericInstantiations.map(item => item.id), ["uint32", "string"]);
  assert.equal(asynchronous.callable.resultMode, "promise");
  assert.deepEqual(report.packages.map(item => item.projection.delivery.promise), [
    "Promise",
    "Awaitable",
  ]);
  assert.equal(report.packages[0].exports.includes("echo"), true);
  assert.equal(report.packages[1].exports.includes("echo"), true);
});

test("JavaScript and Python execute the same identity, value, callback, and cleanup vector", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-semantic-parity-"));
  try {
    const jsDirectory = join(directory, "javascript");
    const pythonDirectory = join(directory, "python");
    await writePackage(jsDirectory, generateJavaScriptPackage(alpha.bindingIr));
    await writeFile(join(jsDirectory, "internal/runtime.mjs"), `
const values = new WeakMap();
const disposed = new WeakSet();
export const counters = { boxDisposals: 0, transformDisposals: 0 };
export const runtime = Object.freeze({
  construct(_declaration, receiver, args) { values.set(receiver, args[0]); },
  method(declaration, receiver) {
    if (disposed.has(receiver)) throw new Error("disposed resource");
    if (declaration === "lean:Alpha.Box.read") return values.get(receiver);
    if (declaration === "bridge:Alpha.Box.identity") return receiver;
    throw new Error("unknown method");
  },
  call(declaration, args) {
    if (declaration === "lean:Alpha.roundTrip") return Object.freeze({
      enabled: !args[0].enabled,
      count: args[0].count + 1,
      label: args[0].label,
      bytes: new Uint8Array(args[0].bytes),
      values: Object.freeze([...args[0].values]),
    });
    if (declaration === "lean:Alpha.withCallback") return args[1](args[0] + 1) + 1;
    if (declaration === "lean:Alpha.makeAdder") {
      let closed = false;
      const callable = value => {
        if (closed) throw new Error("disposed callback");
        return args[0] + value;
      };
      Object.defineProperties(callable, {
        disposed: { get: () => closed },
        dispose: { value: () => {
          if (closed) return false;
          closed = true;
          counters.transformDisposals += 1;
          return true;
        } },
      });
      return callable;
    }
    throw new Error("unknown function");
  },
  dispose(receiver) {
    if (!disposed.has(receiver)) counters.boxDisposals += 1;
    disposed.add(receiver);
    values.delete(receiver);
  },
});
`);
    const jsModule = await import(`${pathToFileURL(join(jsDirectory, "index.mjs")).href}?semantic-parity`);
    const { counters } = await import(`${pathToFileURL(join(jsDirectory, "internal/runtime.mjs")).href}`);
    const jsBox = new jsModule.Box(41);
    const jsPayload = jsModule.roundTrip({
      enabled: false,
      count: 8,
      label: "typed",
      bytes: new Uint8Array([0, 127, 255]),
      values: [1, 5, 13],
    });
    const jsAdder = jsModule.makeAdder(2);
    const jsTrace = {
      read: jsBox.read(),
      identity: jsBox.identity() === jsBox,
      payload: {
        enabled: jsPayload.enabled,
        count: jsPayload.count,
        label: jsPayload.label,
        bytes: [...jsPayload.bytes],
        values: [...jsPayload.values],
      },
      callback: jsModule.withCallback(40, value => value),
      closure: jsAdder(40),
    };
    jsAdder.dispose();
    jsBox.dispose();
    jsTrace.cleanup = { ...counters };

    await writePackage(pythonDirectory, generatePythonBindingPackage(alpha.bindingIr));
    await writeFile(join(pythonDirectory, "consumer.py"), `
import json
from lean_alpha import Box, Payload, make_adder, round_trip, with_callback
from lean_alpha._runtime import install_runtime

class Runtime:
    def __init__(self):
        self.box_disposals = 0
        self.transform_disposals = 0
    def initialize(self): pass
    def box_new(self, value): return value
    def box_read(self, identity): return identity
    def box_identity(self, identity): return identity
    def round_trip(self, payload):
        return Payload(not payload.enabled, payload.count + 1, payload.label, payload.bytes, payload.values)
    def with_callback(self, value, transform): return transform(value + 1) + 1
    def make_adder(self, base): return base
    def dispose_box(self, _identity): self.box_disposals += 1
    def call_transform(self, identity, value): return identity + value
    def dispose_transform(self, _identity): self.transform_disposals += 1

runtime = Runtime()
install_runtime(runtime)
box = Box(41)
payload = round_trip(Payload(False, 8, "typed", bytes([0, 127, 255]), (1, 5, 13)))
adder = make_adder(2)
trace = {
    "read": box.read(),
    "identity": box.identity() is box,
    "payload": {
        "enabled": payload.enabled,
        "count": payload.count,
        "label": payload.label,
        "bytes": list(payload.bytes),
        "values": list(payload.values),
    },
    "callback": with_callback(40, lambda value: value),
    "closure": adder(40),
}
adder.close()
box.close()
trace["cleanup"] = {
    "boxDisposals": runtime.box_disposals,
    "transformDisposals": runtime.transform_disposals,
}
print(json.dumps(trace, sort_keys=True))
`);
    const { stdout } = await run("python3", ["-B", "consumer.py"], {
      cwd: pythonDirectory,
      env: { ...process.env, PYTHONPATH: pythonDirectory },
    });
    const pythonTrace = JSON.parse(stdout);
    assert.deepEqual(jsTrace, pythonTrace);
    assert.deepEqual(jsTrace.cleanup, { boxDisposals: 1, transformDisposals: 1 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the semantic parity CLI emits the complete machine-readable report", async () => {
  const { stdout } = await run("node", [
    "scripts/binding-semantic-parity.mjs",
    "poc/lean-link-spike/bindings/alpha.binding-ir.json",
    "javascript,python",
  ]);
  const report = JSON.parse(stdout);
  assert.equal(report.component, alpha.id);
  assert.deepEqual(report.packages.map(item => item.backend), ["javascript", "python"]);
  assert.equal(report.contract.declarations.length, alpha.bindingIr.declarations.length);
  assert.throws(
    () => compileCrossLanguageSemanticParity(alpha.bindingIr, { backends: ["javascript"] }),
    error => error instanceof BindingSemanticParityError && error.code === "insufficient-backends",
  );
});
