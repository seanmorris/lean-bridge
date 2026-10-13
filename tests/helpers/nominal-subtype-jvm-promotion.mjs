/**
 * Tie Java/Kotlin nominal support to four original installed package selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypeJvmOriginal, nominalSubtypeJvmGenerator } from "./nominal-subtype-jvm-generators.mjs";
import { checkNominalSubtypeJvmReport } from "./nominal-subtype-jvm-report.mjs";
import { assertNominalSubtypeJvmRun, nominalSubtypeJvmSelections } from "./nominal-subtype-jvm-provenance.mjs";

export const nominalSubtypeJvmArchive = "docs/evidence/nominal-subtype-jvm-20261013";
export const nominalSubtypeJvmIndexSha256 = "ee5dfe4809453595b3d662d2624a0c50c4e93c908d63195176bbd0f9dc56e0e1";
export const nominalSubtypeJvmProfiles = ["java", "kotlin"];
export const nominalSubtypeJvmHostSuffix = "; also in tested acyclic records and variants";
export const nominalSubtypeJvmConversion = "In Java and Kotlin, the tested acyclic records and variants use generated records and sealed variant cases with exact BigInteger payloads for Nat Subtypes. Pass generated values without proof fields. Negative Nat values, null payloads and malformed cases reject. Each input site keeps its selected checked constructor, including distinct normalizing choices for the same record. Copied results project existing Lean values without selecting or running an input constructor.";
export const nominalSubtypeJvmLimit = "Nominal acceptance covers the tested Nat Subtype records, variants, aliases and copied constructor-free results with JDK 22.0.2 and Kotlin 2.2.0 through offline Maven-package installation on Linux x64/glibc 2.36 with an explicit 2.36 package floor. Java and Kotlin consumers run after relocation and again after removal of all consumer sources. Other primitive-base nominal fixtures and other hosts need separate acceptance. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain pending. Constructor/source entry counts and memory are unmeasured; these local runs do not establish hosted release-floor acceptance. The repository archive retains non-native JAR members, compiled validation probes, receipts and source snapshots, but not the native library, complete JARs or consumer bytecode. The complete JDK and Kotlin distributions remain trusted tools.";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Authenticate original sources, package records and all six executions per selection.
 *
 * @param read - Reader of repository-relative original archive files.
 */
export const nominalSubtypeJvmReferences = async (read = readFile) => {
	const bytes = await read(`${nominalSubtypeJvmArchive}/index.json`);
	assert.equal(sha256(bytes), nominalSubtypeJvmIndexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-jvm-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypeJvmSelections);
	for(const entry of index.files)
	{
		assert.ok(/^[A-Za-z0-9_.$/-]+$/u.test(entry.path) && entry.path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(!files.has(entry.path));
		const value = await read(`${nominalSubtypeJvmArchive}/${entry.path}`);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		files.set(entry.path, value);
	}
	for(const path of index.selectedSources)
		assert.deepEqual(files.get(`sources/${path}`), nominalSubtypeJvmOriginal(index.producerCommit, path));
	assert.deepEqual(index.generatorClosure, (await nominalSubtypeJvmGenerator(index.producerCommit)).paths);
	assert.ok(index.generatorClosure.every(path => index.selectedSources.includes(path)));
	const references = [];
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" }); assert.equal(run.floor, "2.36");
		assert.match(run.javaVersion, /^openjdk 22\.0\.2 2024-07-16\n/u);
		const prefix = `${run.label}/records/`, records = async path => files.get(prefix + path);
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), run.records);
		const checked = await checkNominalSubtypeJvmReport(records, run);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		const reportBytes = await records("report.json"), report = JSON.parse(reportBytes);
		assert.equal(sha256(reportBytes), run.reportSha256);
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished); assert.equal(sha256(tap), run.tapSha256);
		assertNominalSubtypeJvmRun({ ...run, start, end, tap });
		for(const path of index.selectedSources) assert.equal(start.sources[path], sha256(files.get(`sources/${path}`)));
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const selected = index.files.filter(file => file.path.startsWith(run.label + "/") || file.path.startsWith("sources/") || file.path.startsWith("checkers/"));
		references.push({ id: `nominal-subtype-jvm-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalSubtypeJvmProfiles]
			, revision: run.producerCommit, command, counts: checked
			, scope: `Two independent author roots reproduce the complete Maven JAR and POM. Author sources are removed before offline installation. Unchanged Java and Kotlin callers replay after moving the installed consumer tree and again after deleting all consumer sources, for six executions per selection. ${run.mode === "full" ? "The full fixture checks per-use constructor selection and normalization, repeated record fields, active variant branches, aliases, mixed Fin guards, exact rejection paths, caller-input preservation and recovery." : "The standalone result-only fixture projects scalars, structural containers, records, variants and aliases without input constructor choices, including 100-bit Nat results."} Kotlin nullability and compiled invalid-caller probes have separate retained checks. ${nominalSubtypeJvmLimit}`
			, files: [{ path: `${nominalSubtypeJvmArchive}/index.json`, sha256: nominalSubtypeJvmIndexSha256 }, ...selected.map(file => ({ path: `${nominalSubtypeJvmArchive}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: report.receipt.packages[0].artifacts.map(({ path, sha256 }) => ({ path, sha256 })) });
	}
	for(let index_ = 1; index_ < index.runs.length; index_++)
		assert.ok(Date.parse(index.runs[index_ - 1].finished) <= Date.parse(index.runs[index_].started));
	return references;
};

/**
 * Supplement three existing JVM observations and add four observed field cells.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalSubtypeJvm = async (original, references) => {
	assert.deepEqual(references, await nominalSubtypeJvmReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of ["tests/helpers/nominal-subtype-jvm-report.mjs", "tests/helpers/nominal-subtype-jvm-promotion.mjs", "tests/helpers/nominal-subtype-jvm-promotion-tests.mjs", "docs/evidence/nominal-subtype-jvm-20261013.md"])
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
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.some(profile => nominalSubtypeJvmProfiles.includes(profile)));
		const expected = path === "ordinary-source"
			? [["native-subtype-java-kotlin-ordinary-source", ["java", "kotlin"]]]
			: [["reviewed-native-subtype-java", ["java"]], ["reviewed-native-subtype-kotlin", ["kotlin"]]];
		assert.deepEqual(matches.map(item => [item.id, item.profiles]), expected, "Missing or overlapping JVM Subtype observations");
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2);
		const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			assert.deepEqual(observation.shapes, ["subtype"]); assert.deepEqual(observation.positions, ["parameter", "result"]);
			observation.scope += " Additional nominal JVM acceptance: " + scope;
			observation.conversionNotes.subtype += " " + nominalSubtypeJvmConversion;
			observation.limitations.push(nominalSubtypeJvmLimit);
			for(const position of observation.positions) observation.hostTypes.subtype[position] += nominalSubtypeJvmHostSuffix;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note += " Additional nominal JVM acceptance: " + scope;
			}
		}
		inventory.observations.push({ id: `nominal-subtype-jvm-fields-${path}`
			, profiles: [...nominalSubtypeJvmProfiles], shapes: ["subtype"]
			, positions: ["field"], path, scope
			, hostTypes: { subtype: { field: "BigInteger payload in generated records and sealed variant cases for the tested acyclic records and variants; no proof field" } }
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: ids, note: scope }]))
			, limitations: [nominalSubtypeJvmLimit]
			, conversionNotes: { subtype: nominalSubtypeJvmConversion } });
	}
	return inventory;
};
