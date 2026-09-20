/**
 * Compile the shared Lean corpus twice and hand off only prepared PHP-Wasm packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { readVerifiedPhpWasmCopiedPackageSet } from "../../src/release/php-wasm-copied-package.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { prepareCorpusSources, leanCorpusOracle } from "./type-corpus-source.mjs";
import { validateCorpusDeclarations, validateCorpusObservation } from "./type-corpus.mjs";
import { corpusCases } from "../fixtures/type-corpus/cases.mjs";
import { corpusPhpWasmSettings } from "./type-corpus-php-source.mjs";
import { installedPhpWasmCorpus } from "./type-corpus-php-wasm-install.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

const repository = resolve(import.meta.dirname, "../..");
const json = async path => JSON.parse(await readFile(path, "utf8"));

/**
 * Consume one independent ordinary-source library in Node and Chromium PHP hosts.
 *
 * @param t - Test context owning all temporary workspaces.
 * @param library - Closed independent corpus definition.
 * @param options - Explicit ordinary-source or reviewed-IR path.
 * @param options.path - Source path counted by the installed corpus.
 */
export const runPhpWasmCorpusLibrary = async (t, library, { path = "ordinary-source" } = {}) => {
	assert.ok(["ordinary-source", "reviewed-ir"].includes(path));
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix };
	if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME) environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME = environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
	const targets = { "php-wasm": corpusPhpWasmSettings(library) };
	const context = await prepareCorpusSources(t, library, library.operations.map(name => library.module + "." + name), targets);
	if(path === "reviewed-ir")
	{
		await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [library.module], targets }));
		await saveLakeFile(context.root, "reviewed.binding-ir.json", canonicalJson(corpusReviewedIr(library)));
	}
	const before = await lakeInputState(context.workspace);
	t.diagnostic(`${library.id}: compiling fresh PHP-Wasm corpus oracle`);
	const oracle = await leanCorpusOracle(context, library, leanPrefix);
	const relocated = join(context.directory, "relocated");
	await cp(context.workspace, relocated, { recursive: true });
	const builds = [];
	for(const [index, projectRoot] of [context.root, join(relocated, "project")].entries())
	{
		t.diagnostic(`${library.id}: building PHP-Wasm archives ${index + 1}/2`);
		builds.push(await buildCanonicalProject({ projectRoot, outputRoot: join(context.directory, `release-${index}`), targets: ["php-wasm"], environment }));
	}
	assert.deepEqual(await lakeInputState(context.workspace), before);
	assert.deepEqual(builds[0].packages, builds[1].packages);
	assert.equal(builds[0].bindingIrSha256, builds[1].bindingIrSha256);
	const model = await json(join(builds[0].output, "php-wasm/component/model.json"));
	const reviewed = path === "reviewed-ir" ? { model
		, metadata: await json(join(builds[0].output, "php-wasm/component/metadata.json"))
		, receipt: await json(join(builds[0].output, "php-wasm/component/php-wasm-component.json"))
		, inputs: (await json(join(builds[0].output, "php-wasm/component/source-notices.json"))).packages[0].source.inputs } : undefined;
	const declarationEvidence = { modelSha256: sha256(await readFile(join(builds[0].output, "php-wasm/component/model.json")))
		, signatures: validateCorpusDeclarations(library, model) };
	validateCorpusDeclarations(library, await json(join(builds[1].output, "php-wasm/component/model.json")));
	assert.equal(model.pointerBits, 32); assert.equal(model.sourceIdentity.leanCompilerSha256, oracle.leanCompilerSha256);
	for(const module of model.sourceIdentity.modules)
		assert.equal(module.source.sha256, oracle.modules.find(input => input.module === module.module)?.sha256);
	assert.ok(model.sourceIdentity.modules.some(module => module.module === context.names.local));
	assert.ok(model.sourceIdentity.modules.some(module => module.module === context.names.remote));
	const packageRoot = join(builds[0].output, "packages/php-wasm");
	await readVerifiedPhpWasmCopiedPackageSet(packageRoot);
	const packageSet = await json(join(packageRoot, "php-wasm-package-set.json"));
	const pending = join(context.directory, "pending");
	await cp(context.workspace, pending, { recursive: true });
	const rejectedName = `${library.pendingExport}Variant`, pendingSource = `${library.pendingModule.replaceAll(".", "/")}.lean`;
	await saveLakeFile(join(pending, "project"), pendingSource,
		`${await readFile(join(pending, "project", pendingSource), "utf8")}\ndef ${rejectedName} : Sum UInt32 UInt32 := .inl 0\n`);
	await saveLakeFile(join(pending, "project"), "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
		, modules: [library.pendingModule]
		, ...(path === "ordinary-source" ? { exports: [rejectedName] } : {}), targets }));
	if(path === "reviewed-ir")
	{
		const document = corpusReviewedIr(library), template = document.declarations[0];
		document.types = [];
		document.declarations = [{ ...template, id: `lean:${rejectedName}`
			, name: rejectedName.split(".").at(-1)
			, overloadKey: rejectedName
			, source: { ...template.source, declaration: rejectedName } }];
		await saveLakeFile(join(pending, "project"), "reviewed.binding-ir.json", canonicalJson(document));
	}
	let rejection;
	try
	{
		await buildCanonicalProject({ projectRoot: join(pending, "project"), outputRoot: join(context.directory, "pending-release"), targets: ["php-wasm"], environment });
	}
	catch(error)
	{
		assert.equal(error.code, "native-elaboration-unsupported", "Toolchain failures are not type-admission rejections");
		assert.ok(error.message.includes(`${rejectedName}: unsupported-native-type`));
		rejection = { shape: "variant", stage: "source-elaboration"
			, status: "unsupported"
			, export: rejectedName, code: error.code, message: error.message };
	}
	assert.ok(rejection, "Pending type was admitted; add installed corpus cases");
	await assert.rejects(lstat(join(context.directory, "pending-release")), { code: "ENOENT" });
	const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-type-php-wasm-"));
	t.after(() => rm(consumer, { recursive: true, force: true }));
	const handoff = join(consumer, "handoff");
	const receipt = await copyPackageSetHandoff(builds[0].output, handoff);
	const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
	await rm(context.directory, { recursive: true, force: true });
	const clean = { PATH: "/unavailable", CC: "/unavailable/compiler"
		, CXX: "/unavailable/compiler"
		, LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean"
		, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php"
		, LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler"
		, LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime" };
	const verification = await processBuildRunner.capture({ command: process.execPath, args: [join(repository, "scripts/lean-bridge.mjs"), "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"], cwd: consumer, env: clean });
	assert.equal(JSON.parse(verification.stdout).result.verificationType, "local-package-set");
	t.diagnostic(`${library.id}: installing and executing PHP-Wasm without author sources or compilers`);
	const observed = await installedPhpWasmCorpus({ t, library, consumer, handoff, receipt, packageSet, environment, clean, sourcePath: path });
	validateCorpusObservation(library, corpusCases(library), oracle.result, observed.observation);
	const archiveFor = role => {
		const pkg = receipt.packages.find(item => item.role === role);
		assert.equal(pkg.artifacts.length, 1);
		return { ...pkg.artifacts[0], target: pkg.target, name: pkg.name, version: pkg.version };
	};
	const archive = archiveFor("component"), runtimeArchive = archiveFor("runtime"), composerArchive = archiveFor("api");
	const { result, ...oracleEvidence } = oracle;
	const run = { library: library.id, profile: "php-wasm", path
		, ...(reviewed ? { reviewed } : {})
		, archive, runtimeArchive, composerArchive, archiveSha256: archive.sha256
		, runtimeIdentity: model.runtimeIdentity ?? builds[0].runtimeIdentity
		, bindingIrSha256: builds[0].bindingIrSha256, declarationEvidence
		, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
		, lakeSnapshotSha256: model.sourceIdentity.lakeDependencies.snapshotSha256
		, dependency: { name: context.names.remote, revision: context.manifest.packages[1].rev }
		, receiptSha256, independentBuilds: 2, oracle: result, oracleEvidence
		, isolation: { sourcesRemovedBeforeInstall: true, compilerPathDisabled: true, offlineInstall: true }
		, rejection, ...observed };
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await rm(consumer, { recursive: true, force: true });
	return [run];
};
