/**
 * Tie nominal PHP-Wasm support to complete original installed package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypePhpWasmSelections, assertNominalSubtypePhpWasmRun } from "./nominal-subtype-php-wasm-provenance.mjs";
import { checkNominalSubtypePhpWasmReport } from "./nominal-subtype-php-wasm-report.mjs";
import { nominalSubtypePhpWasmOriginal, nominalSubtypePhpWasmSnapshot, nominalSubtypePhpWasmGeneratorClosure } from "./nominal-subtype-php-wasm-sources.mjs";

export const nominalSubtypePhpWasmArchive = "docs/evidence/nominal-subtype-php-wasm-20261014";
export const nominalSubtypePhpWasmIndexSha256 = "4eb5779d93b8b6b4fb098fa6b5c72f86e0e977f327b597bf5d07a60b873c0988";
export const nominalSubtypePhpWasmProfiles = ["php-wasm"];
export const nominalSubtypePhpWasmHostSuffix = "; also in tested acyclic records and variants";
export const nominalSubtypePhpWasmConversion = "PHP-Wasm uses Brick\\Math\\BigInteger for the tested Nat Subtype payloads in generated final readonly record and variant classes. Each input site keeps its selected checked Lean constructor, including distinct normalizing choices for the same record. Only the active variant case runs its constructors. Weak and strict callers retain unchanged inputs after rejection and can make later valid calls. Copied results project existing Lean payloads without proof fields or input constructor selections, including result-only packages.";
export const nominalSubtypePhpWasmLimit = "Nominal PHP-Wasm acceptance covers the tested Nat records, variants, aliases, nested copied containers and constructor-free results on wasm32 PHP 8.4.1, Node 22.23.2 and Chromium 151.0.7922.34 on Linux x64. Each selection checks twelve contexts: Node embedded and Composer installations and Chromium bundles, each with startup/lazy loading and weak/strict callers, executed twice after installation-tree relocation. Two independent author roots reproduce all three archives and are removed before offline installation. Complete API, component and shared-runtime archives, original caller and compiler records, launcher, runtime identity and test output are retained; external toolchains and browser binaries are not. The local compiler ran through the recorded Nix command transport adapter, not a Nix sandbox. Other primitive-base nominal fixtures, refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work. Entry counts and memory are unmeasured. These local results do not claim hosted acceptance of a later revision. Historical absolute command paths document the original machine and are not CI prerequisites.";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Authenticate complete archives, frozen producer sources and original launch records.
 *
 * @param read - Reader of repository-relative original evidence files.
 */
export const nominalSubtypePhpWasmReferences = async (read = readFile) => {
	const bytes = await read(`${nominalSubtypePhpWasmArchive}/index.json`);
	assert.equal(sha256(bytes), nominalSubtypePhpWasmIndexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-php-wasm-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypePhpWasmSelections);
	for(const entry of index.files)
	{
		assert.ok(/^[A-Za-z0-9_@.$/+-]+$/u.test(entry.path) && !entry.path.startsWith("/") && entry.path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(!files.has(entry.path)); const value = await read(`${nominalSubtypePhpWasmArchive}/${entry.path}`);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256); files.set(entry.path, value);
	}
	const snapshot = nominalSubtypePhpWasmSnapshot(index.producerCommit);
	assert.equal(index.sourceSnapshotCount, Object.keys(snapshot).length);
	assert.deepEqual(index.generatorClosure, nominalSubtypePhpWasmGeneratorClosure(index.producerCommit));
	assert.ok(index.generatorClosure.every(path => index.selectedSources.includes(path)));
	for(const path of index.selectedSources)
	{
		const original = files.get(`sources/${path}`);
		assert.deepEqual(original, nominalSubtypePhpWasmOriginal(index.producerCommit, path));
		assert.equal(snapshot[path], sha256(original));
	}
	const references = []; let previousEnd = 0;
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { node: "v22.23.2", platform: "linux", arch: "x64" });
		const prefix = `${run.label}/records/`, records = async path => files.get(prefix + path);
		const report = JSON.parse(await records("report.json"));
		const checked = await checkNominalSubtypePhpWasmReport(records, run);
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), checked.records);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		assert.equal(sha256(await records("report.json")), run.reportSha256);
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`)), tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished); assert.equal(sha256(tap), run.tapSha256);
		assert.deepEqual(start.sources, snapshot);
		assertNominalSubtypePhpWasmRun({ ...run, start, end, tap
			, runner: files.get("runner.mjs")
			, preflight: JSON.parse(files.get(`${run.label}/preflight.json`))
			, independentRuntime: JSON.parse(files.get(`${run.label}/independent-runtime.json`))
			, report });
		assert.ok(Date.parse(start.started) >= previousEnd); previousEnd = Date.parse(end.finished);
		assert.equal(run.browserVersion, "151.0.7922.34"); assert.equal(report.phpWasm.browserVersion, run.browserVersion);
		const command = [...Object.entries(start.environment).map(([key, value]) => key + "=" + quote(value))
			, quote(start.command), ...start.args.map(quote)].join(" ");
		const selected = index.files.filter(file => file.path.startsWith(run.label + "/") || file.path.startsWith("sources/") || file.path.startsWith("checkers/") || file.path === "runner.mjs");
		references.push({ id: `nominal-subtype-php-wasm-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalSubtypePhpWasmProfiles]
			, revision: run.producerCommit, command
			, counts: { ...checked, runtime: run.runtime, browserVersion: run.browserVersion }
			, scope: `Two independent author builds reproduce the API, component and shared-runtime archives. Offline installation follows author-root removal. All twelve Node/Chromium, installation, loading and strictness contexts pass twice after relocation. Package checks authenticate every archive member, installed file and loaded wasm32 runtime. ${run.mode === "full" ? "The full API checks per-use constructor selection and normalization, repeated record fields, active variant branches, aliases, mixed Fin guards, rejection paths, unchanged caller inputs and recovery." : "The standalone result-only API projects scalars, structural containers, records, variants and aliases without input constructor choices, including 100-bit Nat results."} ${nominalSubtypePhpWasmLimit}`
			, files: [{ path: `${nominalSubtypePhpWasmArchive}/index.json`, sha256: nominalSubtypePhpWasmIndexSha256 }, ...selected.map(file => ({ path: `${nominalSubtypePhpWasmArchive}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: report.receipt.packages.flatMap(pkg => pkg.artifacts.map(({ path, sha256 }) => ({ path, sha256 }))) });
	}
	return references;
};

/**
 * Supplement four existing cells and add two observed field cells only.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalSubtypePhpWasm = async (original, references) => {
	assert.deepEqual(references, await nominalSubtypePhpWasmReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of ["tests/helpers/nominal-subtype-php-wasm-report.mjs", "tests/helpers/nominal-subtype-php-wasm-promotion.mjs", "tests/helpers/nominal-subtype-php-wasm-promotion-tests.mjs", "docs/evidence/nominal-subtype-php-wasm-promotion-20261014.md"])
		validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({ id: reference.id, kind: "installed"
			, revision: reference.revision, command: reference.command
			, scope: reference.scope, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path })) });
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.includes("php-wasm"));
		const expectedId = path === "ordinary-source" ? "php-wasm-subtype-ordinary" : "php-wasm-subtype-reviewed";
		assert.deepEqual(matches.map(item => [item.id, item.profiles]), [[expectedId, nominalSubtypePhpWasmProfiles]], "Missing or overlapping PHP-Wasm Subtype observations");
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2); const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			assert.deepEqual(observation.shapes, ["subtype"]); assert.deepEqual(observation.positions, ["parameter", "result"]);
			observation.scope += " Additional nominal PHP-Wasm acceptance: " + scope;
			observation.conversionNotes.subtype += " " + nominalSubtypePhpWasmConversion;
			observation.limitations.push(nominalSubtypePhpWasmLimit);
			for(const position of observation.positions) observation.hostTypes.subtype[position] += nominalSubtypePhpWasmHostSuffix;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note += " Additional nominal PHP-Wasm acceptance: " + scope;
			}
		}
		inventory.observations.push({ id: `nominal-subtype-php-wasm-fields-${path}`
			, profiles: [...nominalSubtypePhpWasmProfiles], shapes: ["subtype"]
			, positions: ["field"], path, scope
			, hostTypes: { subtype: { field: "Brick\\Math\\BigInteger Nat payload in generated final readonly record and variant classes for the tested acyclic records and variants; no proof field" } }
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: ids, note: scope }]))
			, limitations: [nominalSubtypePhpWasmLimit]
			, conversionNotes: { subtype: nominalSubtypePhpWasmConversion } });
	}
	return inventory;
};
