/**
 * Validate the native Perl profile without requiring a compiler.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { validateExportConfiguration } from "../src/analyze/export-configuration.mjs";
import { createNativeModel, validateNativeType, generateNativeLeanAdapters, nativeCallbackDefault } from "../src/build/native-model.mjs";
import { generatePerlBindingPackage } from "../src/backends/perl/generate.mjs";
import { validateNativeElf } from "../src/build/native-artifacts.mjs";
import { createDeterministicTarGzFromFiles } from "../src/release/deterministic-archive.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { auditGeneratedPublicSurface, generateNativeBindingPackages } from "../src/binding-ir/package-gate.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { execFileSync } from "node:child_process";
import { assertArchiveBytesEqual } from "./helpers/archive-bytes.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { projectNativeMetadata } from "../src/analyze/native-metadata.mjs";
import { createMetadataRequest } from "../src/analyze/elaborated-metadata.mjs";
import { projectElaboratedMetadata } from "../src/analyze/project-elaborated.mjs";

const scalar = { kind: "primitive", name: "uint32", lean: "UInt32", abi: { cType: "uint32_t", box: "lean_box_uint32", unbox: "lean_unbox_uint32", heap: false } };
const fixture = () => createNativeModel({
	component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }
	, moduleName: "LeanBridge::Sample"
	, ...nativeMetadataFixture()
});

test("native projection retains compiler documentation and theorem references without granting assurance", async () => {
	const input = nativeMetadataFixture(), model = fixture();
	await assertJsonSchema("elaborated-export-metadata", input.metadata);
	const declaration = model.bindingIr.declarations[0];
	assert.equal(model.exports[0].parameters[0].name, "value");
	assert.equal(declaration.parameters[0].name, "arg0");
	assert.equal(declaration.documentation.summary, "Increment a word.");
	assert.deepEqual(declaration.source.extensions["lean-lang.org/theorem-references"], ["Sample.increment_spec"]);
	assert.equal(declaration.source.extensions["lean-lang.org/source-position"].startLine, 2);
	assert.deepEqual(declaration.assurance, []);
	assert.deepEqual(model.bindingIr.assurance, []);
	input.metadata.modules[0].declarations[0].typeExpression = "Not a type or an ABI";
	assert.deepEqual(projectNativeMetadata(input.metadata, input.sourceIdentity).declarations[0].result, scalar);
	assert.throws(() => projectElaboratedMetadata({}, [], { request: input.sourceIdentity.request, metadata: input.metadata }), /scalar metadata profile/);
	assert.throws(() => projectNativeMetadata({ schemaVersion: 1, kind: "lean-bridge-native-elaborated-exports", declarations: [] }, input.sourceIdentity), /metadata fields/);
});

test("native metadata rejects stale identities, unbound selection and unchecked representations", () => {
	for(const change of [
		value => { value.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, value => { value.sourceIdentity.leanCompilerSha256 = "0".repeat(64); }
		, value => { value.sourceIdentity.modules[0].interface.interfaceSha256 = "0".repeat(64); }
		, value => { value.sourceIdentity.modules[0].source.path = "../Sample.lean"; }
		, value => { value.sourceIdentity.request.exports = []; }
		, value => { value.sourceIdentity.request.arities = [["Sample.increment", 0]]; }
		, value => { value.sourceIdentity.request.profile = "component-scalars-v1"; }
		, value => { value.sourceIdentity.request.types = [scalar]; }
		, value => { value.metadata.producer.invocationIdentitySha256 = "0".repeat(64); }
		, value => { value.metadata.modules[0].sourceSha256 = "0".repeat(64); }
		, value => { value.metadata.modules[0].declarations[0].projection.bindingShape = "pure-function"; }
		, value => { value.metadata.modules[0].declarations[0].projection.result.abi.cType = "uint64_t"; }
		, value => { value.metadata.modules[0].declarations[0].projection.parameters[0].name = "notTheBinder"; }
		, value => { value.metadata.modules[0].declarations[0].parameters[0].binderInfo = "implicit"; }
		, value => { value.metadata.modules[0].declarations[0].source = null; }
		, value => { value.metadata.modules[0].declarations[0].selected = false; }
	]) {
		const input = nativeMetadataFixture(); change(input);
		assert.throws(() => projectNativeMetadata(input.metadata, input.sourceIdentity));
	}
});

test("native arity and resources stay bound to configuration in the shared report", async () => {
	const input = nativeMetadataFixture(), declaration = input.metadata.modules[0].declarations[0];
	const rebind = changes => {
		const { metadata: context, ...selection } = input.sourceIdentity.request;
		input.sourceIdentity.request = createMetadataRequest({ ...selection, ...changes }, { toolchain: context.toolchain
			, modules: context.modules
			, leanCompilerSha256: input.sourceIdentity.leanCompilerSha256
			, extractorSha256: input.sourceIdentity.extractorSha256 });
		input.metadata.producer.invocationIdentitySha256 = input.sourceIdentity.request.metadata.invocationIdentitySha256;
	};
	const object = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	declaration.projection.result = { kind: "resource", name: "Sample.Counter", lean: "Sample.Counter", module: "Sample", abi: object };
	assert.throws(() => projectNativeMetadata(input.metadata, input.sourceIdentity), /configured source identity/);
	rebind({ resources: ["Sample.Counter"] });
	assert.equal(projectNativeMetadata(input.metadata, input.sourceIdentity).declarations[0].result.kind, "resource");
	await assertJsonSchema("elaborated-export-metadata", input.metadata);
	declaration.projection.result = { kind: "array", element: declaration.projection.result, abi: object };
	assert.throws(() => projectNativeMetadata(input.metadata, input.sourceIdentity), /ownership policy/);
	declaration.projection.result = { kind: "callback", parameters: [scalar], result: scalar, abi: object };
	declaration.parameters.push({ name: "extra", binderInfo: "explicit", typeExpression: "UInt32" });
	assert.throws(() => projectNativeMetadata(input.metadata, input.sourceIdentity), /supported projection/);
	rebind({ arities: [["Sample.increment", 1]] });
	assert.equal(projectNativeMetadata(input.metadata, input.sourceIdentity).declarations[0].result.kind, "callback");
	await assertJsonSchema("elaborated-export-metadata", input.metadata);
});

test("native specializations retain original provenance and require matching concrete selections", async () => {
	const input = nativeMetadataFixture(), declarations = input.metadata.modules[0].declarations;
	const original = declarations[0], concrete = structuredClone(original);
	original.selected = false;
	concrete.identity = "Sample.incrementWord";
	concrete.specialization = { declaration: original.identity, types: ["UInt32"], application: "(@_root_.Sample.increment (@_root_.UInt32))" };
	declarations.push(concrete);
	const { metadata: context, ...selection } = input.sourceIdentity.request;
	input.sourceIdentity.request = createMetadataRequest({ ...selection, exports: [concrete.identity]
		, specializations: [{ name: concrete.identity, declaration: original.identity, types: ["UInt32"] }] }, {
		toolchain: context.toolchain, modules: context.modules
		, leanCompilerSha256: input.sourceIdentity.leanCompilerSha256
		, extractorSha256: input.sourceIdentity.extractorSha256 });
	input.metadata.producer.invocationIdentitySha256 = input.sourceIdentity.request.metadata.invocationIdentitySha256;
	await assertJsonSchema("elaborated-export-metadata", input.metadata);
	const model = createNativeModel({ ...input, component: fixture().component, moduleName: "LeanBridge::Sample" });
	assert.equal(model.exports[0].publicName, "increment_word");
	const declaration = model.bindingIr.declarations[0];
	assert.equal(declaration.source.declaration, original.identity);
	assert.deepEqual(declaration.source.extensions["lean-lang.org/specialization"], { name: concrete.identity, ...concrete.specialization });
	assert.deepEqual(declaration.assurance, []);
	assert.deepEqual(declaration.typeParameters, []);
	assert.ok(generateNativeLeanAdapters(model).leanSource.includes(concrete.specialization.application));
	for(const change of [
		value => { delete value.sourceIdentity.request.specializations; }
		, value => { value.sourceIdentity.request.specializations[0].types = ["String"]; }
		, value => { value.metadata.modules[0].declarations[1].specialization.types = ["String"]; }
		, value => { value.metadata.modules[0].declarations[1].specialization.application = null; }
		, value => { value.metadata.modules[0].declarations[1].specialization.declaration = "Sample.missing"; }
		, value => { value.metadata.modules[0].declarations[1].theoremReferences = []; }
	]) {
		const forged = structuredClone(input); change(forged);
		assert.throws(() => projectNativeMetadata(forged.metadata, forged.sourceIdentity));
	}
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
  assert.match(adapters.leanSource, /_root_\.Sample\.increment a0/);
  assert.match(adapters.leanSource, /a0 : _root_\.UInt32/);
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

test("binary archive assertions reject changed bytes without an unbounded text diff", () => {
	assertArchiveBytesEqual(Buffer.from("same"), Buffer.from("same"));
	assert.throws(() => assertArchiveBytesEqual(Buffer.from("left"), Buffer.from("right")), /Archive bytes differ:.*SHA-256/);
	const result = execFileSync(process.execPath, ["--input-type=module", "-e"
		, `
		import { assertArchiveBytesEqual } from "./tests/helpers/archive-bytes.mjs";
		try { assertArchiveBytesEqual(Buffer.alloc(32768, 1), Buffer.alloc(32768, 2)); }
		catch (error) { console.log(error.message); process.exit(0); }
		process.exit(1);
	`], { encoding: "utf8", timeout: 3000, maxBuffer: 4096 });
	assert.match(result, /^Archive bytes differ:/);
	assert.ok(result.length < 256);
});

test("CPAN stages a versioned runtime from read-only Nix-style templates", async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-readonly-cpan-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const source = join(scratch, "source"), runtimeRoot = join(scratch, "runtime");
	const { includedFiles } = JSON.parse(await readFile("nix/perl-engine-source-boundary.json"));
	for(const path of includedFiles)
	{
		const target = join(source, path);
		await mkdir(dirname(target), { recursive: true });
		await copyFile(path, target);
		await chmod(target, 0o444);
	}
	const template = join(source, "src/backends/perl/Runtime.pm"), before = await readFile(template);
	const elf = Buffer.alloc(64);
	elf.set([0x7f, 69, 76, 70, 2, 1]); elf.writeUInt16LE(3, 16); elf.writeUInt16LE(62, 18);
	const files = {};
	for(const path of ["lib/libleanshared.so", "lib/liblean_bridge_native.so", "include/lean_bridge_native_runtime.h", "include/lean/lean.h"])
	{
		const bytes = path.endsWith(".so") ? elf : Buffer.from("/* fixture */\n");
		await mkdir(dirname(join(runtimeRoot, path)), { recursive: true });
		await writeFile(join(runtimeRoot, path), bytes);
		files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	await writeFile(join(runtimeRoot, "runtime.json"), canonicalJson({ schemaVersion: 1, profile: "native-library-v1", pointerBits: 64, leanCommit: "a".repeat(40), files }));
	const { stageCpanPackage } = await import(pathToFileURL(join(source, "src/release/cpan-package.mjs")));
	const outputRoot = join(scratch, "output");
	await stageCpanPackage({ outputRoot, runtimeRoot, version: "0.009" });
	const rendered = join(outputRoot, "lib/LeanBridge/Runtime.pm");
	assert.match(await readFile(rendered, "utf8"), /our \$VERSION = '0\.009';/);
	assert.ok((await stat(rendered)).mode & 0o200);
	assert.deepEqual(await readFile(template), before);
	assert.equal((await stat(template)).mode & 0o777, 0o444);
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

test("the pinned Perl engine exposes libxcrypt headers outside a Nix build shell", async () => {
	const source = await readFile("flake.nix", "utf8");
	const engine = source.slice(source.indexOf("perl-build-engine = pkgs.writeShellApplication"), source.indexOf("component-build-engine = pkgs.writeShellApplication"));
	assert.match(engine, /export C_INCLUDE_PATH='\$\{pkgs\.lib\.getDev pkgs\.libxcrypt\}\/include'/);
	assert.ok(engine.indexOf("export C_INCLUDE_PATH=") < engine.indexOf("/scripts/run-perl-engine.mjs"));
	assert.doesNotMatch(engine, /export NIX_CFLAGS_COMPILE=/);
});
