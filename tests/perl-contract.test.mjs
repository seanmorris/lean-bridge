/**
 * Validate the native Perl profile without requiring a compiler.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../src/analyze/export-configuration.mjs";
import { createNativeModel, validateNativeType, generateNativeLeanAdapters, nativeCallbackDefault } from "../src/build/native-model.mjs";
import { generatePerlBindingPackage } from "../src/backends/perl/generate.mjs";
import { validateNativeElf } from "../src/build/native-artifacts.mjs";
import { createDeterministicTarGzFromFiles } from "../src/release/deterministic-archive.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { auditGeneratedPublicSurface, generateNativeBindingPackages } from "../src/binding-ir/package-gate.mjs";

const scalar = { kind: "primitive", name: "uint32", lean: "UInt32", abi: { cType: "uint32_t", box: "lean_box_uint32", unbox: "lean_unbox_uint32", heap: false } };
const fixture = () => createNativeModel({
	component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }
	, moduleName: "LeanBridge::Sample"
	, metadata: { schemaVersion: 1
		, kind: "lean-bridge-native-elaborated-exports"
		, declarations: [
			{ name: "Sample.increment", module: "Sample", parameters: [{ name: "value", type: scalar }], result: scalar }]
	}
	, sourceIdentity: { leanVersion: "4.32.2", modules: [{ module: "Sample", source: { sha256: "a".repeat(64) } }] }
});

test("shared source configuration selects native declarations and CPAN metadata", async () => {
  const config = JSON.parse(await readFile("tests/fixtures/perl/ordinary/lean-bridge.exports.json"));
  assert.equal(validateExportConfiguration(config), config);
  await assertJsonSchema("lean-export-configuration", config);
  for(const invalid of [{ ...config, wasmMemory: 32 }
    , { ...config, schemaVersion: 2 }
    , { ...config, exports: ["bad;system"] }
    , { ...config, arities: { "Workshop.add": -1 } }
    , { ...config, targets: { cpan: { version: "1.2.3" } } }]) assert.throws(() => validateExportConfiguration(invalid));
});

test("Perl requires compiler-checked representations and does not guess from semantic IR", () => {
  assert.throws(() => validateNativeType({ ...scalar, abi: undefined }), /representation/);
  assert.throws(() => validateNativeType({ ...scalar, abi: { ...scalar.abi, cType: "void *; invalid" } }), /representation/);
  assert.throws(() => validateNativeType({ ...scalar, unexpected: true }), /fields/);
  assert.throws(() => generatePerlBindingPackage({ profile: "side-lazy", pointerBits: 32 }, {}), /native-library-v1/);
  const model = fixture();
  assert.equal(model.bindingIr.schemaVersion, 3);
  const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };
  const files = generatePerlBindingPackage(model, receipt);
  assert.match(files["Component.xs"], /lbp_check_interpreter/);
  assert.doesNotMatch(files["Component.xs"], /LBP_ENTER/);
  assert.match(files["lib/LeanBridge/Sample.pm"], /LeanBridge::Runtime/);
  assert.deepEqual(auditGeneratedPublicSurface("perl", files).publicFiles, ["lib/LeanBridge/Sample.pm"]);
  assert.ok(generateNativeBindingPackages(model, { ...receipt, bindingIrSha256: model.bindingIrSha256 }).perl);
  assert.throws(() => generateNativeBindingPackages(model.bindingIr, receipt), /native metadata/);
  assert.throws(() => generatePerlBindingPackage({ ...model, types: [{ ...model.types[0], key: "bad" }] }, receipt), /identity changed/);
});

test("adapters expose explicit typed native prototypes", () => {
  const model = fixture();
  const adapters = generateNativeLeanAdapters(model);
  assert.match(adapters.header, /uint32_t lb_[a-f0-9]+\(uint32_t a0\)/);
  assert.match(adapters.leanSource, /@\[export lb_/);
  assert.throws(() => nativeCallbackDefault({ kind: "resource" }), /callback results/);
});

test("native ELF validation rejects wasm and wrong architecture binaries", () => {
  assert.throws(() => validateNativeElf(Buffer.from("\0asm")), /ELF/);
  const bytes = Buffer.alloc(64);
  bytes.set([0x7f, 69, 76, 70, 2, 1]); bytes.writeUInt16LE(3, 16); bytes.writeUInt16LE(62, 18);
  validateNativeElf(bytes);
  bytes.writeUInt16LE(183, 18);
  assert.throws(() => validateNativeElf(bytes), /x86-64/);
});

test("CPAN archive assembly uses verified byte snapshots", () => {
  const files = [{ path: "Example-0.001/data", bytes: Buffer.from("verified"), mode: 0o644 }];
  assert.deepEqual(createDeterministicTarGzFromFiles({ files, sourceDateEpoch: 1 }), createDeterministicTarGzFromFiles({ files, sourceDateEpoch: 1 }));
  assert.throws(() => createDeterministicTarGzFromFiles({ files: [...files, ...files], sourceDateEpoch: 1 }), /entry/);
  assert.throws(() => createDeterministicTarGzFromFiles({ files: [{ ...files[0], path: "../escape" }], sourceDateEpoch: 1 }), /entry/);
});

test("the Nix Perl source boundary includes the complete import and template closure", async () => {
  const { includedFiles } = JSON.parse(await readFile("nix/perl-engine-source-boundary.json"));
  const paths = new Set(includedFiles.map(path => resolve(path)));
  for(const path of includedFiles)
{
    const source = await readFile(path, "utf8");
    if(!path.endsWith(".mjs")) continue;
    for(const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) assert.ok(paths.has(resolve(dirname(path), match[1])), `${path}: ${match[1]}`);
}
  for(const template of ["Build.pm", "Platform.pm", "Runtime.pm", "Runtime.xs", "runtime.h"]) assert.ok(paths.has(resolve("src/backends/perl", template)));
  for(const template of ["src/analyze/NativeExports.lean", "src/build/ResolveLakeWorkspace.lean"]) assert.ok(paths.has(resolve(template)));
});
