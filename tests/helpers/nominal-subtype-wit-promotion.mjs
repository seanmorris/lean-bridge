/**
 * Tie WIT nominal support to four original installed WIT selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypeWitOriginal, nominalSubtypeWitGenerator } from "./nominal-subtype-wit-generators.mjs";
import { checkNominalSubtypeWitReport } from "./nominal-subtype-wit-report.mjs";
import { assertNominalSubtypeWitRun, nominalSubtypeWitSelections } from "./nominal-subtype-wit-provenance.mjs";

export const nominalSubtypeWitArchive = "docs/evidence/nominal-subtype-wit-20261013";
export const nominalSubtypeWitIndexSha256 = "760dc281a804a238af123a2b1e1a4d5f3acdbacf6598b6518fb2922fcfec2e2e";
export const nominalSubtypeWitProfiles = ["wit-wasi"];
export const nominalSubtypeWitHostSuffix = "; also in tested acyclic records and variants";
export const nominalSubtypeWitConversion = "WIT represents the tested acyclic records and variants with named record fields and active variant cases. Nat Subtype payloads use exact little-endian `list<u32>` limbs, without proof fields. Every input site keeps its selected checked constructor, including distinct normalizing choices for the same record. The host rejects malformed fields, cases and payloads. Rejected refinements leave caller values unchanged; a later valid call succeeds. Copied results project existing Lean values and require no input constructor selection. Calls use the packaged Component Model adapter and its native Lean host.";
export const nominalSubtypeWitLimit = "Nominal acceptance covers the tested Nat Subtype records, variants, aliases, nested copied containers and constructor-free results on Linux x64/glibc 2.36 with an explicit 2.36 package floor, Wasmtime 42.0.1 and wasm-tools 1.245.1. Two independent author builds reproduce each archive. Author/build roots are removed before offline installation, and caller compilation inputs are removed before the identical executable runs and replays after relocation. Generated package sources remain installed. The Component Model adapter requires its native host and is not a standalone WASI command. Other primitive-base nominal fixtures, refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work. Constructor/source entry counts and memory are unmeasured; local runs do not establish hosted 2.38 release-floor acceptance. The archive retains original text members, compiled components and caller binaries, but not complete native archives or native libraries. Compiler and operating system distributions remain trusted. The launcher did not record its own pre-launch digest, Node executable path or full ambient environment; the command reconstructs its captured arguments and recorded tool/selection values.";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Authenticate original sources, package records and both executions per selection.
 *
 * @param read - Reader of repository-relative original archive files.
 */
export const nominalSubtypeWitReferences = async (read = readFile) => {
	const bytes = await read(`${nominalSubtypeWitArchive}/index.json`);
	assert.equal(sha256(bytes), nominalSubtypeWitIndexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-wit-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypeWitSelections);
	for(const entry of index.files)
	{
		assert.ok(/^[A-Za-z0-9_.$/-]+$/u.test(entry.path) && entry.path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(!files.has(entry.path));
		const value = await read(`${nominalSubtypeWitArchive}/${entry.path}`);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		files.set(entry.path, value);
	}
	for(const path of index.selectedSources)
		assert.deepEqual(files.get(`sources/${path}`), nominalSubtypeWitOriginal(index.producerCommit, path));
	assert.deepEqual(index.generatorClosure, (await nominalSubtypeWitGenerator(index.producerCommit)).paths);
	assert.ok(index.generatorClosure.every(path => index.selectedSources.includes(path)));
	const references = [];
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" }); assert.equal(run.floor, "2.36");
		assert.equal(run.wasmtime, "42.0.1"); assert.equal(run.nativeHostRequired, true); assert.equal(run.standaloneWasi, false);
		const prefix = `${run.label}/records/`, records = async path => files.get(prefix + path);
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), run.records);
		const checked = await checkNominalSubtypeWitReport(records, run);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		const reportBytes = await records("report.json"), report = JSON.parse(reportBytes);
		assert.equal(sha256(reportBytes), run.reportSha256);
		const start = JSON.parse(files.get(`${run.label}/start.json`));
		const end = JSON.parse(files.get(`${run.label}/runs.json`)).find(item => item.selection === `${run.route}/${run.mode}`);
		const tap = files.get(`${run.label}/run.tap`);
		assert.equal(end.started, run.started); assert.equal(end.finished, run.finished); assert.equal(sha256(tap), run.tapSha256);
		assertNominalSubtypeWitRun({ ...run, start, end, tap });
		for(const path of index.selectedSources) assert.equal(start.sources[path], sha256(files.get(`sources/${path}`)));
		const environment = { CC: report.tools.selected.cc
			, LEAN_BRIDGE_WASM_TOOLS: report.tools.selected.wasmTools
			, LEAN_BRIDGE_WASMTIME_C_API: report.tools.selected.wasmtimeCapi
			, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: run.floor
			, LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_TEST: "1"
			, LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_ROUTES: run.route
			, LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_MODES: run.mode
			, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1" };
		const command = [...Object.entries(environment).map(([key, value]) => key + "=" + quote(value))
			, "node", ...start.args.map(quote)].join(" ");
		const selected = index.files.filter(file => file.path.startsWith(run.label + "/") || file.path.startsWith("sources/") || file.path.startsWith("checkers/") || file.path.startsWith("failed-") || file.path === "runner.mjs");
		references.push({ id: `nominal-subtype-wit-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalSubtypeWitProfiles]
			, revision: run.producerCommit, command, counts: checked
			, scope: `Two independent author roots reproduce the complete WIT archive. Author and build roots are removed before offline installation. One independently compiled public C caller executes the actual Component Model host before and after moving the installed tree, for two executions per selection. Caller source and compilation tools are removed before execution. Generated package sources remain installed. ${run.mode === "full" ? "The full fixture checks per-use constructor selection and normalization, repeated record fields, active variant branches, aliases, mixed Fin guards, exact rejection paths, caller-input preservation and recovery." : "The standalone result-only fixture projects scalars, structural containers, records, variants and aliases without input constructor choices, including 100-bit Nat results."} ${nominalSubtypeWitLimit}`
			, files: [{ path: `${nominalSubtypeWitArchive}/index.json`, sha256: nominalSubtypeWitIndexSha256 }, ...selected.map(file => ({ path: `${nominalSubtypeWitArchive}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: report.receipt.packages[0].artifacts.map(({ path, sha256 }) => ({ path, sha256 })) });
	}
	for(let index_ = 1; index_ < index.runs.length; index_++)
		assert.ok(Date.parse(index.runs[index_ - 1].finished) <= Date.parse(index.runs[index_].started));
	return references;
};

/**
 * Supplement two existing WIT observations and add two observed field cells.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalSubtypeWit = async (original, references) => {
	assert.deepEqual(references, await nominalSubtypeWitReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of ["tests/helpers/nominal-subtype-wit-report.mjs", "tests/helpers/nominal-subtype-wit-promotion.mjs", "tests/helpers/nominal-subtype-wit-promotion-tests.mjs", "docs/evidence/nominal-subtype-wit-promotion-20261013.md"])
		validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({ id: reference.id, kind: "installed"
			, revision: reference.revision, command: reference.command
			, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path })) });
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.some(profile => nominalSubtypeWitProfiles.includes(profile)));
		const expected = path === "ordinary-source"
			? [["native-subtype-wit-wasi-ordinary-source", ["wit-wasi"]]]
			: [["reviewed-native-subtype-wit-wasi", ["wit-wasi"]]];
		assert.deepEqual(matches.map(item => [item.id, item.profiles]), expected, "Missing or overlapping WIT Subtype observations");
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2);
		const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			assert.deepEqual(observation.shapes, ["subtype"]); assert.deepEqual(observation.positions, ["parameter", "result"]);
			observation.scope += " Additional nominal WIT acceptance: " + scope;
			observation.conversionNotes.subtype += " " + nominalSubtypeWitConversion;
			observation.limitations.push(nominalSubtypeWitLimit);
			for(const position of observation.positions) observation.hostTypes.subtype[position] += nominalSubtypeWitHostSuffix;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note += " Additional nominal WIT acceptance: " + scope;
			}
		}
		inventory.observations.push({ id: `nominal-subtype-wit-fields-${path}`
			, profiles: [...nominalSubtypeWitProfiles], shapes: ["subtype"]
			, positions: ["field"], path, scope
			, hostTypes: { subtype: { field: "list<u32> little-endian Nat limbs in named WIT record fields and active variant payloads for the tested acyclic records and variants; no proof field" } }
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: ids, note: scope }]))
			, limitations: [nominalSubtypeWitLimit]
			, conversionNotes: { subtype: nominalSubtypeWitConversion } });
	}
	return inventory;
};
