/**
 * Build, authenticate, relocate and consume recursive callable WIT archives.
 * Consumers compile only against installed public headers, without Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, readdir, rename, rm, statfs, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { ordinaryWitEvidence } from "../../src/build/native-wit-artifacts.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { packageOrdinaryWasi } from "../../src/release/native-wasi.mjs";
import { compileCallableWitGraphPackageModel } from "../../src/backends/wit/callable-graph-package.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nativeRecursiveCallableReviewedIr, nativeRecursiveCallableExports, nativeRecursiveCallableArities } from "./native-recursive-callable-fixture.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { witRecursiveCallableValues } from "./wit-recursive-callable-values.mjs";
import { witRecursiveMixedFixture, witRecursivePrimitiveConsumer } from "./wit-recursive-callable-mixed.mjs";
import { witRecursiveCallableMalformed, witRecursiveResultFaultModes } from "./wit-recursive-callable-malformed.mjs";
import { witRecursiveCallableDocumentation } from "./wit-recursive-callable-docs.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const digest = async path => sha256(await readFile(path));
const settings = { name: "structured", version: "1.0.0" };
const typedExpected = { typed: true, callbacks: 4, releases: 1, owned: true, activeClose: true, independentResult: true };

const prepare = async ({ author, handoff, environment, reviewed, diagnostic, fixture, mixed, documentation }) => {
	const projectRoot = join(author, "project"), outputRoot = join(author, "release");
	await saveLakeFile(author, "Documentation.lean", documentation.author);
	await runCopied(join(environment.LEAN_BRIDGE_LEAN_PREFIX, "bin/lean"), ["Documentation.lean"], author, environment);
	await saveLakeFile(projectRoot, "Structured.lean", fixture.source);
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", 'name = "structured"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Structured"\n');
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
		, modules: ["Structured"]
		, ...reviewed ? {} : { exports: fixture.exports, arities: fixture.arities }
		, targets: { "wit-wasi": settings } }));
	if(reviewed) await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(fixture.ir));
	const before = await lakeInputState(projectRoot);
	diagnostic(`${reviewed ? "reviewed" : "ordinary"}: building recursive callable WIT-only archive`);
	const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["wit-wasi"], environment })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	assert.deepEqual(await lakeInputState(projectRoot), before);
	const handoffReceipt = await copyPackageSetHandoff(outputRoot, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	assert.equal(handoffReceipt.packages.length, 1); assert.equal(handoffReceipt.packages[0].target, "wit-wasi");
	const nativeRoot = join(outputRoot, "native/component"), runtimeRoot = join(outputRoot, "native/runtime");
	const adapterRoot = join(outputRoot, "native/c-binding"), witRoot = join(outputRoot, "native/wit-adapter");
	const evidenceOptions = { nativeRoot, runtimeRoot, adapterRoot, settings };
	const { model, receipt, projection, adapter, runtime, runtimeIdentity } = await ordinaryWitEvidence(evidenceOptions);
	assert.equal(model.schemaVersion, reviewed ? 5 : 4); assert.equal(model.exports.length, mixed ? 99 : 33);
	assert.equal(projection.callbacks.size, mixed ? 59 : 18);
	assert.equal(adapter.gmp, undefined); assert.equal(adapter.files["include/structured.h"], undefined);
	assert.ok(Object.keys(adapter.files).every(path => !/gmp|boost/.test(path)));
	assert.equal(projection.manifest.backend, "ordinary-wit-native-callable-graph-v1");
	const releaseOptions = { ...evidenceOptions, witRoot
		, working: join(author, "repackaged")
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, glibcMinimumVersion: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38"
		, environment: copiedCleanEnvironment };
	const repeated = await packageOrdinaryWasi(releaseOptions); assert.deepEqual(repeated.packages, built.packages);
	await rm(releaseOptions.working, { recursive: true, force: true });
	let sourceRejections = 0;
	for(const [root, recordPath, paths, pattern] of [
		[adapterRoot, "native-c-adapter.json", ["src/native.c", "include/detail/structured-graph.h", "include/detail/structured-graph-types.h", "include/detail/structured-callable-borrows.h"], /Generated WIT graph adapter source differs/]
		, [witRoot, "native-wit-adapter.json", ["src/structured_wasmtime.c", "include/structured_wasmtime.h", "wit/structured.wit", "component/structured.wat", "binding-manifest.json"], /WIT generated source differs/]
	]) {
		const originalRecord = await json(join(root, recordPath));
		for(const path of paths)
		{
			const original = await readFile(join(root, path), "utf8"), changed = original + "\n/* re-signed drift */\n";
			await saveLakeFile(root, path, changed);
			await saveLakeFile(root, recordPath, canonicalJson({ ...originalRecord, files: { ...originalRecord.files
				, [path]: { bytes: Buffer.byteLength(changed), sha256: sha256(changed) } } }));
			await assert.rejects(() => packageOrdinaryWasi(releaseOptions), pattern);
			await saveLakeFile(root, path, original); await saveLakeFile(root, recordPath, canonicalJson(originalRecord));
			++sourceRejections;
		}
	}
	return { pkg: handoffReceipt.packages[0]
		, provenance: { exports: model.exports.length
			, callbacks: projection.callbacks.size
			, model, receipt, adapter, runtime
			, metadata: await json(join(nativeRoot, "metadata.json"))
			, componentFiles: (await json(join(nativeRoot, "artifacts.json"))).files
			, producerSources: before
			, sourceSha256: sha256(fixture.source)
			, documentation: { authorSha256: sha256(documentation.author)
				, configurationSha256: sha256(documentation.configuration)
				, consumerSha256: sha256(documentation.example.source)
				, standaloneLeanChecked: true, compiledVerbatim: true }
			, bindingIrSha256: model.bindingIrSha256, runtimeIdentity
			, binarySha256: receipt.nativeLibrary.sha256
			, layoutSha256: adapter.copiedGraph.layoutSha256
			, checkedSourceUnchanged: true, witOnly: true
			, deterministicReassembly: true, compilerFreeReassembly: true
			, rejectsRegeneratedSourceDrift: sourceRejections } };
};

const install = async ({ root, handoff, pkg, environment, mixed, documentation }) => {
	const project = join(root, "project"), tools = join(project, "tools"), deployment = join(root, "relocated");
	await mkdir(tools, { recursive: true });
	for(const name of ["as", "ld"]) await symlink(`/usr/bin/${name}`, join(tools, name));
	await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, pkg.artifacts[0].path), "-C", project], project);
	const installed = join(project, `${pkg.name}-${pkg.version}-wit-wasi`), receipt = await json(join(installed, "lean-bridge-package.json"));
	assert.equal(receipt.kind, "lean-bridge-ordinary-wit-package");
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.deepEqual(await nativeArtifactPaths(installed), [...Object.keys(receipt.files), "lean-bridge-package.json"].sort());
	await verifyNativeFiles(installed, receipt.files);
	const manifest = await json(join(installed, "binding-manifest.json"));
	const ir = await json(join(installed, "share/lean-bridge/component/binding-ir.json"));
	assert.equal(manifest.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(manifest.cHost.header, "structured_wasmtime.h");
	assert.equal(manifest.declarations.length, mixed ? 99 : 33); assert.equal(manifest.callables.length, mixed ? 59 : 18);
	const callback = ir.declarations.find(fn => fn.name === "callRecursive").id;
	const owned = ir.declarations.find(fn => fn.name === "makeRecursive").id;
	const bindings = `#define fixture_callback_create ${manifest.cHost.values.find(item => item.declaration === callback).callbacks[0].create}\n#define fixture_owned_call ${manifest.cHost.values.find(item => item.declaration === owned).invoke}`;
	const source = (await readFile("tests/fixtures/structured-callable-consumers/wit-recursive-typed.c", "utf8")).replace("/* GENERATED_BINDINGS */", bindings);
	const projection = compileCallableWitGraphPackageModel(ir), valueSource = witRecursiveCallableValues(projection);
	const wasmTools = environment.LEAN_BRIDGE_WASM_TOOLS ?? "wasm-tools";
	await runCopied(wasmTools, ["validate", "--features", "component-model", join(installed, "component/structured.wasm")], project, environment);
	const compile = { ...copiedCleanEnvironment, PATH: tools
		, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", `${pkg.name}-wit`], project, compile)).stdout.trim().split(/\s+/);
	assert.equal(flags.length, 5); assert.equal(flags[3], "-lstructured_wasmtime"); assert.equal(flags[4], "-lwasmtime");
	await saveLakeFile(project, "headers.c", '#include "structured_wasmtime.h"\n#include "structured_wasmtime.h"\n');
	for(const [compiler, standard, language] of [["cc", "c11", "c"], ["c++", "c++20", "c++"]])
		await runCopied(`/usr/bin/${compiler}`, [`-std=${standard}`, "-x", language, "-Wall", "-Wextra", "-Werror", flags[0], "-fsyntax-only", "headers.c"], project, compile);
	const probes = {};
	for(const [name, contents] of [["consumer", source], ["values", valueSource], ["documentation", documentation.example.source], ["boundary", witRecursiveCallableMalformed(projection)], ...mixed ? [["primitives", await witRecursivePrimitiveConsumer(projection)]] : []])
	{
		await saveLakeFile(project, `${name}.c`, contents);
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-pthread", `${name}.c`, flags[0], flags[1], ...flags.slice(3), "-ldl", "-Wl,-rpath,$ORIGIN/lib", "-o", name], project, compile);
		probes[name] = { sourceSha256: sha256(contents), executableSha256: await digest(join(project, name)) };
	}
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-fPIC", "-shared", "-DINJECT_RESULT", "boundary.c", flags[0], "-o", "boundary.so"], project, compile);
	probes["boundary.so"] = { sourceSha256: probes.boundary.sourceSha256, executableSha256: await digest(join(project, "boundary.so")) };
	const libraries = Object.fromEntries(Object.entries(receipt.files).filter(([path]) => /^lib\/[^/]+\.so(?:\.\d+)*$/.test(path)));
	assert.equal(Object.keys(libraries).length, 6);
	const dynamic = (await runCopied("/usr/bin/readelf", ["-d", join(installed, "lib/libstructured_wasmtime.so")], project)).stdout;
	assert.match(dynamic, /NODELETE/); assert.match(dynamic, /\$ORIGIN/); assert.doesNotMatch(dynamic, /\.lean-bridge-native-project-/);
	await mkdir(join(deployment, "lib"), { recursive: true });
	for(const path of Object.keys(libraries)) await copyFile(join(installed, path), join(deployment, path));
	for(const name of Object.keys(probes)) await rename(join(project, name), join(deployment, name));
	const compiled = await json(join(installed, "native-wit-adapter.json"));
	const componentBase64 = (await readFile(join(installed, compiled.component))).toString("base64");
	const readme = await readFile(join(installed, "README.md"), "utf8");
	assert.match(readme, /callback.*_create helper/s); assert.match(readme, /original Lean declarations and proof metadata/);
	await rm(project, { recursive: true, force: true }); await rm(handoff, { recursive: true, force: true });
	assert.deepEqual(await readdir(root), ["relocated"]);
	const observations = [];
	for(let attempt = 0; attempt < 2; ++attempt)
	{
		const result = await runCopied(join(deployment, "consumer"), [], deployment);
		assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
		assert.deepEqual(observed, typedExpected);
		const values = await runCopied(join(deployment, "values"), [], deployment);
		assert.equal(values.stderr, ""); const valueObserved = JSON.parse(values.stdout);
		assert.equal(valueObserved.shapes, 9); assert.equal(valueObserved.aliases, 2);
		assert.equal(valueObserved.callbacks, 758); assert.equal(valueObserved.releases, 110);
		assert.equal(valueObserved.rejections, 540);
		assert.equal(valueObserved.optionCases, 7); assert.equal(valueObserved.resultCases, 15);
		assert.equal(valueObserved.nestedCases, 7);
		assert.ok(Number.isSafeInteger(valueObserved.checks) && valueObserved.checks >= valueObserved.callbacks + valueObserved.rejections);
		const example = await runCopied(join(deployment, "documentation"), [], deployment);
		assert.equal(example.stderr, ""); assert.equal(example.stdout, documentation.example.stdout);
		const observation = { typed: observed, values: valueObserved
			, documentation: { verbatim: true, stdout: example.stdout } };
		if(mixed)
		{
			const primitives = await runCopied(join(deployment, "primitives"), [], deployment);
			assert.equal(primitives.stderr, ""); observation.primitives = JSON.parse(primitives.stdout);
			assert.equal(observation.primitives.primitives, 19); assert.equal(observation.primitives.variants, 114);
			assert.equal(observation.primitives.wideUnit, 1); assert.equal(observation.primitives.nativeIdentities, 0);
			assert.ok(observation.primitives.calls > 4800 && observation.primitives.callbacks > 4500 && observation.primitives.finalized > 3000);
		}
		observations.push(observation);
	}
	assert.deepEqual(observations[0], observations[1]);
	const resultFaults = [];
	for(const mode of witRecursiveResultFaultModes)
	{
		const fault = await runCopied(join(deployment, "boundary"), [], deployment, { ...copiedCleanEnvironment
			, LD_PRELOAD: join(deployment, "boundary.so")
			, LEAN_BRIDGE_WIT_RESULT_FAULT: mode });
		assert.equal(fault.stderr, ""); const observed = JSON.parse(fault.stdout);
		assert.deepEqual(observed, { mode, runtimeRetired: !mode.startsWith("limit-"), twoSessionsChecked: true, outputUnchanged: true });
		resultFaults.push(observed);
	}
	await verifyNativeFiles(deployment, libraries);
	for(const [name, probe] of Object.entries(probes)) assert.equal(await digest(join(deployment, name)), probe.executableSha256);
	return { archiveSha256: pkg.artifacts[0].sha256, packageReceipt: receipt
		, compiled, componentBase64, probes, libraries, repeatExecutions: 2
		, observations, resultFaults
		, sourceFreeInstallation: true, compilerFreeExecution: true
		, sourceAndHandoffRemovedBeforeExecution: true, publicHeadersOnly: true
		, offline: true, nodelete: true };
};

/**
 * Accept original archives only after removing their producer and handoff trees.
 *
 * @param directory - Test-owned temporary build and installation root.
 * @param diagnostic - Progress reporter.
 * @param options - Optional primitive and wide-callback companion surface.
 * @param options.mixed - Include all nineteen primitives and the original WIT oracle.
 */
export const checkWitRecursiveCallablePackages = async (directory, diagnostic = () => {}, { mixed = false } = {}) => {
	const environment = nativeFixtureEnvironment(["wit-wasi"]), observations = [];
	const documentation = await witRecursiveCallableDocumentation();
	const fixture = mixed ? await witRecursiveMixedFixture(documentation.source) : { source: documentation.source
		, ir: nativeRecursiveCallableReviewedIr()
		, exports: nativeRecursiveCallableExports
		, arities: nativeRecursiveCallableArities };
	for(const reviewed of [false, true])
	{
		const space = await statfs(directory);
		assert.ok(Number(space.bavail) * Number(space.bsize) >= 2 * 1024 ** 3, "WIT package acceptance requires 2 GiB free");
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), author = join(root, "author"), handoff = join(root, "handoff");
		const { pkg, provenance } = await prepare({ author, handoff, environment, reviewed, diagnostic, fixture, mixed, documentation });
		await rm(author, { recursive: true, force: true }); await assert.rejects(() => readdir(author), { code: "ENOENT" });
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: consuming immutable source-free WIT archive`);
		const installed = await install({ root: join(root, "consumer"), handoff, pkg, environment, mixed, documentation });
		observations.push({ reviewed, package: pkg, ...provenance, installed });
		await rm(root, { recursive: true, force: true });
	}
	return { schemaVersion: 1, compiledLean: true, installedPackage: true, mixed, observations };
};
