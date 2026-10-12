/**
 * Tie Perl nominal support to four original source-free installed CPAN selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypePerlOriginal, nominalSubtypePerlGenerator } from "./nominal-subtype-perl-generators.mjs";
import { checkNominalSubtypePerlReport, nominalSubtypePerlRecords } from "./nominal-subtype-perl-report.mjs";
import { assertNominalSubtypePerlRun, nominalSubtypePerlSelections } from "./nominal-subtype-perl-provenance.mjs";

export const nominalSubtypePerlArchive = "docs/evidence/nominal-subtype-perl-20261012";
export const nominalSubtypePerlIndexSha256 = "6d893820aed83eedaff7f56d4b93c7f3a5aaaf31fc26f94b8c1aa8039c4c8b60";
export const nominalSubtypePerlProfiles = ["perl"];
export const nominalSubtypePerlHostSuffix = "; also in tested acyclic records and variants";
export const nominalSubtypePerlConversion = "In Perl, the tested acyclic records and variants carry Nat Subtype payloads as Math::BigInt values in generated blessed wrappers. Each input site keeps its selected checked constructor, including distinct normalizing choices for the same record. Copied results project existing Lean values without selecting or running an input constructor. Callers supply no proof fields.";
export const nominalSubtypePerlLimit = "Nominal acceptance covers the tested Nat Subtype records, variants, aliases and copied constructor-free results on Perl 5.36.3 and 5.38.2, each threaded and unthreaded, via prebuilt-only and build-xs installation on Linux x64/glibc 2.36 with an explicit 2.36 package floor. Other primitive-base nominal fixtures and other hosts need separate acceptance. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain pending. Constructor/source entry counts and memory are unmeasured; these local runs do not establish hosted release-floor acceptance. Package binaries and full toolchain closures are not retained; receipts, installed-file hashes and selected source snapshots are retained.";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Authenticate the original source closure, all four ABIs and both installation modes.
 *
 * @param read - Reader of repository-relative original archive files.
 */
export const nominalSubtypePerlReferences = async (read = readFile) => {
	const bytes = await read(`${nominalSubtypePerlArchive}/index.json`);
	assert.equal(sha256(bytes), nominalSubtypePerlIndexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-perl-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypePerlSelections);
	for(const entry of index.files)
	{
		assert.ok(!files.has(entry.path));
		const value = await read(`${nominalSubtypePerlArchive}/${entry.path}`);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		files.set(entry.path, value);
	}
	for(const path of index.selectedSources)
		assert.deepEqual(files.get(`sources/${path}`), nominalSubtypePerlOriginal(index.producerCommit, path));
	assert.deepEqual(index.generatorClosure, (await nominalSubtypePerlGenerator(index.producerCommit)).paths);
	const references = [];
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" }); assert.equal(run.floor, "2.36");
		const prefix = `${run.label}/records/`, records = async path => files.get(prefix + path);
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), nominalSubtypePerlRecords(run.route).sort());
		const checked = await checkNominalSubtypePerlReport(records, run);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		const reportBytes = await records("report.json"), report = JSON.parse(reportBytes);
		assert.equal(sha256(reportBytes), run.reportSha256);
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished); assert.equal(sha256(tap), run.tapSha256);
		assertNominalSubtypePerlRun({ ...run, start, end, tap, runner: files.get("runner.mjs") });
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const selected = index.files.filter(file => file.path.startsWith(run.label + "/") || file.path.startsWith("sources/") || file.path.startsWith("checkers/") || file.path === "runner.mjs");
		references.push({ id: `nominal-subtype-perl-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalSubtypePerlProfiles]
			, revision: run.producerCommit, command, counts: checked
			, scope: `Two independent author roots reproduce the complete four-ABI archives. Author sources are removed before offline installation; unchanged callers replay after moving each installed consumer tree, for sixteen executions per selection. ${run.mode === "full" ? "The full fixture checks per-use constructor selection and normalization, repeated record fields, active variant branches, aliases, mixed Fin guards, exact rejection paths, caller-input preservation and recovery." : "The standalone result-only fixture projects scalars, structural containers, records, variants and aliases without input constructor choices, including 100-bit Nat results."} ${nominalSubtypePerlLimit}`
			, files: [{ path: `${nominalSubtypePerlArchive}/index.json`, sha256: nominalSubtypePerlIndexSha256 }, ...selected.map(file => ({ path: `${nominalSubtypePerlArchive}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: Object.entries(report.builds[0].archives).map(([path, digest]) => ({ path, sha256: digest })) });
	}
	return references;
};

/**
 * Add Perl field observations and supplement its two existing parameter/result rows.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalSubtypePerl = async (original, references) => {
	assert.deepEqual(references, await nominalSubtypePerlReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of ["tests/helpers/nominal-subtype-perl-report.mjs", "tests/helpers/nominal-subtype-perl-promotion.mjs", "tests/helpers/nominal-subtype-perl-promotion-tests.mjs", "docs/evidence/nominal-subtype-perl-acceptance-20261012.md"])
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
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.includes("perl"));
		assert.equal(matches.length, 1, "Missing or overlapping Perl Subtype observation");
		const observation = matches[0];
		assert.deepEqual(observation.profiles, nominalSubtypePerlProfiles);
		assert.deepEqual(observation.shapes, ["subtype"]); assert.deepEqual(observation.positions, ["parameter", "result"]);
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2);
		const scope = matched.map(item => item.scope).join(" ");
		observation.scope += " Additional nominal Perl acceptance: " + scope;
		observation.conversionNotes.subtype += " " + nominalSubtypePerlConversion;
		observation.limitations.push(nominalSubtypePerlLimit);
		for(const position of observation.positions) observation.hostTypes.subtype[position] += nominalSubtypePerlHostSuffix;
		for(const stage of Object.values(observation.stages))
		{
			assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
			stage.note += " Additional nominal Perl acceptance: " + scope;
		}
		inventory.observations.push({ id: `nominal-subtype-perl-fields-${path}`
			, profiles: [...nominalSubtypePerlProfiles], shapes: ["subtype"]
			, positions: ["field"], path, scope
			, hostTypes: { subtype: { field: "Math::BigInt payload in generated blessed wrappers for the tested acyclic records and variants; no proof field" } }
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: ids, note: scope }]))
			, limitations: [nominalSubtypePerlLimit]
			, conversionNotes: { subtype: observation.conversionNotes.subtype } });
	}
	return inventory;
};
