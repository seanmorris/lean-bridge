/**
 * Compile resource-bearing carriers against fresh Lean metadata and the real broker.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { compilerExportSelection } from "../../src/analyze/export-configuration.mjs";
import { createMetadataRequest, identifyLeanInterface } from "../../src/analyze/elaborated-metadata.mjs";
import { buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { generateOwnedAggregateCarriers } from "../../src/build/owned-aggregate-carriers.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { ownedAggregateReviewedIr } from "./owned-aggregate-fixture.mjs";
import { readReviewedOwnedSource, reviewedOwnedSourceSelection, verifyReviewedOwnedSourceInputs } from "../../src/analyze/reviewed-owned-source.mjs";

/**
 * Build private carriers, not an installed downstream package.
 *
 * @param t - Test context that removes its exclusively owned scratch directory.
 * @param options - Alternate authored fixture and witness module for value probes.
 */
export const compileOwnedAggregateFixture = async (t, options = {}) => {
	const root = process.cwd(), directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-native-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const run = (command, args, env = {}) => processBuildRunner.capture({ command
		, args
		, cwd: directory
		, env: { ...process.env, ...env }, timeoutMs: 180000 })
		.catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
	const prefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(root, ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2"));
	const lean = join(prefix, "bin/lean"), extractor = join(root, "src/analyze/NativeExports.lean");
	const capture = args => run(lean, args, { LEAN_PATH: directory, PATH: `${join(prefix, "bin")}:${process.env.PATH}` });
	const fixture = join(root, "tests/fixtures/onboarding", options.fixture ?? "owned-aggregates");
	const source = (await readFile(join(fixture, "Owned.lean"), "utf8")) + (options.sourceSuffix ?? "");
	const config = options.configuration ?? JSON.parse(await readFile(join(fixture, "lean-bridge.exports.json"), "utf8"));
	if(options.configuration) await saveLakeFile(directory, "lean-bridge.exports.json", canonicalJson(config));
	let reviewedBindingIr;
	const reviewedConfiguration = { schemaVersion: 1, modules: ["Owned"] };
	const captureReview = async document => {
		const source = canonicalJson(document), path = "api.binding-ir.json";
		await saveLakeFile(directory, path, source);
		await saveLakeFile(directory, "lean-bridge.exports.json", canonicalJson(reviewedConfiguration));
		const inputs = [{ path, bytes: Buffer.byteLength(source), sha256: sha256(source) }];
		const reviewedBindingIr = await readReviewedOwnedSource(directory, {
			inputs, configurationRecord: { configuration: reviewedConfiguration }
		});
		verifyReviewedOwnedSourceInputs({ reviewedBindingIr }, inputs);
		return reviewedBindingIr;
	};
	if(options.reviewedIr !== undefined) reviewedBindingIr = await captureReview(options.reviewedIr);
	await saveLakeFile(directory, "Owned.lean", source);
	await capture(["-o", "Owned.olean", "-c", "Owned.c", "Owned.lean"]);
	const identity = await identifyLeanInterface(join(directory, "Owned.olean"));
	const context = { toolchain: "leanprover/lean4:v4.32.2"
		, ...(reviewedBindingIr ? { reviewedBindingIrSha256: sha256(canonicalJson(reviewedBindingIr)) } : {})
		, extractorSha256: sha256(await readFile(extractor))
		, leanCompilerSha256: sha256(await readFile(lean))
		, modules: [{ name: "Owned", sourcePath: "Owned.lean", sourceSha256: sha256(source), interfaceSha256: identity.interfaceSha256 }] };
	const selection = reviewedBindingIr ? reviewedOwnedSourceSelection(reviewedBindingIr) : {
		exports: config.exports, resources: config.resources
		, arities: Object.entries(config.arities)
		, ...compilerExportSelection(config) };
	const request = createMetadataRequest({ profile: "native-library-v1"
		, modules: ["Owned"], exportModules: ["Owned"], ...selection }, context);
	await saveLakeFile(directory, "request.json", canonicalJson(request));
	const metadata = JSON.parse((await capture(["--run", extractor, "--metadata", "request.json"])).stdout);
	assert.deepEqual(metadata.diagnostics, []);
	const capturedConfiguration = reviewedBindingIr ? reviewedConfiguration : options.configuration ? config : null;
	const sourceIdentity = { request, leanVersion: "4.32.2"
		, ...(reviewedBindingIr ? { reviewedBindingIr } : {})
		, ...(capturedConfiguration ? {
			exportConfigurationSource: canonicalJson(capturedConfiguration)
			, exportConfigurationSha256: sha256(canonicalJson(capturedConfiguration))
		} : {})
		, leanCommit: (await capture(["--githash"])).stdout.trim()
		, leanCompilerSha256: context.leanCompilerSha256
		, extractorSha256: context.extractorSha256
		, sourceTreeSha256: sha256(source)
		, modules: [{ module: "Owned"
			, source: { path: "Owned.lean", sha256: sha256(source) }
			, interface: { sha256: identity.oleanSha256, interfaceSha256: identity.interfaceSha256 } }] };
	const generated = generateOwnedAggregateCarriers({ metadata, sourceIdentity, component: ownedAggregateReviewedIr().component, hostCallbacks: options.hostCallbacks });
	await saveLakeFile(resolve("build/owned-aggregate-native"), options.evidenceName ?? `${options.fixture ?? "owned-aggregates"}${reviewedBindingIr ? "-reviewed" : ""}${options.hostCallbacks ? "-callbacks" : ""}-inputs.json`
		, canonicalJson({ metadata, sourceIdentity, component: generated.model.component }));
	await saveLakeFile(directory, generated.module + ".lean", generated.leanSource);
	await saveLakeFile(directory, "carriers.h", generated.header);
	await capture(["-o", generated.module + ".olean", "-c", "Carriers.c", generated.module + ".lean"]);
	await saveLakeFile(directory, "Witness.lean", options.witness ?? `import Owned
@[export owned_test_record_identity]
def recordIdentity (_ : Unit) : Array (Owned.Bundle → Owned.Bundle) := #[fun value => value]
@[export owned_test_tree_identity]
def treeIdentity (_ : Unit) : Array (Owned.Tree → Owned.Tree) := #[fun value => value]
`);
	await capture(["-o", "Witness.olean", "-c", "Witness.c", "Witness.lean"]);
	const runtime = await buildNativeSharedRuntime({ outputRoot: join(directory, "runtime"), leanPrefix: prefix });
	// Match production components. Non-PIC references can create executable COPY
	// relocations that miss initialization of Lean's shared-library globals.
	for(const name of ["Owned", "Carriers", "Witness"])
		await run("cc", ["-O2", "-g", "-fPIC", "-I", join(runtime.root, "include")
			, ...name === "Carriers" ? ["-include", "carriers.h"] : []
			, "-c", name + ".c", "-o", name + ".o"]);
	if(generated.callbackSource)
	{
		await saveLakeFile(directory, "Callbacks.c", generated.callbackSource);
		await run("cc", ["-O2", "-g", "-I", join(runtime.root, "include"), "-c", "Callbacks.c", "-o", "Callbacks.o"]);
	}
	const compile = async (name, source, sanitized = false, extraInputs = []) => {
		await saveLakeFile(directory, name + ".c", source);
		await run(sanitized ? process.env.LEAN_BRIDGE_SANITIZER_CC ?? "cc" : "cc", [
			"-std=c11", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-pthread"
			, "-I", join(runtime.root, "include")
			, ...sanitized ? ["-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-no-pie"] : []
			, name + ".c", "Owned.o", "Carriers.o", "Witness.o"
			, ...generated.callbackSource ? ["Callbacks.o"] : [], ...extraInputs
			, "-L", join(runtime.root, "lib"), "-llean_bridge_native", "-lleanshared"
			, "-Wl,-rpath," + join(runtime.root, "lib"), "-o", name]);
		return (args = [], env = {}) => run("sh", ["-c", 'ulimit -c 0\nexec "$@"', "owned-native", join(directory, name), ...args]
			, { ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
				, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1", ...env });
	};
	const extractReviewed = async document => {
		const review = await captureReview(document);
		const request = createMetadataRequest({ profile: "native-library-v1"
			, modules: ["Owned"], exportModules: ["Owned"]
			, ...reviewedOwnedSourceSelection(review) }
		, { ...context, reviewedBindingIrSha256: sha256(canonicalJson(review)) });
		await saveLakeFile(directory, "reviewed-request.json", canonicalJson(request));
		const metadata = JSON.parse((await capture(["--run", extractor, "--metadata", "reviewed-request.json"])).stdout);
		assert.deepEqual(metadata.diagnostics, []);
		const reviewedIdentity = { ...sourceIdentity, request
			, reviewedBindingIr: review
			, exportConfigurationSource: canonicalJson(reviewedConfiguration)
			, exportConfigurationSha256: sha256(canonicalJson(reviewedConfiguration)) };
		return { metadata, component: generated.model.component, sourceIdentity: reviewedIdentity };
	};
	return { ...generated, directory, metadata, sourceIdentity, compile, extractReviewed };
};
