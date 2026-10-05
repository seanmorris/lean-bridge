/**
 * Reviewed-IR admission is separate from compiled, installed corpus coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { buildNativeProject } from "../src/build/native-project.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { buildPhpWasmProject } from "../src/build/php-wasm-project.mjs";
import { analyzeCompilerProject } from "../src/analyze/compiler-analysis.mjs";
import { readTypeSurface } from "../src/adoption/type-surface.mjs";
import { createCliHandlers } from "../src/cli/commands.mjs";
import { runCli } from "../src/cli/run.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { corpusLibraries } from "./fixtures/type-corpus/cases.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { prepareCorpusSources } from "./helpers/type-corpus-source.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { corpusCatalog, corpusProfiles } from "./helpers/type-corpus.mjs";
import { prepareReviewedCorpus, reviewedCorpusCoverage, reviewedCorpusIdentity, runReviewedCorpusLibrary, validateReviewedAnalysis } from "./helpers/type-corpus-reviewed.mjs";

const repository = resolve(import.meta.dirname, "..");
const clean = { PATH: "/unavailable", LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean" };
const noTools = { capture: () => assert.fail("Reviewed inputs reached a build tool") };
const unsupported = { code: "reviewed-ir-build-unsupported" };

test("native builds must not ignore a supplied reviewed contract", async t => {
	const library = corpusLibraries[0], document = corpusReviewedIr(library);
	validateBindingIr(document);
	const context = await prepareCorpusSources(t, library, [], {});
	await saveLakeFile(context.root, "reviewed.binding-ir.json", canonicalJson(document));
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1 }));
	await assert.rejects(() => buildNativeProject({ projectRoot: context.root
		, outputRoot: join(context.directory, "release"), targets: ["cpan"]
		, environment: { PATH: "/unavailable", LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean" } })
		, { code: "reviewed-ir-build-unsupported" });
});

for(const library of corpusLibraries)
{
	test(`${library.id}: reviewed analysis preserves all 19 declarations without compiler claims`, async t => {
		const context = await prepareReviewedCorpus(t, library);
		await saveLakeFile(context.root, `.lake/build/lib/lean/${library.module.replaceAll(".", "/")}.ilean`, '{"decls":{"Forged.theorem":[]}}');
		const before = await lakeInputState(context.workspace);
		const analysis = await analyzeCompilerProject(context.root, { runner: noTools });
		validateReviewedAnalysis(library, analysis);
		for(const change of [
			value => { value.bindingIr.origin = "lean-elaborated"; }
			, value => { value.bindingIr.document.declarations.pop(); }
			, value => { value.compiledEnvironment.status = "present"; }
			, value => { value.elaboration = {}; }
			, value => { value.exportCandidates[0].theoremCandidates.push("Forged.theorem"); }
			, value => { value.readOnly = false; }
			, value => { value.sourceTreeSha256 = "a".repeat(64); }
		]) {
			const changed = structuredClone(analysis); change(changed);
			assert.throws(() => validateReviewedAnalysis(library, changed));
		}
		assert.deepEqual(await lakeInputState(context.workspace), before);
	});

	test(`${library.id}: every consumer target and combined build reject reviewed inputs before tools`, async t => {
		const context = await prepareReviewedCorpus(t, library), before = await lakeInputState(context.workspace);
		const handlers = createCliHandlers({ build: options => buildCanonicalProject({ ...options, environment: clean, runner: noTools }) });
		const selections = [...Object.entries(corpusProfiles).map(([profile, adapter]) => [profile, [adapter.target]])
			, ["default", []], ["alias", ["perl"]]
			, ["combined", [...new Set(Object.values(corpusProfiles).map(adapter => adapter.target))]]];
		for(const [profile, targets] of selections)
		{
			const output = join(context.directory, profile);
			const result = await runCli({ argv: ["build", "--project", context.root
				, "--output", output
				, ...targets.flatMap(target => ["--target", target]), "--json"]
				, handlers });
			assert.equal(result.exitCode, 2, profile);
			assert.equal(result.response.status, "blocked", profile);
			assert.equal(result.response.result, null);
			assert.equal(result.response.diagnostics[0].code, unsupported.code);
			await assert.rejects(() => lstat(output), { code: "ENOENT" });
		}
		assert.deepEqual(await lakeInputState(context.workspace), before);
	});

	test(`${library.id}: lower-level native and PHP builds cannot bypass admission`, async t => {
		const context = await prepareReviewedCorpus(t, library), before = await lakeInputState(context.workspace);
		const options = { projectRoot: context.root
			, outputRoot: join(context.directory, "release")
			, environment: clean, leanPrefix: "/unavailable/lean", runner: noTools };
		for(const targets of [["cpan"], ["c"], ["c", "cpan", "php-native"]])
			await assert.rejects(() => buildNativeProject({ ...options, targets }), unsupported);
		await assert.rejects(() => buildPhpWasmProject(options), unsupported);
		await assert.rejects(() => buildElaboratedComponent({ ...options, targets: ["c"]
			, profile: "native-library-v1", receiptName: "native-component.json"
			, createModel: () => assert.fail("Reviewed input reached model creation")
			, compileComponent: () => assert.fail("Reviewed input reached compilation") }), unsupported);
		await assert.rejects(() => lstat(options.outputRoot), { code: "ENOENT" });
		assert.deepEqual(await lakeInputState(context.workspace), before);
	});
}

for(const [field, value] of Object.entries({ exports: ["Shop.Pricing.quoteUnits"], resources: [], arities: {}, specializations: [], contracts: { "Shop.Pricing.quoteUnits": { effects: [] } } }))
	test(`reviewed analysis does not silently ignore shared ${field}`, async t => {
		const context = await prepareReviewedCorpus(t, corpusLibraries[0]);
		await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, [field]: value }));
		await assert.rejects(() => analyzeCompilerProject(context.root, { runner: noTools }), { code: "export-configuration-reviewed-ir" });
	});

test("malformed or multiple review files cannot fall back to source compilation", async t => {
	const context = await prepareReviewedCorpus(t, corpusLibraries[0]);
	await saveLakeFile(context.root, "nested/second.binding-ir.json", canonicalJson(context.document));
	const analysis = await analyzeCompilerProject(context.root, { runner: noTools });
	assert.equal(analysis.bindingIr, null);
	assert.equal(analysis.adapterHints[0].reason, "multiple-binding-ir-documents");
	for(const bytes of [canonicalJson(context.document), "{not JSON", '{"schemaVersion":999}'])
	{
		await saveLakeFile(context.root, "reviewed.binding-ir.json", bytes);
		const before = await lakeInputState(context.workspace);
		await assert.rejects(() => buildCanonicalProject({ projectRoot: context.root
			, outputRoot: join(context.directory, "release"), targets: ["cpan"]
			, environment: clean, runner: noTools })
			, error => { assert.equal(error.code, unsupported.code); assert.deepEqual(error.details.paths, ["nested/second.binding-ir.json", "reviewed.binding-ir.json"]); return true; });
		assert.deepEqual(await lakeInputState(context.workspace), before);
	}
});

test("real reviewed-IR corpus records analysis and rejection without installed coverage", {
	skip: process.env.LEAN_BRIDGE_REVIEWED_CORPUS_TEST !== "1", timeout: 180_000
}, async t => {
	const reportPath = join(repository, "build/type-corpus/reviewed-ir.json");
	await rm(reportPath, { force: true });
	const inventory = await readTypeSurface(), catalog = corpusCatalog(inventory.document);
	const identity = await reviewedCorpusIdentity(catalog);
	const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? (await processBuildRunner.capture({ command: "lean", args: ["--print-prefix"], cwd: repository })).stdout.trim();
	const libraries = [];
	for(const library of catalog.libraries) libraries.push(await runReviewedCorpusLibrary(t, library, leanPrefix));
	const cells = reviewedCorpusCoverage(inventory, catalog, libraries);
	assert.notDeepEqual(libraries[0].oracle.result.dependency, libraries[1].oracle.result.dependency);
	assert.ok(cells.every(cell => cell.status === "gap" && cell.cases.length === 0));
	for(const change of [
		value => { value.pop(); }
		, value => { value[0].attempts.pop(); }
		, value => { value[0].attempts.push(value[0].attempts[0]); }
		, value => { value[0].attempts[0].archiveSha256 = "a".repeat(64); }
		, value => { value[0].attempts[0].result = { success: true }; }
		, value => { value[0].attempts[0].status = "ok"; }
		, value => { value[0].attempts[0].path = "ordinary-source"; }
		, value => { value[0].attempts[0].target = "unknown"; }
		, value => { value[0].attempts[0].exitCode = 1; }
		, value => { value[0].attempts[0].outputAbsent = false; }
		, value => { value[0].attempts[0].diagnostics[0].code = "build-tools-unavailable"; }
		, value => { value[0].snapshot.document.packages.pop(); }
		, value => { value[0].sourceUnchanged = false; }
		, value => { value[0].oracle.result.dependency = "forged"; }
		, value => { value[0].oracle.version = "Lean 4.19.0"; }
	]) {
		const changed = structuredClone(libraries); change(changed);
		assert.throws(() => reviewedCorpusCoverage(inventory, catalog, changed));
	}
	assert.deepEqual(await reviewedCorpusIdentity(catalog), identity, "Corpus inputs changed during execution");
	const report = { schemaVersion: 1, kind: "lean-bridge-reviewed-ir-admission"
		, identity
		, environment: { node: process.version, nodeSha256: sha256(await readFile(process.execPath)), platform: process.platform, arch: process.arch }
		, summary: { libraries: libraries.length
			, profiles: Object.keys(corpusProfiles).length
			, targets: new Set(Object.values(corpusProfiles).map(profile => profile.target)).size
			, analyzedDeclarations: libraries.reduce((count, run) => count + run.analysis.proposedExports.length, 0)
			, rejectedBuilds: libraries.reduce((count, run) => count + run.attempts.length, 0)
			, installedRuns: 0, executedCases: 0, observedCells: 0
			, gapCells: cells.length
			, admissionRejectedCells: cells.filter(cell => cell.reason === unsupported.code).length }
		, libraries, cells };
	await mkdir(resolve(reportPath, ".."), { recursive: true });
	await writeFile(reportPath, canonicalJson(report));
	t.diagnostic(`Reviewed admission report: ${JSON.stringify(report.summary)}`);
});
