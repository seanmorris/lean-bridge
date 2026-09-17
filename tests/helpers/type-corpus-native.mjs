/**
 * Run Lean oracles and consume exact relocated native packages without sources.
 *
 * @file
 */

import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, rm, statfs, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { corpusCases, corpusHostCase, corpusSignatures } from "../fixtures/type-corpus/cases.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { prepareCorpusSources, leanCorpusOracle } from "./type-corpus-source.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { corpusProfiles, validateCorpusDeclarations, validateCorpusObservation } from "./type-corpus.mjs";

const repository = resolve(import.meta.dirname, "../..");
const fixtures = join(repository, "tests/fixtures/type-corpus");
const json = async path => JSON.parse(await readFile(path, "utf8"));
const clean = { PATH: "/unavailable", CC: "/unavailable/compiler"
	, CXX: "/unavailable/compiler"
	, LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean"
	, LEAN_BRIDGE_NATIVE_ROOT: "/unavailable/runtime" };
const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });

const targetSettings = (library, profiles, suffix = "corpus") => Object.fromEntries(profiles.map(profile => [corpusProfiles[profile].target, profile === "perl" ? { module: library.perlModule, version: "1.000" } : { name: `${library.id}-${suffix}`, version: "1.0.0" }]));

const installedObservation = async ({ profile, library, consumer, handoff, pkg, runtimePackage, perlAbi, cases, oracle, environment }) => {
	const root = join(consumer, profile), archive = pkg.artifacts[0];
	const extension = { python: "py", ruby: "rb", perl: "pl" }[profile];
	const source = `consumer.${extension}`;
	const operations = Object.fromEntries(library.operations.map((name, index) => [name, library.snakeOperations[index]]));
	await saveLakeFile(root, source, await readFile(join(fixtures, `consumers/${profile}.${extension}`)));
	const request = { module: library[`${profile}Module`], operations
		, cases: cases.map(entry => corpusHostCase(entry, profile))
		, oracle, errors: corpusProfiles[profile].errors
		, signatures: Object.fromEntries(corpusSignatures(library).map(signature => [signature.name.slice(library.module.length + 1), signature]))
		, recordFields: library.recordFields
		, ...(profile === "ruby" ? { require: library.rubyRequire, distribution: pkg.name, version: pkg.version } : {}) };
	await saveLakeFile(root, "request.json", canonicalJson(request));
	let executed;
	if(profile === "python")
	{
		const python = environment.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3";
		const venv = join(root, "venv"), interpreter = join(venv, "bin/python");
		await run(python, ["-I", "-m", "venv", venv], root, clean);
		await run(interpreter, ["-I", "-m", "pip", "--isolated", "install", "--no-index", "--no-deps", "--no-cache-dir", join(handoff, archive.path)], root, clean);
		executed = await run(interpreter, ["-I", source, "request.json"], root, clean);
	}
	else if(profile === "ruby")
	{
		const ruby = (await run(environment.LEAN_BRIDGE_RUBY ?? "ruby", ["--disable-gems", "-rrbconfig", "-e", "print RbConfig.ruby"], root, { PATH: environment.PATH })).stdout;
		const gem = environment.LEAN_BRIDGE_GEM ?? join(dirname(ruby), "gem");
		const gemRoot = join(root, "gems"), env = { ...clean, GEM_HOME: gemRoot, GEM_PATH: gemRoot };
		await run(ruby, [gem, "install", "--norc", join(handoff, archive.path), "--local", "--install-dir", gemRoot, "--no-document"], root, env);
		executed = await run(ruby, [source, "request.json"], root, env);
	}
	else
	{
		const perl = environment.LEAN_BRIDGE_CORPUS_PERL;
		const bin = join(root, "bin"), prefix = join(root, "installed");
		await mkdir(bin);
		// MakeMaker needs packaging utilities, but no Lean, Node or C compiler.
		for(const tool of ["make", "tar", "gzip", "sh", "cp", "mv", "rm", "chmod", "mkdir", "touch", "true"])
			await symlink(`/usr/bin/${tool}`, join(bin, tool));
		const perl5lib = join(prefix, "lib/perl5");
		const env = { ...clean, PATH: bin, PERL5LIB: perl5lib };
		for(const selected of [runtimePackage, pkg])
			await installCpanArchive({ archive: join(handoff, selected.artifacts[0].path), workingRoot: root, prefix, perl, mode: "prebuilt-only", environment: env });
		for(const [module, expectedHash] of [[library.perlModule, perlAbi.xsSha256], ["LeanBridge::Runtime", perlAbi.runtimeXsSha256]])
		{
			const file = `${module.replaceAll("::", "/")}.pm`;
			const loaded = await run(perl, [`-M${module}`, "-e", `print $INC{${JSON.stringify(file)}}`], root, { ...clean, PERL5LIB: perl5lib });
			const path = resolve(loaded.stdout);
			assert.ok(path.startsWith(`${perl5lib}/`) && path.endsWith(".pm"));
			const receipt = await json(join(path.slice(0, -3), "install-receipt.json"));
			assert.equal(receipt.operation, "prebuilt-xs");
			assert.deepEqual(receipt.abi, perlAbi.abi);
			assert.equal(receipt.outputSha256, expectedHash);
		}
		executed = await run(perl, [source, "request.json"], root, { ...clean, PERL5LIB: perl5lib });
	}
	const observation = JSON.parse(executed.stdout);
	validateCorpusObservation(library, cases, oracle, observation);
	assert.equal(observation.profile, profile);
	return observation;
};

/**
 * Execute one source library and preserve only identities and observed results.
 *
 * @param t - Test context owning both author and consumer scratch directories.
 * @param library - Closed corpus library definition.
 * @param profiles - Validated consumer profiles sharing this native build.
 */
export const runNativeCorpusLibrary = async (t, library, profiles) => {
	assert.ok(profiles.length > 0 && profiles.every(profile => corpusProfiles[profile]?.transport === "native"));
	assert.equal(new Set(profiles).size, profiles.length);
	const space = await statfs(tmpdir());
	assert.ok(Number(space.bavail) * Number(space.bsize) >= 3 * 1024 ** 3, "Corpus builds need 3 GiB of free scratch space");
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PERLS: '["/unavailable/perl"]' };
	if(profiles.includes("perl"))
	{
		const perl = (await run(environment.LEAN_BRIDGE_CORPUS_PERL ?? "/usr/bin/perl", ["-e", "print $^X"], repository, { PATH: environment.PATH })).stdout;
		assert.ok(perl.startsWith("/"), "Use an absolute Perl interpreter path");
		environment.LEAN_BRIDGE_CORPUS_PERL = perl;
		environment.LEAN_BRIDGE_PERLS = JSON.stringify([perl]);
	}
	const targets = profiles.map(profile => corpusProfiles[profile].target);
	const context = await prepareCorpusSources(t, library, library.operations.map(operation => `${library.module}.${operation}`), targetSettings(library, profiles));
	const before = await lakeInputState(context.workspace);
	t.diagnostic(`${library.id}: compiling Lean oracle`);
	const oracle = await leanCorpusOracle(context, library, leanPrefix);
	const relocated = join(context.directory, "relocated");
	await cp(context.workspace, relocated, { recursive: true });
	const builds = [];
	for(const [index, projectRoot] of [context.root, join(relocated, "project")].entries())
	{
		t.diagnostic(`${library.id}: building ${targets.join("/")} archives ${index + 1}/2`);
		builds.push(await buildCanonicalProject({ projectRoot, outputRoot: join(context.directory, `release-${index}`), targets, environment }));
	}
	assert.deepEqual(await lakeInputState(context.workspace), before);
	assert.deepEqual(builds[0].packages, builds[1].packages);
	assert.equal(builds[0].bindingIrSha256, builds[1].bindingIrSha256);
	const model = await json(join(builds[0].output, "native/component/model.json"));
	const declarationEvidence = { modelSha256: sha256(await readFile(join(builds[0].output, "native/component/model.json")))
		, signatures: validateCorpusDeclarations(library, model) };
	validateCorpusDeclarations(library, await json(join(builds[1].output, "native/component/model.json")));
	let perlAbi;
	if(profiles.includes("perl"))
	{
		const component = await json(join(builds[0].output, "packages/component/lean-bridge-package.json"));
		const runtime = await json(join(builds[0].output, "packages/runtime/lean-bridge-package.json"));
		assert.equal(component.prebuilt.length, 1);
		assert.equal(runtime.prebuilt.length, 1);
		assert.deepEqual(component.prebuilt[0].abi, runtime.prebuilt[0].abi);
		const { abi, abiKey, path } = component.prebuilt[0];
		perlAbi = { abi, abiKey, xsSha256: component.files[path], runtimeXsSha256: runtime.files[runtime.prebuilt[0].path] };
	}
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
		, targets: targetSettings(library, profiles, "pending") }));
	let rejection;
	try
	{
		await buildCanonicalProject({ projectRoot: join(pendingWorkspace, "project"), outputRoot: join(context.directory, "pending-release"), targets, environment });
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
	const cases = corpusCases(library);
	// Nothing from the author workspace or unpacked release survives installation.
	await rm(context.directory, { recursive: true, force: true });
	const verified = await run(process.execPath, [join(repository, "scripts/lean-bridge.mjs"), "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"], consumer, { PATH: "/unavailable", LEAN_BRIDGE_PROJECT: "/unavailable" });
	assert.equal(JSON.parse(verified.stdout).result.verificationType, "local-package-set");
	const { result, ...oracleEvidence } = oracle;
	const runs = [];
	for(const profile of profiles)
	{
		const pkg = receipt.packages.find(pkg => pkg.target === corpusProfiles[profile].target && pkg.role === "component");
		const runtimePackage = receipt.packages.find(pkg => pkg.target === corpusProfiles[profile].target && pkg.role === "runtime");
		assert.equal(pkg.artifacts.length, 1);
		const archive = pkg.artifacts[0];
		t.diagnostic(`${library.id}: installing and executing ${profile} without sources or compilers`);
		const observation = await installedObservation({ profile, library, consumer, handoff, pkg, runtimePackage, perlAbi, cases, oracle: result, environment });
		runs.push({ library: library.id, profile, path: "ordinary-source"
			, archiveSha256: archive.sha256
			, archive: { ...archive, target: pkg.target, name: pkg.name, version: pkg.version }
			, ...(profile === "perl" ? { runtimeArchive: { ...runtimePackage.artifacts[0], target: runtimePackage.target, name: runtimePackage.name, version: runtimePackage.version }, perlAbi } : {})
			, declarationEvidence
			, runtimeIdentity: pkg.runtimeIdentity
			, bindingIrSha256: builds[0].bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, lakeSnapshotSha256: model.sourceIdentity.lakeDependencies.snapshotSha256
			, dependency: { name: context.names.remote, revision: context.manifest.packages[1].rev }
			, receiptSha256: sha256(receiptBytes), independentBuilds: 2
			, oracle: result, oracleEvidence
			, isolation: { sourcesRemovedBeforeInstall: true, compilerPathDisabled: true, offlineInstall: true }
			, observation, rejection });
	}
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	return runs;
};
