/**
 * Authenticate transparent aliases against Lean, preserving nominal API names.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../src/analyze/elaborated-metadata.mjs";
import { createElaboratedSemanticModel, sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { reconcileReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { validateNativeType } from "../src/analyze/native-types.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateNativePrimitiveC } from "../src/backends/c/native-primitives.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { brokerHeader } from "../src/backends/native/runtime-broker.mjs";
import { validateComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { aliasReviewedIr, aliasSignatures } from "./helpers/alias-fixture.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const component = { id: "aliases@1.0.0", name: "aliases", version: "1.0.0" };
const lower = (metadata, request) => createElaboratedSemanticModel({ metadata, request, component, elaborationSha256: sha256(canonicalJson(metadata)) }).document;
const reviewed = ir => {
	const source = canonicalJson(ir);
	return { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) };
};

test("native aliases authenticate their target representation and retain the public name", async () => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	const primitive = structuredClone(projection.result);
	const alias = (name, target) => ({ kind: "alias", name, lean: name, target, abi: { ...primitive.abi } });
	const inner = alias("Sample.Word", primitive), outer = alias("Sample.Count", inner);
	projection.parameters[0].type = outer; projection.result = outer;
	validateElaboratedMetadata(input.metadata, input.sourceIdentity.request);
	await assertJsonSchema("elaborated-export-metadata", input.metadata);
	const model = createNativeModel({ ...input, component });
	assert.equal(model.bindingIr.types.length, 2);
	assert.deepEqual(model.bindingIr.types.find(type => type.name === "Count").target, { kind: "named", id: "lean:Sample.Word" });
	assert.deepEqual(model.exports[0].result, primitive);
	const surface = compilePrimitiveCSurface(model.bindingIr);
	assert.equal(surface.copies.length, 1);
	assert.equal(surface.copy({ kind: "named", id: "lean:Sample.Count" }), surface.copy({ kind: "primitive", name: "uint32" }));
	for(const mutate of [
		value => { value.name = "Other.Count"; }
		, value => { value.target = value; }
		, value => { value.abi = { cType: "uint64_t", box: "lean_box_uint64", unbox: "lean_unbox_uint64", heap: false }; }
		, value => { value.target = { kind: "resource", name: "Sample.Handle", lean: "Sample.Handle", module: "Sample", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } }; }
	]) {
		const changed = structuredClone(outer); mutate(changed);
		assert.throws(() => validateNativeType(changed));
	}
});

test("recorded aliases cover installed source paths and all npm execution contexts", async () => {
	const record = JSON.parse(await readFile("docs/evidence/npm-aliases-20260921.json", "utf8"));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.runs.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.runs)
	{
		assert.equal(run.sourceSha256, record.sourceHashes["tests/fixtures/onboarding/npm-aliases/Aliases.lean"]);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/alias-consumers/npm.mjs"]);
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
		assert.equal(run.sourceRelocatedBeforeInstallation, true);
		assert.deepEqual(run.typescript, { strict: true, executed: true });
		assert.deepEqual(run.result, { checks: 3613, primitives: 19, rejections: 44 });
		assert.deepEqual(run.browsers.map(browser => browser.engine), ["chromium", "firefox", "webkit"]);
		for(const browser of run.browsers)
			for(const context of ["page", "react", "worker"]) assert.deepEqual(browser.result[context], run.result);
		validateComponentPackageReceipt(run.receipt); assert.equal(run.receipt.component.id, "aliases@1.0.0");
	}
	assert.equal(record.runs[0].receipt.runtime.sha256, record.runs[1].receipt.runtime.sha256);
	assert.equal(record.runs[0].receipt.componentArtifactSha256, record.runs[1].receipt.componentArtifactSha256);
});

test("fresh alias metadata agrees across profiles and rejects changed reviewed identities", { skip: process.env.LEAN_BRIDGE_ELABORATED_METADATA_TEST !== "1", timeout: 240000 }, async t => {
	const root = process.cwd(), directory = await mkdtemp(join(tmpdir(), "lean-bridge-alias-metadata-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const prefix = (await processBuildRunner.capture({ command: join(root, ".toolchains/elan/bin/lean"), args: ["--print-prefix"], cwd: root })).stdout.trim();
	const lean = join(prefix, "bin/lean"), extractor = join(root, "src/analyze/NativeExports.lean");
	const capture = args => processBuildRunner.capture({ command: lean, args
		, cwd: directory
		, env: { ...process.env, LEAN_PATH: directory, PATH: `${join(prefix, "bin")}:${process.env.PATH}` }
		, timeoutMs: 120000 });
	await cp(join(root, "tests/fixtures/onboarding/npm-aliases/Aliases.lean"), join(directory, "Aliases.lean"));
	await capture(["-o", "Aliases.olean", "Aliases.lean"]);
	const context = { toolchain: "leanprover/lean4:v4.32.2"
		, modules: [{ name: "Aliases", sourcePath: "Aliases.lean", sourceSha256: sha256(await readFile(join(directory, "Aliases.lean"))), interfaceSha256: (await identifyLeanInterface(join(directory, "Aliases.olean"))).interfaceSha256 }]
		, extractorSha256: sha256(await readFile(extractor))
		, leanCompilerSha256: sha256(await readFile(lean)) };
	const nativeIdentity = {
		leanVersion: "4.32.2"
		, leanCommit: (await capture(["--githash"])).stdout.trim()
		, sourceTreeSha256: sha256(canonicalJson(context.modules))
		, leanCompilerSha256: context.leanCompilerSha256
		, extractorSha256: context.extractorSha256
		, modules: [{ module: "Aliases"
			, source: { path: "Aliases.lean", sha256: context.modules[0].sourceSha256 }
			, interface: { sha256: sha256(await readFile(join(directory, "Aliases.olean"))), interfaceSha256: context.modules[0].interfaceSha256 } }]
	};
	const config = canonicalJson({ schemaVersion: 1, modules: ["Aliases"] }), identities = [];
	for(const profile of ["native-library-v1", "component-scalars-v1"])
	{
		const run = async names => {
			const request = createMetadataRequest({ profile, modules: ["Aliases"], exportModules: ["Aliases"], exports: names, resources: [], arities: [] }, context);
			await writeFile(join(directory, "request.json"), canonicalJson(request));
			const metadata = JSON.parse((await capture(["--run", extractor, "--metadata", "request.json"])).stdout);
			validateElaboratedMetadata(metadata, request); await assertJsonSchema("elaborated-export-metadata", metadata);
			return { metadata, request };
		};
		const { metadata, request } = await run(aliasSignatures.map(item => item.name));
		const ir = lower(metadata, request), sourceIdentity = { request, exportConfigurationSource: config, exportConfigurationSha256: sha256(config) };
		const authenticated = reconcileReviewedSource(reviewed(aliasReviewedIr()), ir, sourceIdentity);
		assert.equal(authenticated.types.filter(type => type.kind === "alias").length, 28);
		assert.deepEqual(authenticated.declarations.find(item => item.name === "make").result.type, { kind: "named", id: "lean:Aliases.Count" });
		identities.push(sourceApiIdentity(ir).sha256);
		for(const mutate of [
			value => { value.types.find(type => type.name === "AU32").target.name = "uint64"; }
			, value => { value.declarations.find(item => item.name === "increment").parameters[0].type.id = "lean:Aliases.OtherCount"; }
			, value => { value.types.find(type => type.name === "Count").target = { kind: "primitive", name: "uint32" }; }
			, value => { value.types.find(type => type.name === "Count").representation = "identity"; }
		]) {
			const changed = aliasReviewedIr(); mutate(changed);
			assert.throws(() => reconcileReviewedSource(reviewed(changed), ir, sourceIdentity));
		}
		if(profile === "native-library-v1")
		{
			const selected = await run(["Aliases.increment", "Aliases.rows", "Aliases.packets"]);
			const model = createNativeModel({ metadata: selected.metadata, component
				, sourceIdentity: { ...sourceIdentity, ...nativeIdentity, request: selected.request } });
			const source = generateNativePrimitiveC(model, { initializer: `initialize_LeanBridgeNative${"1".repeat(16)}` });
			assert.doesNotMatch(source, /undefined/); assert.match(source, /lb_copy_\d+_in/);
			const adapters = generateNativeLeanAdapters(model);
			const files = { ...generateCBindingPackage(model.bindingIr)
				, [`${adapters.module}.lean`]: adapters.leanSource
				, "include/component.h": adapters.header
				, "include/lean_bridge_native_runtime.h": brokerHeader
				, "native.c": source
				, "prototypes.c": `#include "${adapters.module}.c"\n#include "component.h"\n` };
			for(const [path, contents] of Object.entries(files))
			{ await mkdir(dirname(join(directory, path)), { recursive: true }); await writeFile(join(directory, path), contents); }
			await capture(["-c", `${adapters.module}.c`, `${adapters.module}.lean`]);
			await processBuildRunner.capture({ command: "cc"
				, args: ["-std=c11", "-Werror=implicit-function-declaration"
					, "-Werror=incompatible-pointer-types", "-fsyntax-only"
					, "-Iinclude", "-Iinternal", `-I${join(prefix, "include")}`
					, "native.c", "prototypes.c"]
				, cwd: directory, timeoutMs: 60000 });
		}
	}
	assert.equal(identities[0], identities[1]);
	const depthSource = ["namespace Depth", "abbrev A0 := UInt32"
		, ...Array.from({ length: 33 }, (_, i) => `abbrev A${i + 1} := A${i}`)
		, "def bare : A33 := 0"
		, "def parameter (value : A33) : UInt32 := value", "end Depth"].join("\n");
	await writeFile(join(directory, "Depth.lean"), depthSource);
	await capture(["-o", "Depth.olean", "Depth.lean"]);
	const depthContext = { ...context
		, modules: [{ name: "Depth", sourcePath: "Depth.lean"
			, sourceSha256: sha256(depthSource)
		, interfaceSha256: (await identifyLeanInterface(join(directory, "Depth.olean"))).interfaceSha256 }] };
	for(const profile of ["native-library-v1", "component-scalars-v1"])
	{
		const request = createMetadataRequest({ profile, modules: ["Depth"], exportModules: ["Depth"], exports: ["Depth.bare", "Depth.parameter"], resources: [], arities: [] }, depthContext);
		await writeFile(join(directory, "request.json"), canonicalJson(request));
		const metadata = JSON.parse((await capture(["--run", extractor, "--metadata", "request.json"])).stdout);
		validateElaboratedMetadata(metadata, request);
		for(const declaration of metadata.modules[0].declarations.filter(item => item.selected))
			assert.equal(declaration.projection.status, "unsupported", `${profile}/${declaration.identity}: over-budget aliases must not reduce to a scalar fallback`);
	}
});
