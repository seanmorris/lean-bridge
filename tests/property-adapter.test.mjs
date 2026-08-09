import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { createLibrarySurface } from "../poc/link-spike/loader.mjs";
import { analyzeJavaScriptCoverage } from "../src/backends/javascript/coverage.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { compileJavaScriptProjection } from "../src/backends/javascript/projection.mjs";

const propertyFixture = () => {
  const ir = structuredClone(alpha.bindingIr);
  ir.types.find(type => type.id === "lean:Alpha.Box").mutability = "write";
  const getter = ir.declarations.find(
    declaration => declaration.id === "lean:Alpha.Box.read",
  );
  getter.name = "value";
  getter.kind = "property";
  getter.overloadKey = "Box.value.get";
  const setter = structuredClone(getter);
  setter.id = "bridge:Alpha.Box.setValue";
  setter.overloadKey = "Box.value.set(uint32)";
  setter.parameters = [
    {
      name: "value",
      type: { kind: "primitive", name: "uint32" },
      ownership: "copy",
      lifetime: null,
      mutability: "immutable",
      optional: false,
      default: null,
    },
  ];
  setter.result = {
    type: { kind: "primitive", name: "unit" },
    ownership: "copy",
    lifetime: null,
  };
  setter.receiver.mutability = "write";
  setter.mutability = "write";
  setter.effects = ["writes-resource", "fails"];
  setter.assurance = [];
  setter.documentation = {
    summary: "Replace the unsigned value stored in a Box.",
    details: "The generated class exposes an ordinary property setter.",
  };
  setter.source = {
    producer: "bridge",
    declaration: "Alpha.Box.setValue",
    extensions: { "lean-wasm.org/intrinsic": "property-setter-probe" },
  };
  ir.declarations.push(setter);

  const privateAbi = structuredClone(alpha.privateAbi);
  privateAbi.initialize = null;
  privateAbi.declarations["bridge:Alpha.Box.setValue"] = {
    symbol: "_bridge_box_set_value",
    adapter: null,
  };
  return { ir, privateAbi };
};

test("resource lifecycle groups native property getters and setters", () => {
  const { ir, privateAbi } = propertyFixture();
  assert.equal(analyzeJavaScriptCoverage(ir).supported, true);
  const projection = compileJavaScriptProjection(ir, privateAbi);
  const box = projection.bindings.find(binding => binding.name === "Box");
  assert.deepEqual(
    box.properties.map(property => [property.name, property.role]),
    [
      ["value", "getter"],
      ["value", "setter"],
    ],
  );
  assert.equal(box.lifecycle.properties.length, 2);
  assert.deepEqual(box.methods.map(method => method.name), ["identity"]);
});

test("property accessors reject duplicate roles and mismatched types", () => {
  const duplicateFixture = propertyFixture();
  const getter = duplicateFixture.ir.declarations.find(
    declaration => declaration.id === "lean:Alpha.Box.read",
  );
  const duplicate = structuredClone(getter);
  duplicate.id = "bridge:Alpha.Box.duplicateValue";
  duplicate.overloadKey = "Box.value.duplicate";
  duplicate.source.declaration = "Alpha.Box.duplicateValue";
  duplicateFixture.ir.declarations.push(duplicate);
  duplicateFixture.privateAbi.declarations[duplicate.id] = {
    symbol: "_bridge_box_duplicate_value",
    adapter: null,
  };
  assert.throws(
    () => compileJavaScriptProjection(duplicateFixture.ir, duplicateFixture.privateAbi),
    error => error.code === "duplicate-property-accessor",
  );

  const mismatchFixture = propertyFixture();
  mismatchFixture.ir.declarations.find(
    declaration => declaration.id === "bridge:Alpha.Box.setValue",
  ).parameters[0].type.name = "int32";
  assert.throws(
    () => compileJavaScriptProjection(mismatchFixture.ir, mismatchFixture.privateAbi),
    error => error.code === "property-type-mismatch",
  );

  const collisionFixture = propertyFixture();
  collisionFixture.ir.declarations.find(
    declaration => declaration.id === "bridge:Alpha.Box.identity",
  ).name = "value";
  assert.throws(
    () => compileJavaScriptProjection(collisionFixture.ir, collisionFixture.privateAbi),
    error => error.code === "duplicate-public-name",
  );
});

test("native classes expose property access without helper methods or handles", () => {
  const { ir, privateAbi } = propertyFixture();
  const projection = compileJavaScriptProjection(ir, privateAbi);
  const binding = projection.bindings.find(binding => binding.name === "Box");
  const token = ((1 << 24) | (1 << 12) | 1) >>> 0;
  let stored = 0;
  const module = {
    _bridge_lean_alpha_make(value) {
      stored = value;
      return token;
    },
    _bridge_lean_alpha_read: () => stored,
    _bridge_box_set_value(_token, value) {
      stored = value;
      return undefined;
    },
    _bridge_lean_handle_identity: value => value,
    _bridge_lean_release: () => 0,
  };
  const api = createLibrarySurface(module, {
    id: "poc/property@0.0.0",
    buildHash: "property-test",
    bindingIr: ir,
    bindings: Object.freeze([binding]),
  });

  const box = new api.Box(7);
  assert.equal(box.value, 7);
  box.value = 42;
  assert.equal(box.value, 42);
  assert.equal(typeof box.read, "undefined");
  assert.equal(Object.prototype.hasOwnProperty.call(box, "value"), false);
  assert.throws(() => {
    box.value = -1;
  }, error => error.code === "invalid-argument");
  box.dispose();
});

test("generated JavaScript and TypeScript use native property syntax", async () => {
  const { ir } = propertyFixture();
  const files = generateJavaScriptPackage(ir);
  assert.match(files["index.mjs"], /get value\(\)/);
  assert.match(files["index.mjs"], /set value\(value\)/);
  assert.doesNotMatch(files["index.mjs"], /\n  (?:get|set)Value\(/);
  assert.match(files["index.d.ts"], /\n  value: number;/);

  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-property-"));
  try {
    for (const [relativePath, source] of Object.entries({
      ...files,
      "internal/runtime.mjs": `
const values = new WeakMap();
export const runtime = Object.freeze({
  construct(_declaration, receiver, args) { values.set(receiver, args[0]); },
  method(declaration, receiver, args) {
    if (declaration === "lean:Alpha.Box.read") return values.get(receiver);
    if (declaration === "bridge:Alpha.Box.setValue") { values.set(receiver, args[0]); return undefined; }
    if (declaration === "bridge:Alpha.Box.identity") return receiver;
    throw new Error("unknown member");
  },
  call() {},
  dispose(receiver) { values.delete(receiver); },
});
`,
    })) {
      const destination = join(directory, relativePath);
      await mkdir(join(destination, ".."), { recursive: true });
      await writeFile(destination, source);
    }
    const module = await import(
      `${pathToFileURL(join(directory, "index.mjs")).href}?test=property`
    );
    const box = new module.Box(3);
    assert.equal(box.value, 3);
    box.value = 9;
    assert.equal(box.value, 9);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a getter without a setter becomes a readonly TypeScript property", () => {
  const { ir } = propertyFixture();
  ir.declarations = ir.declarations.filter(
    declaration => declaration.id !== "bridge:Alpha.Box.setValue",
  );
  const files = generateJavaScriptPackage(ir);
  assert.match(files["index.mjs"], /get value\(\)/);
  assert.doesNotMatch(files["index.mjs"], /set value\(/);
  assert.match(files["index.d.ts"], /\n  readonly value: number;/);
});
