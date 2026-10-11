/**
 * Publish only the nominal Node positions established by the original npm runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalSubtypeNpmReport, nominalSubtypeNpmRecordPaths } from "./nominal-subtype-npm-report.mjs";

export const nominalSubtypeNpmArchive = "docs/evidence/nominal-subtype-npm-20261011";
export const nominalSubtypeNpmIndexSha256 = "34f4069f2ba682bcd29e9a4a2da0fd1483449726f06a5f17a7705b3676b181c0";
export const nominalSubtypeNpmProfiles = ["node-javascript", "node-typescript"];
export const nominalSubtypeNpmHostSuffix = "; also in tested acyclic records and variants";
export const nominalSubtypeNpmConversion = "In Node, the tested acyclic records and variants carry Nat Subtype payloads as bigint. Each input site keeps its selected constructor, including distinct normalizing choices for the same record. Copied results project existing Lean values without selecting or running an input constructor. Callers supply no proof fields.";
export const nominalSubtypeNpmLimit = "Nominal acceptance covers the tested Nat Subtype records, variants, aliases and copied constructor-free results on Node 22.23.2/Linux x64 with strict TypeScript. Other primitive bases, browser/React/worker contexts and native/PHP-Wasm nominal consumers need their own acceptance. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain pending. Constructor/source entry counts and memory are unmeasured. Package binaries and full toolchain closures are not retained; receipts, installed-file hashes and selected source snapshots are retained.";
const selections = [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]];
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Authenticate the four original selections before constructing inventory references.
 *
 * @param read - Reader of repository-relative original archive files.
 */
export const nominalSubtypeNpmReferences = async (read = readFile) => {
	const bytes = await read(`${nominalSubtypeNpmArchive}/index.json`);
	assert.equal(sha256(bytes), nominalSubtypeNpmIndexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-npm-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), selections);
	for(const entry of index.files)
	{
		assert.ok(!files.has(entry.path));
		const value = await read(`${nominalSubtypeNpmArchive}/${entry.path}`);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		files.set(entry.path, value);
	}
	for(const source of index.selectedSources)
		assert.deepEqual(files.get(`sources/${source}`), execFileSync("git", ["show", `${index.producerCommit}:${source}`], { maxBuffer: 16 * 1024 * 1024 }));
	const references = [];
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit);
		assert.equal(run.label, `${run.route}/${run.mode}`);
		assert.deepEqual(run.runtime, { node: "v22.23.2", platform: "linux", arch: "x64" });
		const prefix = `${run.label}/records/`, records = async path => files.get(prefix + path);
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), nominalSubtypeNpmRecordPaths(run.mode).sort());
		const counts = await checkNominalSubtypeNpmReport(records, run);
		const reportBytes = await records("report.json"), report = JSON.parse(reportBytes);
		assert.equal(sha256(reportBytes), run.reportSha256);
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.revision, run.producerCommit); assert.equal(start.runnerSha256, sha256(files.get("runner.mjs")));
		assert.equal(start.route, run.route); assert.equal(start.mode, run.mode);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished);
		assert.equal(sha256(tap), run.tapSha256); assert.equal(end.tapSha256, run.tapSha256);
		assert.deepEqual([end.code, end.signal, end.stopReason], [0, null, null]);
		assert.doesNotMatch(tap.toString(), /^(?:not ok|Bail out!)|# (?:SKIP|TODO)/mu);
		assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
		assert.ok(tap.toString().includes(`ok 1 - installed npm nominal Subtypes reproduce and relocate ${run.route} ${run.mode}\n`));
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_ROUTES, run.route);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_MODES, run.mode);
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const selected = index.files.filter(file => file.path.startsWith(run.label + "/") || file.path.startsWith("sources/") || ["checker.mjs", "runner.mjs"].includes(file.path));
		references.push({ id: `nominal-subtype-npm-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalSubtypeNpmProfiles]
			, revision: run.producerCommit, command, counts
			, scope: `Two independent author builds reproduce the package and runtime archives. Author sources are removed before offline installation; unchanged JavaScript and strict TypeScript callers replay after moving the actual installed consumer tree. ${run.mode === "full" ? "The full fixture checks per-use constructor selection and normalization, repeated record fields, variants, aliases, mixed Fin guards, unchanged rejected inputs and recovery." : "The standalone result-only fixture projects scalars, structural containers, records, variants and aliases without input constructor choices, including 100-bit Nat results."} ${nominalSubtypeNpmLimit}`
			, files: [{ path: `${nominalSubtypeNpmArchive}/index.json`, sha256: nominalSubtypeNpmIndexSha256 }, ...selected.map(file => ({ path: `${nominalSubtypeNpmArchive}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: [report.receipt.package, report.receipt.runtime].map(item => ({ path: item.archive, sha256: item.sha256 })) });
	}
	return references;
};

/**
 * Add Node field observations and supplement its existing input/result evidence only.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated original selections.
 */
export const promoteNominalSubtypeNpm = async (original, references) => {
	assert.deepEqual(references, await nominalSubtypeNpmReferences());
	const inventory = structuredClone(original);
	const validators = [];
	for(const path of ["tests/helpers/nominal-subtype-npm-report.mjs", "tests/helpers/nominal-subtype-npm-promotion.mjs", "tests/helpers/nominal-subtype-npm-promotion-tests.mjs", "docs/evidence/nominal-subtype-npm-acceptance-20261011.md"])
		validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({ id: reference.id, kind: "installed"
			, revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path })) });
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.some(profile => nominalSubtypeNpmProfiles.includes(profile)));
		assert.equal(matches.length, 1, "Missing or overlapping Node Subtype observation");
		const observation = matches[0];
		assert.deepEqual(observation.profiles, nominalSubtypeNpmProfiles);
		assert.deepEqual(observation.shapes, ["subtype"]); assert.deepEqual(observation.positions, ["parameter", "result"]);
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2);
		const scope = matched.map(item => item.scope).join(" ");
		observation.scope += " Additional nominal npm acceptance: " + scope;
		observation.conversionNotes.subtype += " " + nominalSubtypeNpmConversion;
		observation.limitations.push(nominalSubtypeNpmLimit);
		for(const position of observation.positions) observation.hostTypes.subtype[position] += nominalSubtypeNpmHostSuffix;
		for(const stage of Object.values(observation.stages))
		{
			assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
			stage.note += " Additional nominal npm acceptance: " + scope;
		}
		inventory.observations.push({ id: `nominal-subtype-npm-fields-${path}`
			, profiles: [...nominalSubtypeNpmProfiles], shapes: ["subtype"]
			, positions: ["field"], path, scope
			, hostTypes: { subtype: { field: "bigint payload in the tested acyclic records and tagged variants; no proof field" } }
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: ids, note: scope }]))
			, limitations: [nominalSubtypeNpmLimit]
			, conversionNotes: { subtype: observation.conversionNotes.subtype } });
	}
	return inventory;
};
