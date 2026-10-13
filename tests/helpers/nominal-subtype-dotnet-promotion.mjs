/**
 * Tie C# nominal support to four original source-free installed C# selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypeDotnetOriginal, nominalSubtypeDotnetGenerator } from "./nominal-subtype-dotnet-generators.mjs";
import { checkNominalSubtypeDotnetReport, nominalSubtypeDotnetRecords } from "./nominal-subtype-dotnet-report.mjs";
import { assertNominalSubtypeDotnetRun, nominalSubtypeDotnetSelections } from "./nominal-subtype-dotnet-provenance.mjs";

export const nominalSubtypeDotnetArchive = "docs/evidence/nominal-subtype-dotnet-20261012";
export const nominalSubtypeDotnetIndexSha256 = "57f0400fec21849c9e29be1a98029a20808bfd3c9532a904370444d9c7b1cb38";
export const nominalSubtypeDotnetProfiles = ["dotnet"];
export const nominalSubtypeDotnetHostSuffix = "; also in tested acyclic records and variants";
export const nominalSubtypeDotnetConversion = "In C#, the tested acyclic records and variants use generated records and sealed cases with exact BigInteger payloads for Nat Subtypes. Pass generated values without proof fields. Negative Nat values, null payloads and malformed cases reject. Each input site keeps its selected checked constructor, including distinct normalizing choices for the same record. Copied results project existing Lean values without selecting or running an input constructor.";
export const nominalSubtypeDotnetLimit = "Nominal acceptance covers the tested Nat Subtype records, variants, aliases and copied constructor-free results with .NET SDK 8.0.424 and shared framework 8.0.30 through offline NuGet installation on Linux x64/glibc 2.36 with an explicit 2.36 package floor. Consumers run after relocation and again after removal of all consumer sources. Other primitive-base nominal fixtures and other hosts need separate acceptance. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain pending. Constructor/source entry counts and memory are unmeasured; these local runs do not establish hosted release-floor acceptance. The repository archive omits package binaries and full toolchains; receipts, installed-file hashes and selected source snapshots are retained. The complete SDK and shared framework remain trusted tools.";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Authenticate the original source closure and the pinned .NET SDK and shared framework.
 *
 * @param read - Reader of repository-relative original archive files.
 */
export const nominalSubtypeDotnetReferences = async (read = readFile) => {
	const bytes = await read(`${nominalSubtypeDotnetArchive}/index.json`);
	assert.equal(sha256(bytes), nominalSubtypeDotnetIndexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-dotnet-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypeDotnetSelections);
	for(const entry of index.files)
	{
		assert.ok(!files.has(entry.path));
		const value = await read(`${nominalSubtypeDotnetArchive}/${entry.path}`);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		files.set(entry.path, value);
	}
	for(const path of index.selectedSources)
		assert.deepEqual(files.get(`sources/${path}`), nominalSubtypeDotnetOriginal(index.producerCommit, path));
	assert.deepEqual(index.generatorClosure, (await nominalSubtypeDotnetGenerator(index.producerCommit)).paths);
	const references = [];
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" }); assert.equal(run.floor, "2.36");
		const prefix = `${run.label}/records/`, records = async path => files.get(prefix + path);
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), nominalSubtypeDotnetRecords(run.route, run.mode, JSON.parse(await records("nuget.json")), JSON.parse(await records("installation.json"))).sort());
		const checked = await checkNominalSubtypeDotnetReport(records, run);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		const reportBytes = await records("report.json"), report = JSON.parse(reportBytes);
		assert.equal(sha256(reportBytes), run.reportSha256);
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished); assert.equal(sha256(tap), run.tapSha256);
		assertNominalSubtypeDotnetRun({ ...run, start, end, tap, runner: files.get("runner.mjs") });
		assert.equal(run.toolchain.command, start.environment.LEAN_BRIDGE_DOTNET);
		assert.equal(run.toolchain.sdk.version, "8.0.424");
		assert.equal(run.framework.facts.version, "8.0.30");
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const selected = index.files.filter(file => file.path.startsWith(run.label + "/") || file.path.startsWith("sources/") || file.path.startsWith("checkers/") || file.path === "runner.mjs");
		references.push({ id: `nominal-subtype-dotnet-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalSubtypeDotnetProfiles]
			, revision: run.producerCommit, command, counts: checked
			, scope: `Two independent author roots reproduce the complete NuGet package. Author sources are removed before offline installation; unchanged callers replay after moving each installed consumer tree and again after deleting all consumer sources, for three executions per selection. ${run.mode === "full" ? "The full fixture checks per-use constructor selection and normalization, repeated record fields, active variant branches, aliases, mixed Fin guards, exact rejection paths, caller-input preservation and recovery." : "The standalone result-only fixture projects scalars, structural containers, records, variants and aliases without input constructor choices, including 100-bit Nat results."} ${nominalSubtypeDotnetLimit}`
			, files: [{ path: `${nominalSubtypeDotnetArchive}/index.json`, sha256: nominalSubtypeDotnetIndexSha256 }, ...selected.map(file => ({ path: `${nominalSubtypeDotnetArchive}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: [...report.receipt.packages[0].artifacts.map(({ path, sha256 }) => ({ path, sha256 }))] });
	}
	return references;
};

/**
 * Add C# field observations and supplement its two existing parameter/result rows.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalSubtypeDotnet = async (original, references) => {
	assert.deepEqual(references, await nominalSubtypeDotnetReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of ["tests/helpers/nominal-subtype-dotnet-report.mjs", "tests/helpers/nominal-subtype-dotnet-promotion.mjs", "tests/helpers/nominal-subtype-dotnet-promotion-tests.mjs", "docs/evidence/nominal-subtype-dotnet-20261012.md"])
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
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.includes("dotnet"));
		assert.equal(matches.length, 1, "Missing or overlapping C# Subtype observation");
		const observation = matches[0];
		assert.deepEqual(observation.profiles, nominalSubtypeDotnetProfiles);
		assert.deepEqual(observation.shapes, ["subtype"]); assert.deepEqual(observation.positions, ["parameter", "result"]);
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2);
		const scope = matched.map(item => item.scope).join(" ");
		observation.scope += " Additional nominal C# acceptance: " + scope;
		observation.conversionNotes.subtype += " " + nominalSubtypeDotnetConversion;
		observation.limitations.push(nominalSubtypeDotnetLimit);
		for(const position of observation.positions) observation.hostTypes.subtype[position] += nominalSubtypeDotnetHostSuffix;
		for(const stage of Object.values(observation.stages))
		{
			assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
			stage.note += " Additional nominal C# acceptance: " + scope;
		}
		inventory.observations.push({ id: `nominal-subtype-dotnet-fields-${path}`
			, profiles: [...nominalSubtypeDotnetProfiles], shapes: ["subtype"]
			, positions: ["field"], path, scope
			, hostTypes: { subtype: { field: "BigInteger payload in generated records and sealed cases for the tested acyclic records and variants; no proof field" } }
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: ids, note: scope }]))
			, limitations: [nominalSubtypeDotnetLimit]
			, conversionNotes: { subtype: observation.conversionNotes.subtype } });
	}
	return inventory;
};
