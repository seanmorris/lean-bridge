import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import {
  JavaScriptPackageAuditError,
  auditJavaScriptPackage,
} from "../src/backends/javascript/package-audit.mjs";
import { JavaScriptProjectionError } from "../src/backends/javascript/projection.mjs";

const clone = value => structuredClone(value);

const withGeneratedPackage = async (files, operation) => {
  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-js-generator-"));
  try {
    for (const [relativePath, source] of Object.entries(files)) {
      const destination = join(directory, relativePath);
      await mkdir(join(destination, ".."), { recursive: true });
      await writeFile(destination, source);
    }
    await operation(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const runtimeStub = `
const values = new WeakMap();
const disposed = new WeakSet();
const assertLive = receiver => {
  if (disposed.has(receiver)) throw new Error("disposed resource");
};
export const runtime = Object.freeze({
  construct(declaration, receiver, args) {
    if (declaration !== "lean:Alpha.box") throw new Error("unknown constructor");
    values.set(receiver, args[0]);
  },
  method(declaration, receiver) {
    assertLive(receiver);
    if (declaration === "lean:Alpha.Box.read") return values.get(receiver);
    if (declaration === "bridge:Alpha.Box.identity") return receiver;
    throw new Error("unknown method");
  },
  call(declaration, args) {
    if (declaration === "lean:Alpha.withCallback") {
      return args[1](args[0] + 1) + 1;
    }
    if (declaration === "lean:Alpha.makeAdder") {
      let isDisposed = false;
      const callable = value => {
        if (isDisposed) throw new Error("disposed callback");
        return args[0] + value;
      };
      Object.defineProperties(callable, {
        disposed: { get: () => isDisposed },
        dispose: { value: () => { isDisposed = true; return true; } },
      });
      return callable;
    }
    if (declaration !== "lean:Alpha.roundTrip") throw new Error("unknown function");
    const input = args[0];
    return Object.freeze({
      enabled: !input.enabled,
      count: input.count + 1,
      label: input.label,
      bytes: new Uint8Array(input.bytes),
      values: Object.freeze([...input.values]),
    });
  },
  dispose(receiver) {
    assertLive(receiver);
    disposed.add(receiver);
    values.delete(receiver);
  },
});
`;

test("the JavaScript backend emits direct native callables and rich TypeScript types", () => {
  const files = generateJavaScriptPackage(alpha.bindingIr);
  const source = files["index.mjs"];
  const declarations = files["index.d.ts"];

  assert.match(source, /export class Box/);
  assert.match(source, /export function roundTrip\(payload\)/);
  assert.match(source, /export function withCallback\(value, transform\)/);
  assert.match(source, /export function makeAdder\(base\)/);
  assert.match(source, /\bread\(\)/);
  assert.match(source, /\bidentity\(\)/);
  assert.doesNotMatch(source, /\bccall\b|\bcwrap\b|_bridge_|WebAssembly/);

  assert.match(declarations, /export interface Payload/);
  assert.match(declarations, /readonly enabled: boolean/);
  assert.match(declarations, /readonly count: number/);
  assert.match(declarations, /readonly label: string/);
  assert.match(declarations, /readonly bytes: Uint8Array/);
  assert.match(declarations, /readonly values: ReadonlyArray<number>/);
  assert.match(declarations, /export declare class Box/);
  assert.match(declarations, /constructor\(value: number\)/);
  assert.match(declarations, /read\(\): number/);
  assert.match(declarations, /identity\(\): Box/);
  assert.match(declarations, /roundTrip\(payload: Payload\): Payload/);
  assert.match(declarations, /type Transform = \(value: number\) => number/);
  assert.match(
    declarations,
    /withCallback\(value: number, transform: Transform\): number/,
  );
  assert.match(declarations, /interface LeanOwnedCallable/);
  assert.match(
    declarations,
    /makeAdder\(base: number\): Transform & LeanOwnedCallable/,
  );
  assert.doesNotMatch(declarations, /\bany\b|WebAssembly|pointer|handle/i);
});

test("generated files are deterministic and bind to the reviewed IR hash", () => {
  const first = generateJavaScriptPackage(alpha.bindingIr);
  const second = generateJavaScriptPackage(clone(alpha.bindingIr));
  assert.deepEqual(first, second);

  const manifest = JSON.parse(first["binding-manifest.json"]);
  assert.equal(manifest.bindingIrSha256, alpha.bindingIrSha256);
  assert.deepEqual(manifest.exports, ["Box", "roundTrip", "withCallback", "makeAdder"]);
  assert.deepEqual(manifest.generator, { id: "lean-wasm/javascript", version: 1 });
  assert.deepEqual(manifest.requiredInternalFiles, ["internal/runtime.mjs"]);
  assert.equal(manifest.files.includes("binding-manifest.json"), true);
  assert.equal(manifest.files.includes("package.json"), true);

  const packageManifest = JSON.parse(first["package.json"]);
  assert.deepEqual(Object.keys(packageManifest.exports), ["."]);
  assert.deepEqual(packageManifest.exports["."], {
    types: "./index.d.ts",
    import: "./index.mjs",
    default: "./index.mjs",
  });
  assert.equal(packageManifest.files.includes("internal"), true);
});

test("the package audit rejects raw ABI and internal subpath drift", () => {
  const files = generateJavaScriptPackage(alpha.bindingIr);
  assert.deepEqual(auditJavaScriptPackage(alpha.bindingIr, files).exports, [
    "Box",
    "roundTrip",
    "withCallback",
    "makeAdder",
  ]);

  const rawSymbol = { ...files };
  rawSymbol["index.mjs"] += "\nexport const _bridge_escape = 1;\n";
  assert.throws(
    () => auditJavaScriptPackage(alpha.bindingIr, rawSymbol),
    error =>
      error instanceof JavaScriptPackageAuditError &&
      error.code === "public-export-drift",
  );

  const rawTypes = { ...files };
  rawTypes["index.d.ts"] += "\nexport declare const rawHandle: any;\n";
  assert.throws(
    () => auditJavaScriptPackage(alpha.bindingIr, rawTypes),
    error =>
      error instanceof JavaScriptPackageAuditError &&
      error.code === "untyped-public-api",
  );

  const rawHandle = { ...files };
  rawHandle["index.d.ts"] += "\nexport declare const handle: number;\n";
  assert.throws(
    () => auditJavaScriptPackage(alpha.bindingIr, rawHandle),
    error =>
      error instanceof JavaScriptPackageAuditError &&
      error.code === "raw-handle-leak",
  );

  const internalExport = { ...files };
  const packageManifest = JSON.parse(internalExport["package.json"]);
  packageManifest.exports["./internal/*"] = "./internal/*";
  internalExport["package.json"] = `${JSON.stringify(packageManifest, null, 2)}\n`;
  assert.throws(
    () => auditJavaScriptPackage(alpha.bindingIr, internalExport),
    error =>
      error instanceof JavaScriptPackageAuditError &&
      error.code === "package-export-drift",
  );
});

test("generated JavaScript executes through direct functions and classes", async () => {
  const files = generateJavaScriptPackage(alpha.bindingIr);
  await withGeneratedPackage(
    { ...files, "internal/runtime.mjs": runtimeStub },
    async directory => {
      const module = await import(`${pathToFileURL(join(directory, "index.mjs")).href}?test=consumer`);
      assert.deepEqual(
        Object.keys(module.default),
        ["Box", "roundTrip", "withCallback", "makeAdder"],
      );

      const box = new module.Box(41);
      assert.equal(box.read(), 41);
      assert.equal(box.identity(), box);

      const input = Object.freeze({
        enabled: false,
        count: 8,
        label: "typed",
        bytes: new Uint8Array([0, 127, 255]),
        values: Object.freeze([1, 5, 13]),
      });
      const output = module.roundTrip(input);
      assert.deepEqual(output, {
        enabled: true,
        count: 9,
        label: "typed",
        bytes: new Uint8Array([0, 127, 255]),
        values: [1, 5, 13],
      });
      assert.equal(output.bytes instanceof Uint8Array, true);
      assert.notEqual(output.bytes, input.bytes);
      assert.equal(module.withCallback(40, value => value), 42);
      const addTwo = module.makeAdder(2);
      assert.equal(addTwo(40), 42);
      assert.equal(addTwo.disposed, false);
      assert.equal(addTwo.dispose(), true);
      assert.equal(addTwo.disposed, true);
      assert.throws(() => addTwo(40), /disposed callback/);

      box.dispose();
      assert.throws(() => box.read(), /disposed resource/);
    },
  );
});

test("Promise declarations generate an ordinary async function", async () => {
  const ir = clone(alpha.bindingIr);
  const declaration = ir.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  declaration.resultMode = "promise";
  declaration.effects.push("async");
  const files = generateJavaScriptPackage(ir);
  assert.match(files["index.mjs"], /export async function roundTrip\(payload\)/);
  assert.match(
    files["index.d.ts"],
    /roundTrip\(payload: Payload\): Promise<Payload>/,
  );

  await withGeneratedPackage(
    {
      ...files,
      "internal/runtime.mjs": runtimeStub.replace(
        "  call(declaration, args) {",
        "  async call(declaration, args) {",
      ),
    },
    async directory => {
      const module = await import(
        `${pathToFileURL(join(directory, "index.mjs")).href}?test=promise`
      );
      const output = await module.roundTrip({
        enabled: false,
        count: 8,
        label: "async",
        bytes: new Uint8Array([1]),
        values: [2],
      });
      assert.deepEqual(output, {
        enabled: true,
        count: 9,
        label: "async",
        bytes: new Uint8Array([1]),
        values: [2],
      });
    },
  );
});

test("variants and static methods project as native TypeScript surfaces", () => {
  const ir = clone(alpha.bindingIr);
  ir.types.push({
    id: "bridge:Alpha.Lookup",
    name: "Lookup",
    kind: "variant",
    representation: "copied",
    mutability: "immutable",
    typeParameters: [],
    fields: [],
    target: null,
    resource: null,
    callable: null,
    cases: [
      {
        name: "Found",
        fields: [{
          name: "value",
          type: { kind: "primitive", name: "uint32" },
          mutability: "immutable",
          documentation: { summary: "The value.", details: "" },
        }],
        documentation: { summary: "A hit.", details: "" },
      },
      {
        name: "Missing",
        fields: [],
        documentation: { summary: "A miss.", details: "" },
      },
    ],
    host: null,
    documentation: { summary: "A lookup result.", details: "" },
    source: { producer: "bridge", declaration: "Alpha.Lookup", extensions: {} },
    assurance: [],
  });
  const method = clone(ir.declarations.find(item => item.name === "roundTrip"));
  method.id = "bridge:Alpha.Box.lookup";
  method.name = "lookup";
  method.kind = "static-method";
  method.owner = "lean:Alpha.Box";
  method.overloadKey = "Box.lookup(Payload)";
  method.result.type = { kind: "named", id: "bridge:Alpha.Lookup" };
  method.source.declaration = "Alpha.Box.lookup";
  ir.declarations.push(method);

  const files = generateJavaScriptPackage(ir);
  assert.match(
    files["index.d.ts"],
    /export type Lookup = Readonly<\{ readonly kind: "Found"; readonly value: number \}> \| Readonly<\{ readonly kind: "Missing" \}>/,
  );
  assert.match(files["index.d.ts"], /static lookup\(payload: Payload\): Lookup/);
  assert.match(files["index.mjs"], /static lookup\(payload\)/);
  assert.match(files["internal/validators.mjs"], /switch \(value\.kind\)/);
  assert.doesNotMatch(files["index.d.ts"], /tag: number|handle|pointer/i);
});

test("resource members retain Promise and iterator protocols", () => {
  const promise = clone(alpha.bindingIr);
  let method = promise.declarations.find(item => item.name === "read");
  method.resultMode = "promise";
  method.effects.push("async");
  let files = generateJavaScriptPackage(promise);
  assert.match(files["index.mjs"], /async read\(\)/);
  assert.match(files["index.mjs"], /await runtime\.method/);
  assert.match(files["index.d.ts"], /read\(\): Promise<number>/);

  const iterator = clone(alpha.bindingIr);
  method = iterator.declarations.find(item => item.name === "read");
  method.resultMode = "iterator";
  files = generateJavaScriptPackage(iterator);
  assert.match(files["index.d.ts"], /read\(\): Iterable<number>/);
});

test("generated validators reject malformed copied values before dispatch", async () => {
  const files = generateJavaScriptPackage(alpha.bindingIr);
  await withGeneratedPackage(
    { ...files, "internal/runtime.mjs": runtimeStub },
    async directory => {
      const module = await import(`${pathToFileURL(join(directory, "index.mjs")).href}?test=validation`);
      assert.throws(
        () => module.roundTrip({
          enabled: false,
          count: -1,
          label: "invalid",
          bytes: new Uint8Array(),
          values: [],
        }),
        /roundTrip\.payload\.count must be uint32/,
      );
      assert.throws(() => new module.Box(0x1_0000_0000), /box\.value must be uint32/);
    },
  );
});

test("the backend rejects public name collisions instead of changing the API", () => {
  const ir = clone(alpha.bindingIr);
  ir.declarations.find(item => item.id === "lean:Alpha.roundTrip").name = "Box";
  assert.throws(
    () => generateJavaScriptPackage(ir),
    error => error instanceof JavaScriptProjectionError && error.code === "duplicate-public-name",
  );
});
