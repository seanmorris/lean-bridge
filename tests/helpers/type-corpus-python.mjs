/**
 * Build two ordinary libraries, run Lean oracles and consume exact relocated wheels.
 *
 * @file
 */

import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, rm, statfs } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { corpusCases } from "../fixtures/type-corpus/cases.mjs";
import { lakeInputState, lakeWorkspaceFixture, saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { corpusProfiles, validateCorpusObservation } from "./type-corpus.mjs";

const repository = resolve(import.meta.dirname, "../..");
const fixtures = join(repository, "tests/fixtures/type-corpus");
const json = async path => JSON.parse(await readFile(path, "utf8"));
const clean = { PATH: "/unavailable", CC: "/unavailable/compiler"
	, CXX: "/unavailable/compiler"
	, LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean"
	, LEAN_BRIDGE_NATIVE_ROOT: "/unavailable/runtime" };
const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });

const prepare = async (t, library) => {
	const context = await lakeWorkspaceFixture(t, library.id);
	const modules = [library.module, library.pendingModule];
	for(const module of modules)
	{
		const path = `${module.replaceAll(".", "/")}.lean`;
		await saveLakeFile(context.root, path, await readFile(join(fixtures, path)));
	}
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
		, modules: [library.module]
		, exports: library.operations.map(operation => `${library.module}.${operation}`)
		, targets: { pypi: { name: `${library.id}-corpus`, version: "1.0.0" } } }));
	return context;
};

const leanOracle = async (context, library, leanPrefix) => {
	const root = join(context.directory, "oracle");
	const sources = [
		[context.names.remote, join(context.cached, `lib/${context.names.remote}.lean`)]
		, [context.names.local, join(context.local, `${context.names.local}.lean`)]
		, [library.module, join(context.root, `${library.module.replaceAll(".", "/")}.lean`)]
		, [library.pendingModule, join(context.root, `${library.pendingModule.replaceAll(".", "/")}.lean`)]
		, ["Corpus.Wire", join(fixtures, "Corpus/Wire.lean")]
	];
	const lean = join(leanPrefix, "bin/lean");
	const env = { PATH: "/usr/bin:/bin", LEAN_SYSROOT: leanPrefix, LEAN_PATH: join(root, "olean") };
	const modules = [];
	for(const [module, source] of sources)
	{
		const path = `${module.replaceAll(".", "/")}.lean`;
		const bytes = await readFile(source);
		await saveLakeFile(join(root, "source"), path, bytes);
		const olean = join(root, "olean", `${path.slice(0, -5)}.olean`);
		await mkdir(resolve(olean, ".."), { recursive: true });
		await run(lean, ["-R", join(root, "source"), "-o", olean, join(root, "source", path)], root, env);
		modules.push({ module, sha256: sha256(bytes) });
	}
	const source = await readFile(join(fixtures, library.oracle));
	await saveLakeFile(root, "Oracle.lean", source);
	const executed = await run(lean, ["--run", "Oracle.lean"], root, env);
	const result = JSON.parse(executed.stdout);
	return { result, modules, sourceSha256: sha256(source)
		, resultSha256: sha256(canonicalJson(result))
		, leanCompilerSha256: sha256(await readFile(lean))
		, version: (await run(lean, ["--version"], root, env)).stdout.trim() };
};

/**
 * Execute one source library and preserve only identities and observed results.
 *
 * @param t - Test context owning both author and consumer scratch directories.
 * @param library - Closed corpus library definition.
 */
export const runPythonCorpusLibrary = async (t, library) => {
	const space = await statfs(tmpdir());
	assert.ok(Number(space.bavail) * Number(space.bsize) >= 3 * 1024 ** 3, "Corpus builds need 3 GiB of free scratch space");
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const python = process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3";
	const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PERLS: '["/unavailable/perl"]' };
	const context = await prepare(t, library);
	const before = await lakeInputState(context.workspace);
	t.diagnostic(`${library.id}: compiling Lean oracle`);
	const oracle = await leanOracle(context, library, leanPrefix);
	const relocated = join(context.directory, "relocated");
	await cp(context.workspace, relocated, { recursive: true });
	const builds = [];
	for(const [index, projectRoot] of [context.root, join(relocated, "project")].entries())
	{
		t.diagnostic(`${library.id}: building exact wheel ${index + 1}/2`);
		builds.push(await buildCanonicalProject({ projectRoot, outputRoot: join(context.directory, `release-${index}`), targets: ["pypi"], environment }));
	}
	assert.deepEqual(await lakeInputState(context.workspace), before);
	assert.deepEqual(builds[0].packages, builds[1].packages);
	assert.equal(builds[0].bindingIrSha256, builds[1].bindingIrSha256);
	const model = await json(join(builds[0].output, "native/component/model.json"));
	assert.equal(model.sourceIdentity.leanCompilerSha256, oracle.leanCompilerSha256);
	for(const module of model.sourceIdentity.modules)
		assert.equal(module.source.sha256, oracle.modules.find(input => input.module === module.module)?.sha256, `Oracle/build source mismatch: ${module.module}`);
	assert.match(model.sourceIdentity.lakeDependencies.snapshotSha256, /^[a-f0-9]{64}$/);
	assert.ok(model.sourceIdentity.modules.some(module => module.module === context.names.local));
	assert.ok(model.sourceIdentity.modules.some(module => module.module === context.names.remote));

	// The pending module was typechecked by the oracle, but this target cannot
	// currently package its shape. A newly admitted shape must get real cases.
	const pendingWorkspace = join(context.directory, "pending");
	await cp(context.workspace, pendingWorkspace, { recursive: true });
	await saveLakeFile(join(pendingWorkspace, "project"), "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
		, modules: [library.pendingModule], exports: [library.pendingExport]
		, targets: { pypi: { name: `${library.id}-pending`, version: "1.0.0" } } }));
	let rejection;
	try
	{
		await buildCanonicalProject({ projectRoot: join(pendingWorkspace, "project"), outputRoot: join(context.directory, "pending-release"), targets: ["pypi"], environment });
	}
	catch(error)
	{
		assert.equal(error.code, "native-elaboration-unsupported", "A toolchain or source failure is not a type-admission rejection");
		assert.ok(error.message.includes(`${library.pendingExport}: unsupported-native-type`));
		rejection = { shape: library.pendingShape, stage: "source-elaboration"
			, status: "unsupported", export: library.pendingExport
			, code: error.code, message: error.message };
	}
	assert.ok(rejection, "Pending type was admitted; replace its rejection with installed corpus cases");
	await assert.rejects(lstat(join(context.directory, "pending-release")), { code: "ENOENT" });

	const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-type-consumer-"));
	t.after(() => rm(consumer, { recursive: true, force: true }));
	const handoff = join(consumer, "handoff");
	const receipt = await copyPackageSetHandoff(builds[0].output, handoff);
	const receiptBytes = await readFile(join(handoff, "package-set-receipt.json"));
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const pkg = receipt.packages.find(pkg => pkg.target === "pypi");
	assert.equal(pkg.artifacts.length, 1);
	const archive = pkg.artifacts[0];
	const cases = corpusCases(library);
	await saveLakeFile(consumer, "consumer.py", await readFile(join(fixtures, "consumers/python.py")));
	const operations = Object.fromEntries(library.operations.map((name, index) => [name, library.pythonOperations[index]]));
	await saveLakeFile(consumer, "request.json", canonicalJson({ module: library.pythonModule
		, operations, cases, oracle: oracle.result
		, errors: corpusProfiles.python.errors }));
	// Nothing from the author workspace or unpacked release survives installation.
	await rm(context.directory, { recursive: true, force: true });
	const verified = await run(process.execPath, [join(repository, "scripts/lean-bridge.mjs"), "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"], consumer, { PATH: "/unavailable", LEAN_BRIDGE_PROJECT: "/unavailable" });
	assert.equal(JSON.parse(verified.stdout).result.verificationType, "local-package-set");
	const venv = join(consumer, "venv"), interpreter = join(venv, "bin/python");
	await run(python, ["-I", "-m", "venv", venv], consumer, clean);
	await run(interpreter, ["-I", "-m", "pip", "--isolated", "install", "--no-index", "--no-deps", "--no-cache-dir", join(handoff, archive.path)], consumer, clean);
	const observation = JSON.parse((await run(interpreter, ["-I", "consumer.py", "request.json"], consumer, clean)).stdout);
	validateCorpusObservation(library, cases, oracle.result, observation);
	const { result, ...oracleEvidence } = oracle;
	return { library: library.id, profile: "python", path: "ordinary-source"
		, archiveSha256: archive.sha256
		, archive: { ...archive, name: pkg.name, version: pkg.version }
		, runtimeIdentity: pkg.runtimeIdentity
		, bindingIrSha256: builds[0].bindingIrSha256
		, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
		, lakeSnapshotSha256: model.sourceIdentity.lakeDependencies.snapshotSha256
		, dependency: { name: context.names.remote, revision: context.manifest.packages[1].rev }
		, receiptSha256: sha256(receiptBytes), independentBuilds: 2
		, oracle: result, oracleEvidence
		, isolation: { sourcesRemovedBeforeInstall: true, compilerPathDisabled: true, offlineInstall: true }
		, observation, rejection };
};
