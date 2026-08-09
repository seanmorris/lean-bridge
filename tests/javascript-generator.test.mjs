import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
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
  assert.doesNotMatch(declarations, /\bany\b|WebAssembly|pointer|handle/i);
});

test("generated files are deterministic and bind to the reviewed IR hash", () => {
  const first = generateJavaScriptPackage(alpha.bindingIr);
  const second = generateJavaScriptPackage(clone(alpha.bindingIr));
  assert.deepEqual(first, second);

  const manifest = JSON.parse(first["binding-manifest.json"]);
  assert.equal(manifest.bindingIrSha256, alpha.bindingIrSha256);
  assert.deepEqual(manifest.exports, ["Box", "roundTrip"]);
  assert.deepEqual(manifest.requiredInternalFiles, ["internal/runtime.mjs"]);
  assert.equal(manifest.files.includes("binding-manifest.json"), true);
});

test("generated JavaScript executes through direct functions and classes", async () => {
  const files = generateJavaScriptPackage(alpha.bindingIr);
  await withGeneratedPackage(
    { ...files, "internal/runtime.mjs": runtimeStub },
    async directory => {
      const module = await import(`${pathToFileURL(join(directory, "index.mjs")).href}?test=consumer`);
      assert.deepEqual(Object.keys(module.default), ["Box", "roundTrip"]);

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

      box.dispose();
      assert.throws(() => box.read(), /disposed resource/);
    },
  );
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
