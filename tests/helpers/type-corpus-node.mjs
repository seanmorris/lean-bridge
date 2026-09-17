/**
 * Install reproducible npm archives and compare JS and strict TS with fresh Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, statfs, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { prepareLakeEntryIntent, writeLakeEntryInputs } from "../../src/build/lake-entry-intent.mjs";
import { writeEngineExecutionRequest } from "../../src/build/engine-execution-request.mjs";
import { executeComponentEngineRequest } from "../../src/build/component-engine.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { corpusCases, corpusHostCase, corpusSignatures } from "../fixtures/type-corpus/cases.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { leanCorpusOracle, prepareCorpusSources } from "./type-corpus-source.mjs";
import { corpusCaseSupported, corpusProfiles, corpusProfileSignatures, validateCorpusDeclarations, validateCorpusObservation } from "./type-corpus.mjs";

const repository = resolve(import.meta.dirname, "../..");
const json = async path => JSON.parse(await readFile(path, "utf8"));
const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });
const clean = { PATH: "/unavailable", CC: "/unavailable/compiler"
	, CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN: "/unavailable/lean"
	, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: "" };
const capture = async (projectRoot, directory) => {
	const entryIntent = await prepareLakeEntryIntent({ projectRoot });
	const inputRoot = join(directory, "inputs"), requestPath = join(directory, "request.json");
	await writeLakeEntryInputs({ intent: entryIntent, outputRoot: inputRoot });
	await writeEngineExecutionRequest({ output: requestPath, engineRoot: repository, inputRoot, entryIntent, targets: ["npm"], cachePolicy: "off" });
	return { inputRoot, requestPath, entryIntent };
};
const build = async (input, outputRoot, environment) => {
	if(process.env.LEAN_BRIDGE_LAKE_ENGINE)
		await run(resolve(process.env.LEAN_BRIDGE_LAKE_ENGINE), ["--request", input.requestPath, "--component", input.inputRoot, "--output", outputRoot, "--backend", "offline-acceptance"], repository, environment);
	else await executeComponentEngineRequest({ ...input, outputRoot, engineRoot: repository, environment, backend: "offline-acceptance" });
};
const tsType = type => ({ unit: "void", bool: "boolean", string: "string"
	, bytes: "Uint8Array"
	, nat: "bigint", int: "bigint", uint64: "bigint"
	, int64: "bigint" })[type] ?? "number";
const tsArgument = (wire, type) => {
	if(Object.hasOwn(wire, "integer")) return `${wire.integer}${tsType(type) === "bigint" ? "n" : ""}`;
	if(Object.hasOwn(wire, "unit")) return "undefined";
	if(Object.hasOwn(wire, "bool")) return String(wire.bool);
	if(Object.hasOwn(wire, "string")) return JSON.stringify(wire.string);
	if(Object.hasOwn(wire, "bytes")) return `new Uint8Array(${JSON.stringify(wire.bytes)})`;
	for(const kind of ["float32", "float64"]) if(Object.hasOwn(wire, kind)) return `floatFromBits(${JSON.stringify(kind)}, ${JSON.stringify(wire[kind])})`;
	assert.fail("Unsupported corpus input reached TypeScript");
};

/**
 * Generate statically checked public calls from independent corpus signatures.
 *
 * @param library - Catalog library, never generated declaration metadata.
 */
export const corpusTypeScript = library => {
	const signatures = corpusProfileSignatures(library, "node-typescript");
	const lines = [`import * as api from ${JSON.stringify(library.npmModule)};`
		, 'import { floatFromBits, loadRequest, runCorpus } from "./consumer.mjs";'
		, "type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;"
		, "type Expect<T extends true> = T;"];
	for(const [index, signature] of signatures.entries())
	{
		const name = signature.name.slice(library.module.length + 1);
		const expected = `(${signature.parameters.map((type, index) => `arg${index}: ${tsType(type)}`).join(", ")}) => ${tsType(signature.result)}`;
		lines.push(`export type Signature${index} = Expect<Equal<typeof api.${name}, ${expected}>>;`);
	}
	lines.push("const calls: Record<string, () => unknown> = {");
	for(const entry of corpusCases(library).map(entry => corpusHostCase(entry, "node-typescript")))
	{
		if(!corpusCaseSupported(library, entry, "node-typescript")) continue;
		const signature = signatures.find(signature => signature.name === `${library.module}.${entry.operation}`);
		if(entry.expectation.kind === "host-rejection" && entry.expectation.category === "type")
			lines.push("// @ts-expect-error This invalid host input must also fail the public declaration.");
		lines.push(`${JSON.stringify(entry.id)}: () => api.${entry.operation}(${entry.arguments.map((wire, index) => tsArgument(wire, signature.parameters[index])).join(", ")}),`);
	}
	lines.push("};", "await runCorpus(await loadRequest(), api, (id: string) => calls[id]());", "");
	return lines.join("\n");
};

const installed = async (library, profile, consumer, handoff, receipt, oracle) => {
	const root = join(consumer, profile), bin = join(root, "bin");
	await mkdir(bin, { recursive: true });
	await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(root, "package.json", canonicalJson({ private: true, type: "module" }));
	await saveLakeFile(root, "consumer.mjs", await readFile(join(repository, "tests/fixtures/type-corpus/consumers/node.mjs")));
	const npm = await realpath(join(process.execPath, "../../bin/npm"));
	await saveLakeFile(root, "user.npmrc", "");
	await saveLakeFile(root, "global.npmrc", "");
	await run(process.execPath, [npm, "install", "--offline", "--ignore-scripts"
		, "--no-audit", "--no-fund", "--userconfig", join(root, "user.npmrc")
		, "--globalconfig", join(root, "global.npmrc")
		, "--cache", join(root, "empty-cache")
		, join(handoff, receipt.runtime.archive)
		, join(handoff, receipt.package.archive)], root, { ...clean, PATH: bin });
	const signatures = corpusProfileSignatures(library, profile);
	const cases = corpusCases(library);
	await saveLakeFile(root, "request.json", canonicalJson({ profile
		, module: library.npmModule, leanModule: library.module
		, installRoot: root, oracle, errors: corpusProfiles[profile].errors
		, cases: cases.map(entry => corpusHostCase(entry, profile))
		, signatures: Object.fromEntries(signatures.map(signature => [signature.name.slice(library.module.length + 1), signature])) }));
	let typescript;
	let program = "consumer.mjs";
	if(profile === "node-typescript")
	{
		const source = corpusTypeScript(library);
		await saveLakeFile(root, "index.ts", source);
		await saveLakeFile(root, "tsconfig.json", canonicalJson({ compilerOptions: {
			target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext"
			, lib: ["ES2022", "DOM", "ESNext.Disposable"]
			, strict: true, skipLibCheck: false, noEmitOnError: true
			, allowJs: true, checkJs: false, types: [], outDir: "dist"
		}
		, include: ["index.ts", "consumer.mjs"] }));
		const compiler = join(repository, "node_modules/typescript/lib/tsc.js");
		await run(process.execPath, [compiler, "--project", "tsconfig.json"], root, clean);
		const declarations = await readFile(join(root, "node_modules", library.npmModule, "index.d.ts"));
		assert.doesNotMatch(declarations.toString(), /\bany\b/);
		typescript = { strict: true, skipLibCheck: false
			, version: (await run(process.execPath, [compiler, "--version"], root, clean)).stdout.trim()
			, compilerSha256: sha256(await readFile(join(repository, "node_modules/typescript/lib/_tsc.js")))
			, sourceSha256: sha256(source), declarationsSha256: sha256(declarations) };
		program = "dist/index.js";
	}
	const observation = JSON.parse((await run(process.execPath, [program, "request.json"], root, clean)).stdout);
	assert.equal(observation.profile, profile);
	validateCorpusObservation(library, cases, oracle, observation);
	return { observation, ...(typescript ? { typescript } : {}) };
};

/**
 * Build twice from relocated sources, then remove every author/build tree.
 *
 * @param t - Test context owning all disposable directories.
 * @param library - Independent catalog library.
 * @param profiles - Node JS and/or TS profiles sharing the same prepared release.
 */
export const runNodeCorpusLibrary = async (t, library, profiles) => {
	assert.ok(profiles.length > 0 && profiles.every(profile => corpusProfiles[profile]?.transport === "wasm"));
	const space = await statfs(tmpdir());
	assert.ok(Number(space.bavail) * Number(space.bsize) >= 3 * 1024 ** 3, "Corpus builds need 3 GiB of free scratch space");
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const environment = { ...process.env, LEAN_BRIDGE_LEAN: join(leanPrefix, "bin/lean") };
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const signatures = corpusProfileSignatures(library, profiles[0]);
	const targets = { npm: { name: library.npmModule, version: "1.0.0" } };
	const context = await prepareCorpusSources(t, library, signatures.map(signature => signature.name), targets);
	const before = await lakeInputState(context.workspace);
	t.diagnostic(`${library.id}: compiling independent Lean oracle for npm`);
	const oracle = await leanCorpusOracle(context, library, leanPrefix);
	const relocated = join(context.directory, "relocated");
	await cp(context.workspace, relocated, { recursive: true });
	const releases = [];
	for(const [index, projectRoot] of [context.root, join(relocated, "project")].entries())
	{
		t.diagnostic(`${library.id}: compiling WASM and npm archives ${index + 1}/2`);
		const input = await capture(projectRoot, join(context.directory, `capture-${index}`));
		const output = join(context.directory, `engine-${index}`);
		await build(input, output, environment);
		const bundleRoot = join(output, "bundle");
		const elaborationBytes = await readFile(join(bundleRoot, "metadata/lake-entry-exports.json"));
		const elaboration = JSON.parse(elaborationBytes);
		const exports = elaboration.metadata.modules.flatMap(module => module.declarations).filter(entry => entry.selected)
			.map(entry => ({ name: entry.identity, ...entry.projection }));
		const declarationEvidence = { modelSha256: sha256(elaborationBytes), signatures: validateCorpusDeclarations(library, { exports }, profiles[0]) };
		const manifest = await json(join(bundleRoot, "locks/lean-target-c-manifest.json"));
		assert.ok(oracle.version.includes(manifest.compiler.commit));
		assert.ok(oracle.version.includes(`version ${manifest.compiler.version},`));
		if(!process.env.LEAN_BRIDGE_LAKE_ENGINE) assert.equal(elaboration.leanCompilerSha256, oracle.leanCompilerSha256);
		for(const module of elaboration.metadata.modules)
			assert.equal(module.sourceSha256, oracle.modules.find(input => input.module === module.name)?.sha256);
		assert.ok(elaboration.metadata.modules.some(module => module.name === context.names.local));
		assert.ok(elaboration.metadata.modules.some(module => module.name === context.names.remote));
		const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(context.directory, `npm-${index}`) });
		await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
		const runtime = await json(join(release.output, "runtime/package/package.json"));
		releases.push({ ...release, declarationEvidence
			, runtimeIdentity: runtime.leanBridge.runtimeIdentity
			, compilerSha256: elaboration.leanCompilerSha256
			, lakeSnapshotSha256: input.entryIntent.lakeSnapshot.sha256 });
	}
	assert.deepEqual(await lakeInputState(context.workspace), before);
	assert.deepEqual(releases[0].report, releases[1].report);
	assert.deepEqual(releases[0].declarationEvidence, releases[1].declarationEvidence);
	for(const archive of ["componentArchive", "runtimeArchive"])
		assert.deepEqual(await readFile(releases[0][archive]), await readFile(releases[1][archive]));

	// Unsupported selections include one admitted export so the exact hint set,
	// rather than an empty-API failure, identifies every unimplemented projection.
	const unsupported = corpusSignatures(library).filter(signature => !signatures.some(item => item.name === signature.name)).map(signature => signature.name);
	const rejectedExports = [...unsupported, library.pendingExport];
	const pending = join(context.directory, "pending");
	await cp(context.workspace, pending, { recursive: true });
	await saveLakeFile(join(pending, "project"), "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
		, modules: [library.module, library.pendingModule]
		, exports: [signatures[0].name, ...rejectedExports], targets }));
	const rejectedInput = await capture(join(pending, "project"), join(context.directory, "rejected-input"));
	const rejectedOutput = join(context.directory, "rejected-output");
	let rejection;
	try
	{ await executeComponentEngineRequest({ ...rejectedInput, outputRoot: rejectedOutput, engineRoot: repository, environment }); }
	catch(error)
	{
		assert.equal(error.code, "component-adapter-hints-required", "Toolchain failures are not unsupported-type evidence");
		const hints = error.details.hints.sort();
		assert.deepEqual(hints, rejectedExports.map(name => `hint:${name}:unsupported-${name === library.pendingExport ? "result" : "parameter"}-type`).sort());
		rejection = { code: error.code, exports: rejectedExports, hints };
	}
	assert.ok(rejection, "A projection was admitted; replace the gap with installed cases");
	await assert.rejects(lstat(rejectedOutput), { code: "ENOENT" });

	const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-type-node-"));
	t.after(() => rm(consumer, { recursive: true, force: true }));
	const handoff = join(consumer, "handoff");
	await mkdir(handoff);
	const release = releases[0], receipt = release.report;
	for(const file of [receipt.runtime.archive, receipt.package.archive, "component-package-receipt.json", "verify-component-package-receipt.mjs"])
		await cp(join(release.output, file), join(handoff, file));
	const receiptSha256 = sha256(await readFile(join(handoff, "component-package-receipt.json")));
	await rm(context.directory, { recursive: true, force: true });
	await run(process.execPath, [join(repository, "scripts/lean-bridge.mjs"), "verify", "--receipt", join(handoff, "component-package-receipt.json"), "--json"], consumer, clean);
	const { result, ...oracleEvidence } = oracle;
	const runs = [];
	for(const profile of profiles)
	{
		t.diagnostic(`${library.id}: installing and executing ${profile} offline without Lean or C compilers`);
		const observed = await installed(library, profile, consumer, handoff, receipt, result);
		runs.push({ library: library.id, profile, path: "ordinary-source"
			, archiveSha256: receipt.package.sha256
			, archive: { ...receipt.package, target: "npm" }
			, runtimeArchive: { ...receipt.runtime, target: "npm" }
			, runtimeIdentity: release.runtimeIdentity
			, bindingIrSha256: receipt.bindingIrSha256
			, declarationEvidence: release.declarationEvidence
			, compilerSha256: release.compilerSha256
			, sourceTreeSha256: receipt.source.treeSha256
			, lakeSnapshotSha256: release.lakeSnapshotSha256
			, dependency: { name: context.names.remote, revision: context.manifest.packages[1].rev }
			, receiptSha256, independentBuilds: 2, oracle: result, oracleEvidence
			, rejection
			, isolation: { sourcesRemovedBeforeInstall: true, compilerPathDisabled: true, offlineInstall: true }
			, ...observed });
	}
	await verifyComponentPackageReceipt({ receiptPath: join(handoff, "component-package-receipt.json") });
	return runs;
};
