/**
 * Build, relocate and execute recursive WIT archives using only public headers.
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
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const digest = async path => sha256(await readFile(path));
const settings = { name: "recursive", version: "1.0.0" };
const enoughSpace = async root => {
	const space = await statfs(root);
	assert.ok(Number(space.bavail) * Number(space.bsize) >= 2 * 1024 ** 3, "Recursive WIT builds need 2 GiB free at each source-path start");
};

const prepare = async ({ author, handoff, environment, reviewed, diagnostic }) => {
	const projectRoot = join(author, "project"), outputRoot = join(author, "release"), ir = nativeRecursiveReviewedIr();
	await saveLakeFile(projectRoot, "Recursive.lean", await nativeRecursiveSource());
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
		, modules: ["Recursive"]
		, ...reviewed ? {} : { exports: ir.declarations.map(item => item.source.declaration) }
		, targets: { "wit-wasi": settings } }));
	if(reviewed) await saveLakeFile(projectRoot, "recursive.binding-ir.json", canonicalJson(ir));
	const before = await lakeInputState(projectRoot);
	diagnostic(`${reviewed ? "reviewed" : "ordinary"}: building WIT-only recursive archive`);
	const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["wit-wasi"], environment })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	assert.deepEqual(await lakeInputState(projectRoot), before);
	const handoffReceipt = await copyPackageSetHandoff(outputRoot, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	assert.equal(handoffReceipt.packages.length, 1); assert.equal(handoffReceipt.packages[0].target, "wit-wasi");
	const nativeRoot = join(outputRoot, "native/component"), runtimeRoot = join(outputRoot, "native/runtime"), adapterRoot = join(outputRoot, "native/c-binding"), witRoot = join(outputRoot, "native/wit-adapter");
	const evidenceOptions = { nativeRoot, runtimeRoot, adapterRoot, settings };
	const { model, receipt, projection, adapter, runtimeIdentity } = await ordinaryWitEvidence(evidenceOptions);
	assert.equal(model.schemaVersion, reviewed ? 5 : 4); assert.equal(model.exports.length, 18);
	assert.equal(adapter.gmp, undefined); assert.equal(adapter.files["include/recursive.h"], undefined);
	assert.ok(Object.keys(adapter.files).every(path => !/gmp|boost/.test(path)));
	assert.equal(projection.manifest.backend, "ordinary-wit-native-graph-v1");
	const releaseOptions = { ...evidenceOptions, witRoot
		, working: join(author, "repackaged")
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, glibcMinimumVersion: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38"
		, environment: copiedCleanEnvironment };
	const repeated = await packageOrdinaryWasi(releaseOptions); assert.deepEqual(repeated.packages, built.packages);
	await rm(releaseOptions.working, { recursive: true, force: true });
	for(const copiedGraph of [undefined, { schemaVersion: 1, layoutSha256: "0".repeat(64) }, { ...adapter.copiedGraph, extra: true }])
	{
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson({ ...adapter, copiedGraph }));
		await assert.rejects(() => ordinaryWitEvidence(evidenceOptions), /WIT C adapter differs/);
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	let sourceRejections = 0;
	for(const [root, recordPath, paths, pattern] of [
		[adapterRoot, "native-c-adapter.json", ["src/native.c", "include/detail/recursive-graph.h", "include/detail/recursive-graph-types.h"], /Generated WIT graph adapter source differs/]
		, [witRoot, "native-wit-adapter.json", ["src/recursive_wasmtime.c", "include/recursive_wasmtime.h", "wit/recursive.wit", "component/recursive.wat", "binding-manifest.json"], /WIT generated source differs/]
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
			sourceRejections++;
		}
	}
	return { pkg: handoffReceipt.packages[0]
		, provenance: { exports: 18
			, bindingIrSha256: model.bindingIrSha256, runtimeIdentity
			, binarySha256: receipt.nativeLibrary.sha256
			, layoutSha256: adapter.copiedGraph.layoutSha256
			, checkedSourceUnchanged: true, witOnly: true
			, deterministicReassembly: true, compilerFreeReassembly: true
			, rejectsGraphReceiptDrift: 3
			, rejectsRegeneratedSourceDrift: sourceRejections } };
};

const install = async ({ root, handoff, pkg, environment }) => {
	const project = join(root, "project"), tools = join(project, "tools"), deployment = join(root, "relocated");
	await mkdir(tools, { recursive: true });
	for(const name of ["as", "ld"]) await symlink(`/usr/bin/${name}`, join(tools, name));
	await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, pkg.artifacts[0].path), "-C", project], project);
	const installed = join(project, `${pkg.name}-${pkg.version}-wit-wasi`), receipt = await json(join(installed, "lean-bridge-package.json"));
	assert.equal(receipt.kind, "lean-bridge-ordinary-wit-package");
	assert.equal(receipt.bindingIrSha256.length, 64); assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.deepEqual(await nativeArtifactPaths(installed), [...Object.keys(receipt.files), "lean-bridge-package.json"].sort());
	await verifyNativeFiles(installed, receipt.files);
	const manifest = await json(join(installed, "binding-manifest.json"));
	assert.equal(manifest.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(manifest.cHost.header, "recursive_wasmtime.h");
	assert.equal(manifest.declarations.length, 18);
	const wasmTools = environment.LEAN_BRIDGE_WASM_TOOLS ?? "wasm-tools";
	const documents = [];
	await runCopied(wasmTools, ["validate", "--features", "component-model", join(installed, "component/recursive.wasm")], project, environment);
	for(const path of ["wit/recursive.wit", "component/recursive.wasm"])
	{
		const document = JSON.parse((await runCopied(wasmTools, ["component", "wit", join(installed, path), "--json"], project, environment)).stdout);
		const shapes = document.interfaces.filter(item => ["native", "api"].includes(item.name)).map(item => Object.entries(item.functions).map(([name, fn]) => ({ name, arity: fn.params.length })).sort((a, b) => a.name.localeCompare(b.name)));
		const expected = nativeRecursiveReviewedIr().declarations.map(item => ({ name: item.name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), arity: item.parameters.length })).sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(shapes, [expected, expected]); documents.push({ path, sha256: receipt.files[path].sha256, shapes });
	}
	const compilerEnvironment = { ...copiedCleanEnvironment, PATH: tools
		, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", `${pkg.name}-wit`], project, compilerEnvironment)).stdout.trim().split(/\s+/);
	assert.equal(flags.length, 5); assert.equal(flags[3], "-lrecursive_wasmtime"); assert.equal(flags[4], "-lwasmtime");
	const probes = {};
	for(const [name, fixture] of [["consumer", "wit-installed"], ["lifetime", "wit-library-lifetime"], ["fault", "wit-result-fault"]])
	{
		const source = await readFile(`tests/fixtures/recursive-consumers/${fixture}.c`, "utf8");
		await saveLakeFile(project, `${name}.c`, source);
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
			, "-UNDEBUG", `${name}.c`, flags[0]
			, ...name !== "lifetime" ? [flags[1], ...flags.slice(3), "-Wl,-rpath,$ORIGIN/lib"] : ["-ldl"]
			, "-o", name], project, compilerEnvironment);
		probes[name] = { sourceSha256: sha256(source), executableSha256: await digest(join(project, name)) };
	}
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
		, "-UNDEBUG", "-fPIC", "-shared", "-DINJECT_RESULT", "fault.c", flags[0]
		, "-o", "result-fault.so"], project, compilerEnvironment);
	probes["result-fault.so"] = { sourceSha256: probes.fault.sourceSha256, executableSha256: await digest(join(project, "result-fault.so")) };
	const libraries = Object.fromEntries(Object.entries(receipt.files).filter(([path]) => /^lib\/[^/]+\.so(?:\.\d+)*$/.test(path)));
	const componentReceipt = await json(join(installed, "share/lean-bridge/component/native-component.json"));
	const runtimeReceipt = await json(join(installed, "share/lean-bridge/runtime.json"));
	assert.deepEqual(Object.keys(libraries).sort(), ["lib/librecursive_wasmtime.so"
		, "lib/librecursive.so", "lib/libwasmtime.so"
		, `lib/${componentReceipt.library}`
		, ...Object.keys(runtimeReceipt.files).filter(path => path.startsWith("lib/"))].sort());
	const dynamic = (await runCopied("/usr/bin/readelf", ["-d", join(installed, "lib/librecursive_wasmtime.so")], project)).stdout;
	assert.match(dynamic, /NODELETE/); assert.match(dynamic, /\$ORIGIN/); assert.doesNotMatch(dynamic, /\.lean-bridge-native-project-/);
	await mkdir(join(deployment, "lib"), { recursive: true });
	for(const path of Object.keys(libraries)) await copyFile(join(installed, path), join(deployment, path));
	for(const name of Object.keys(probes)) await rename(join(project, name), join(deployment, name));
	const archive = pkg.artifacts[0], compiled = await json(join(installed, "native-wit-adapter.json"));
	assert.equal(receipt.files["native-wit-adapter.json"].sha256, sha256(canonicalJson(compiled)));
	await rm(project, { recursive: true, force: true }); await rm(handoff, { recursive: true, force: true });
	assert.deepEqual(await readdir(root), ["relocated"]);
	const observations = [];
	for(let attempt = 0; attempt < 2; attempt++)
	{
		const result = await runCopied(join(deployment, "consumer"), [], deployment);
		assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
		assert.equal(observation.exports, 18); assert.equal(observation.scalarTypes, 19);
		assert.ok(observation.checks >= 50 && observation.calls >= 30 && observation.rejections >= 11);
		assert.equal(observation.compiledLean, true); assert.equal(observation.independentResult, true); assert.equal(observation.trapRecovery, true);
		const expected = Object.keys(libraries).map(path => join(deployment, path));
		assert.deepEqual(observation.loadedLibraries.filter(path => path.startsWith(deployment + "/")).sort(), expected.sort());
		const lifetime = await runCopied(join(deployment, "lifetime"), [join(deployment, "lib/librecursive_wasmtime.so")], deployment);
		assert.equal(lifetime.stderr, "");
		assert.deepEqual(JSON.parse(lifetime.stdout), { notPreloaded: true, resultAfterClose: true, cleanupAfterDlclose: true });
		observations.push({ values: observation, lifetime: JSON.parse(lifetime.stdout) });
	}
	assert.deepEqual(observations[0], observations[1]);
	const faults = {};
	for(const mode of ["malformed", "limit"])
	{
		const result = await runCopied(join(deployment, "fault"), [], deployment, { ...copiedCleanEnvironment
			, LD_PRELOAD: join(deployment, "result-fault.so"), WIT_GRAPH_FAULT: mode });
		assert.equal(result.stderr, ""); faults[mode] = JSON.parse(result.stdout);
		assert.deepEqual(faults[mode], mode === "limit" ? { limitRecoverable: true, twoSessionsUsable: true } : { runtimeRetired: true, twoSessionsRejected: true });
	}
	await verifyNativeFiles(deployment, libraries);
	for(const [name, probe] of Object.entries(probes)) assert.equal(await digest(join(deployment, name)), probe.executableSha256);
	return { archiveSha256: archive.sha256, packageReceipt: receipt
		, compiled, probes, libraries, documents, repeatExecutions: 2
		, observations, faults
		, sourceFreeInstallation: true, compilerFreeExecution: true
		, sourceAndHandoffRemovedBeforeExecution: true, publicHeadersOnly: true
		, offline: true, nodelete: true };
};

/**
 * Execute both authoring paths after deleting every author and install source.
 *
 * @param directory - Test-owned scratch directory.
 * @param diagnostic - Progress callback.
 */
export const checkWitGraphPackages = async (directory, diagnostic = () => {}) => {
	const environment = nativeFixtureEnvironment(["wit-wasi"]), observations = [];
	for(const reviewed of [false, true])
	{
		await enoughSpace(directory);
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), author = join(root, "author"), handoff = join(root, "handoff");
		const { pkg, provenance } = await prepare({ author, handoff, environment, reviewed, diagnostic });
		await rm(author, { recursive: true, force: true }); await assert.rejects(() => readdir(author), { code: "ENOENT" });
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: installing source-free archive and testing library lifetime`);
		const installed = await install({ root: join(root, "consumer"), handoff, pkg, environment });
		observations.push({ reviewed, package: pkg, ...provenance, installed });
		await rm(root, { recursive: true, force: true });
	}
	return { schemaVersion: 1, compiledLean: true, installedPackage: true, observations };
};

/**
 * Recompile independently and compare the exact archives consumed above.
 *
 * @param directory - New test-owned build directory.
 * @param original - Installed gate report, never a generated expectation.
 * @param diagnostic - Progress callback.
 */
export const checkWitGraphReproducibility = async (directory, original, diagnostic = () => {}) => {
	assert.equal(original.installedPackage, true); assert.equal(original.compiledLean, true);
	assert.deepEqual(original.observations.map(run => run.reviewed), [false, true]);
	const environment = nativeFixtureEnvironment(["wit-wasi"]), observations = [];
	for(const reviewed of [false, true])
	{
		await enoughSpace(directory);
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), prior = original.observations.find(run => run.reviewed === reviewed);
		const { pkg, provenance } = await prepare({ author: join(root, "author"), handoff: join(root, "handoff"), environment, reviewed, diagnostic });
		assert.deepEqual(pkg, prior.package);
		for(const [key, value] of Object.entries(provenance)) assert.deepEqual(value, prior[key], key);
		observations.push({ reviewed, package: pkg, ...provenance, originalArchiveSha256: prior.installed.archiveSha256, reproducedOriginalArchive: true });
		await rm(root, { recursive: true, force: true });
	}
	return { schemaVersion: 1, independentBuilds: true, originalReportSha256: sha256(canonicalJson(original)), observations };
};
