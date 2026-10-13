/**
 * Tie native PHP nominal support to four original installed Composer selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypePhpOriginal, nominalSubtypePhpGenerator } from "./nominal-subtype-php-generators.mjs";
import { checkNominalSubtypePhpReport } from "./nominal-subtype-php-report.mjs";
import { assertNominalSubtypePhpRun, nominalSubtypePhpSelections } from "./nominal-subtype-php-provenance.mjs";

export const nominalSubtypePhpArchive = "docs/evidence/nominal-subtype-php-20261013";
export const nominalSubtypePhpIndexSha256 = "9f22ebf9f08e25f38b909690a6bc27b024f161b339eb98c6c2200e4c4039c2c2";
export const nominalSubtypePhpProfiles = ["php-native"];
export const nominalSubtypePhpHostSuffix = "; also in tested acyclic records and variants";
export const nominalSubtypePhpConversion = "In native PHP, the tested acyclic records and variants use generated final readonly classes with exact Brick\\Math\\BigInteger payloads for Nat Subtypes. Pass generated values without proof fields. Weak and strict callers receive the same validation. Negative Nat values, wrong classes, uninitialized properties, null payloads and malformed cases reject. Each input site keeps its selected checked constructor, including distinct normalizing choices for the same record. Copied results project existing Lean values without selecting or running an input constructor.";
export const nominalSubtypePhpLimit = "Nominal acceptance covers the tested Nat Subtype records, variants, aliases and copied constructor-free results with PHP 8.2.33 and Composer 2.5.5 through offline Composer installation on Linux x64/glibc 2.36 with an explicit 2.36 package floor. Weak and strict consumers run after author/build removal and again after relocation. PHP consumer source remains required at runtime. Other primitive-base nominal fixtures and PHP-Wasm need separate acceptance. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain pending. Constructor/source entry counts and memory are unmeasured; these local runs do not establish hosted release-floor acceptance. The repository archive retains all non-native ZIP members, Composer autoload inputs, receipts and source snapshots, but not native binaries or complete ZIPs. The complete PHP and Composer distributions remain trusted tools.";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Authenticate original sources, package records and all four executions per selection.
 *
 * @param read - Reader of repository-relative original archive files.
 */
export const nominalSubtypePhpReferences = async (read = readFile) => {
	const bytes = await read(`${nominalSubtypePhpArchive}/index.json`);
	assert.equal(sha256(bytes), nominalSubtypePhpIndexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-php-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypePhpSelections);
	for(const entry of index.files)
	{
		assert.ok(/^[A-Za-z0-9_.$/-]+$/u.test(entry.path) && entry.path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(!files.has(entry.path));
		const value = await read(`${nominalSubtypePhpArchive}/${entry.path}`);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		files.set(entry.path, value);
	}
	for(const path of index.selectedSources)
		assert.deepEqual(files.get(`sources/${path}`), nominalSubtypePhpOriginal(index.producerCommit, path));
	assert.deepEqual(index.generatorClosure, (await nominalSubtypePhpGenerator(index.producerCommit)).paths);
	assert.ok(index.generatorClosure.every(path => index.selectedSources.includes(path)));
	const references = [];
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" }); assert.equal(run.floor, "2.36");
		assert.equal(run.phpVersion, "8.2.33"); assert.equal(run.composerVersion, "2.5.5");
		const prefix = `${run.label}/records/`, records = async path => files.get(prefix + path);
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), run.records);
		const checked = await checkNominalSubtypePhpReport(records, run);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		const reportBytes = await records("report.json"), report = JSON.parse(reportBytes);
		assert.equal(sha256(reportBytes), run.reportSha256);
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished); assert.equal(sha256(tap), run.tapSha256);
		assertNominalSubtypePhpRun({ ...run, start, end, tap, runner: files.get("runner.mjs") });
		for(const path of index.selectedSources) assert.equal(start.sources[path], sha256(files.get(`sources/${path}`)));
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const selected = index.files.filter(file => file.path.startsWith(run.label + "/") || file.path.startsWith("sources/") || file.path.startsWith("checkers/") || file.path.startsWith("failed-") || file.path === "runner.mjs");
		references.push({ id: `nominal-subtype-php-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalSubtypePhpProfiles]
			, revision: run.producerCommit, command, counts: checked
			, scope: `Two independent author roots reproduce the complete Composer ZIP. Author and build roots are removed before offline installation. Unchanged weak and strict PHP callers replay after moving the installed consumer tree, for four executions per selection. Consumer PHP source remains present. ${run.mode === "full" ? "The full fixture checks per-use constructor selection and normalization, repeated record fields, active variant branches, aliases, mixed Fin guards, exact rejection paths, caller-input preservation and recovery." : "The standalone result-only fixture projects scalars, structural containers, records, variants and aliases without input constructor choices, including 100-bit Nat results."} ${nominalSubtypePhpLimit}`
			, files: [{ path: `${nominalSubtypePhpArchive}/index.json`, sha256: nominalSubtypePhpIndexSha256 }, ...selected.map(file => ({ path: `${nominalSubtypePhpArchive}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: report.receipt.packages[0].artifacts.map(({ path, sha256 }) => ({ path, sha256 })) });
	}
	for(let index_ = 1; index_ < index.runs.length; index_++)
		assert.ok(Date.parse(index.runs[index_ - 1].finished) <= Date.parse(index.runs[index_].started));
	return references;
};

/**
 * Supplement two existing native PHP observations and add two observed field cells.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalSubtypePhp = async (original, references) => {
	assert.deepEqual(references, await nominalSubtypePhpReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of ["tests/helpers/nominal-subtype-php-report.mjs", "tests/helpers/nominal-subtype-php-promotion.mjs", "tests/helpers/nominal-subtype-php-promotion-tests.mjs", "docs/evidence/nominal-subtype-php-20261013.md"])
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
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.some(profile => nominalSubtypePhpProfiles.includes(profile)));
		const expected = path === "ordinary-source"
			? [["native-subtype-php-native-ordinary-source", ["php-native"]]]
			: [["reviewed-native-subtype-php-native", ["php-native"]]];
		assert.deepEqual(matches.map(item => [item.id, item.profiles]), expected, "Missing or overlapping native PHP Subtype observations");
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2);
		const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			assert.deepEqual(observation.shapes, ["subtype"]); assert.deepEqual(observation.positions, ["parameter", "result"]);
			observation.scope += " Additional nominal PHP acceptance: " + scope;
			observation.conversionNotes.subtype += " " + nominalSubtypePhpConversion;
			observation.limitations.push(nominalSubtypePhpLimit);
			for(const position of observation.positions) observation.hostTypes.subtype[position] += nominalSubtypePhpHostSuffix;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note += " Additional nominal PHP acceptance: " + scope;
			}
		}
		inventory.observations.push({ id: `nominal-subtype-php-fields-${path}`
			, profiles: [...nominalSubtypePhpProfiles], shapes: ["subtype"]
			, positions: ["field"], path, scope
			, hostTypes: { subtype: { field: "Brick\\Math\\BigInteger payload in generated final readonly records and variant cases for the tested acyclic records and variants; no proof field" } }
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: ids, note: scope }]))
			, limitations: [nominalSubtypePhpLimit]
			, conversionNotes: { subtype: nominalSubtypePhpConversion } });
	}
	return inventory;
};
