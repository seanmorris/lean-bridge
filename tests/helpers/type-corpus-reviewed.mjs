/**
 * Exercise reviewed-contract analysis and record blocked builds separately.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { prepareLakeDependencySnapshot } from "../../src/build/lake-dependency-snapshot.mjs";
import { corpusCoverage, corpusIdentity, corpusProfiles } from "./type-corpus.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { leanCorpusOracle, prepareCorpusSources } from "./type-corpus-source.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { corpusOracleKeys } from "../fixtures/type-corpus/cases.mjs";

const repository = resolve(import.meta.dirname, "../..");
const execute = promisify(execFile);
const filename = "reviewed.binding-ir.json";
const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
const closed = (value, keys) => assert.deepEqual(Object.keys(value).sort(), keys.toSorted());

/**
 * Keep review decisions in their own document, without shared source selectors.
 *
 * @param t - Test context owning temporary sources.
 * @param library - Independent corpus library.
 */
export const prepareReviewedCorpus = async (t, library) => {
	const context = await prepareCorpusSources(t, library, [], {});
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1 }));
	const document = corpusReviewedIr(library);
	validateBindingIr(document);
	await saveLakeFile(context.root, filename, canonicalJson(document));
	return { ...context, document };
};

/**
 * Invoke the actual CLI with Node available but no compiler or build backend.
 *
 * @param project - Temporary source project.
 * @param args - Public command arguments, excluding the project and JSON flags.
 */
export const reviewedCorpusCli = async (project, args) => {
	const argv = [join(repository, "scripts/lean-bridge.mjs"), ...args, "--project", project, "--json"];
	let output, exitCode = 0;
	try
	{
		output = await execute(process.execPath, argv, { cwd: project
			, timeout: 30_000, maxBuffer: 2 * 1024 * 1024
			, env: { PATH: "/unavailable", LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean", LEAN_BRIDGE_BUILD_BACKEND: "nix" } });
	}
	catch(error)
	{
		assert.equal(typeof error.code, "number");
		assert.equal(error.killed, false);
		assert.equal(error.signal, null);
		exitCode = error.code; output = error;
	}
	assert.equal(output.stderr, "");
	return { exitCode, response: JSON.parse(output.stdout) };
};

/**
 * Bind the ordinary catalog and this admission harness to their exact inputs.
 *
 * @param catalog - Independent corpus definitions.
 */
export const reviewedCorpusIdentity = async catalog => {
	const corpus = await corpusIdentity(repository, catalog), files = [];
	const paths = ["tests/type-corpus-reviewed.test.mjs"
		, "tests/helpers/type-corpus-reviewed.mjs"
		, "tests/helpers/type-corpus-reviewed-ir.mjs"
		, "src/build/build-error.mjs", "src/build/canonical-build.mjs"
		, "src/build/native-project.mjs", "src/build/elaborated-component.mjs"
		, "src/build/lake-entry-intent.mjs", "src/analyze/project-analysis.mjs"
		, "src/analyze/compiler-analysis.mjs", "src/binding-ir/canonical.mjs"
		, "src/binding-ir/contract.mjs", "src/cli/commands.mjs"
		, "scripts/lean-bridge.mjs"];
	for(const path of paths)
	{
		const bytes = await readFile(join(repository, path));
		files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
	}
	return { sha256: sha256(canonicalJson({ corpus, files })), corpus, files };
};

/**
 * Validate real analysis without treating the supplied contract as compiler facts.
 *
 * @param library - Catalog library.
 * @param analysis - CLI analysis result.
 */
export const validateReviewedAnalysis = (library, analysis) => {
	const document = corpusReviewedIr(library);
	assert.deepEqual(analysis.bindingIr, { origin: "existing-validated"
		, path: filename
		, semanticSha256: hashBindingIr(document), document });
	assert.equal(analysis.compiledEnvironment.status, "absent");
	assert.deepEqual(analysis.compiledEnvironment.modules, []);
	assert.equal(analysis.elaboration, null);
	assert.deepEqual(analysis.declarations, []);
	assert.deepEqual(analysis.proposedExports, document.declarations.map(item => item.id));
	assert.equal(analysis.exportCandidates.length, document.declarations.length);
	assert.ok(analysis.exportCandidates.every(item => item.confidence === "reviewed-ir"
		&& item.kind === "reviewed-ir" && item.theoremCandidates.length === 0));
	assert.equal(analysis.readOnly, true);
	assert.deepEqual(analysis.adapterHints, []);
	hash(analysis.sourceTreeSha256);
	assert.equal(analysis.sourceTreeSha256, sha256(analysis.inputs.map(input => `${input.sha256}  ${input.path}\n`).join("")));
	assert.equal(new Set(analysis.inputs.map(input => input.path)).size, analysis.inputs.length);
	const bytes = canonicalJson(document);
	assert.deepEqual(analysis.inputs.find(input => input.path === filename), { path: filename
		, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
};

/**
 * Record both real CLI analysis and one blocked build per consumer profile.
 * The separate Lean oracle proves the fixture compiles, not that IR was compiled.
 *
 * @param t - Test context owning scratch sources and outputs.
 * @param library - Independent corpus library.
 * @param leanPrefix - Pinned compiler for the independent source oracle only.
 */
export const runReviewedCorpusLibrary = async (t, library, leanPrefix) => {
	const context = await prepareReviewedCorpus(t, library);
	const before = await lakeInputState(context.workspace);
	const oracle = await leanCorpusOracle(context, library, leanPrefix);
	const snapshot = await prepareLakeDependencySnapshot({ projectRoot: context.root, includeProject: true });
	const cli = await reviewedCorpusCli(context.root, ["analyze"]);
	assert.equal(cli.exitCode, 0);
	validateReviewedAnalysis(library, cli.response.result);
	const attempts = [];
	for(const [profile, adapter] of Object.entries(corpusProfiles).sort(([a], [b]) => a.localeCompare(b)))
	{
		const output = join(context.directory, `release-${profile}`);
		const result = await reviewedCorpusCli(context.root, ["build", "--target", adapter.target, "--output", output]);
		await assert.rejects(() => lstat(output), { code: "ENOENT" });
		attempts.push({ library: library.id, profile, target: adapter.target
			, path: "reviewed-ir", exitCode: result.exitCode
			, status: result.response.status, result: result.response.result
			, diagnostics: result.response.diagnostics, outputAbsent: true });
	}
	assert.deepEqual(await lakeInputState(context.workspace), before);
	return { library: library.id, analysis: cli.response.result, oracle
		, snapshot: { sha256: snapshot.sha256, document: snapshot.document }
		, sourceUnchanged: true, attempts };
};

/**
 * Keep rejected source paths as gaps; never accept archives or executed results.
 *
 * @param inventory - Type inventory and contracts.
 * @param catalog - Independent library definitions and cases.
 * @param libraries - Actual CLI admission records plus fresh source oracles.
 */
export const reviewedCorpusCoverage = (inventory, catalog, libraries) => {
	assert.deepEqual(libraries.map(run => run.library).sort(), catalog.libraries.map(library => library.id).sort());
	for(const run of libraries)
	{
		closed(run, ["library", "analysis", "oracle", "snapshot", "sourceUnchanged", "attempts"]);
		const library = catalog.libraries.find(library => library.id === run.library);
		validateReviewedAnalysis(library, run.analysis);
		assert.equal(run.sourceUnchanged, true);
		hash(run.snapshot.sha256);
		assert.equal(run.snapshot.sha256, sha256(canonicalJson(run.snapshot.document)));
		assert.ok(run.snapshot.document.packages.some(pkg => pkg.source.type === "git"));
		assert.ok(run.snapshot.document.packages.some(pkg => pkg.source.type === "path"));
		for(const input of run.analysis.inputs) assert.ok(run.snapshot.document.rootInputs.some(file =>
			file.path === input.path && file.bytes === input.bytes && file.sha256 === input.sha256));
		for(const field of ["sourceSha256", "resultSha256", "leanCompilerSha256"]) hash(run.oracle[field]);
		assert.match(run.oracle.version, /version 4\.32\.2,.*commit f3b06c705e6c85f5314019d5d3baab0fec5b580c/);
		assert.equal(run.oracle.resultSha256, sha256(canonicalJson(run.oracle.result)));
		assert.deepEqual(Object.keys(run.oracle.result).sort(), corpusOracleKeys(catalog.cases.filter(entry => entry.library === library.id)));
		for(const name of [library.module, library.pendingModule])
			assert.equal(run.oracle.modules.find(item => item.module === name).sha256
				, run.analysis.inputs.find(item => item.path === `${name.replaceAll(".", "/")}.lean`).sha256);
		assert.deepEqual(run.attempts.map(attempt => attempt.profile).sort(), Object.keys(corpusProfiles).sort());
		for(const attempt of run.attempts)
		{
			closed(attempt, ["library", "profile", "target", "path", "exitCode", "status", "result", "diagnostics", "outputAbsent"]);
			assert.equal(attempt.library, library.id);
			assert.equal(attempt.target, corpusProfiles[attempt.profile].target);
			assert.equal(attempt.path, "reviewed-ir");
			assert.equal(attempt.exitCode, 2);
			assert.equal(attempt.status, "blocked");
			assert.equal(attempt.result, null);
			assert.equal(attempt.outputAbsent, true);
			assert.equal(attempt.diagnostics.length, 1);
			assert.equal(attempt.diagnostics[0].code, "reviewed-ir-build-unsupported");
			assert.equal(attempt.diagnostics[0].severity, "error");
			assert.match(attempt.diagnostics[0].message, /analysis only/);
			assert.match(attempt.diagnostics[0].hint, /lean-bridge.exports.json/);
		}
	}
	return corpusCoverage(inventory, catalog).map(cell => {
		const applicable = cell.path === "reviewed-ir" && catalog.cases.some(entry => entry.coverage.some(claim =>
			claim.shape === cell.shape && claim.positions.includes(cell.position)));
		return applicable ? { ...cell, reason: "reviewed-ir-build-unsupported" } : cell;
	});
};
