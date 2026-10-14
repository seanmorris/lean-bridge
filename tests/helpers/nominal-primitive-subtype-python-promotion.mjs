/**
 * Supplement only the Python positions established by the nineteen-base nominal Python runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypePythonArchive, nominalPrimitiveSubtypePythonArchive, nominalPrimitiveSubtypePythonArchiveSha256 } from "./nominal-primitive-subtype-python-archive.mjs";
import { nominalSubtypePythonConversion, nominalSubtypePythonLimit } from "./nominal-subtype-python-promotion.mjs";

export const nominalPrimitiveSubtypePythonProfiles = ["python"];
export const nominalPrimitiveSubtypePythonConversion = "In Python, checked fields retain the declared primitive's host representation across all nineteen tested bases: None for Unit, bool for Bool, int for every integer and native machine word, float for Float32 and Float, str for String and Char, and bytes for ByteArray. Generated frozen dataclasses carry the record and variant fields. Each input site keeps its selected checked constructor and accepted normalization; only the active variant branch is checked. Rejection preserves caller values and later valid calls succeed. Copied results project existing Lean payloads without proof fields or input constructor selections, including standalone result-only packages.";
export const nominalPrimitiveSubtypePythonLimit = "Primitive-base nominal Python acceptance covers the tested acyclic records, variants, aliases, mixed Fin guards and constructor-free results over Unit, Bool, UInt8, UInt16, UInt32, UInt64, Int8, Int16, Int32, Int64, Nat, Int, Float32, Float, String, ByteArray, Char, USize and ISize. Both author routes and full/result-only APIs reproduce complete wheels from two authors. CPython 3.11.16 and 3.12.14 install the same wheel offline after author removal and replay after physical relocation on Linux x64/glibc 2.36 with an explicit 2.36 package floor. Original wheels, receipts, process records, environment closures and selected sources are retained; external toolchain binaries are not. Other hosts need their own primitive-base nominal acceptance. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work. Constructor/source entry counts and memory are unmeasured. These local runs do not establish hosted release-floor acceptance; archived absolute paths describe the original machine and are not CI prerequisites.";
export const nominalPrimitiveSubtypePythonField = "declared primitive's host value in generated frozen record and variant dataclasses across nineteen tested bases; no proof field";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Derive four inventory references only after authenticating all original installed selections.
 *
 * @param read - Reader of repository-relative original archive bytes.
 */
export const nominalPrimitiveSubtypePythonReferences = async (read = readFile) => {
	const checked = await checkNominalPrimitiveSubtypePythonArchive(read), references = [];
	for(const run of checked.selections)
	{
		const label = run.route + "/" + run.mode;
		const start = JSON.parse(await read(`${nominalPrimitiveSubtypePythonArchive}/${label}/producer/start.json`));
		const report = JSON.parse(await read(`${nominalPrimitiveSubtypePythonArchive}/${label}/records/report.json`));
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string"); return key + "=" + quote(value);
		})
		, "node", ...start.args.map(quote)].join(" ");
		const files = checked.files.filter(file => file.path.startsWith(label + "/") || file.path.startsWith("sources/") || ["producer.mjs", "controls-runner.mjs"].includes(file.path));
		references.push({ id: `nominal-primitive-subtype-python-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalPrimitiveSubtypePythonProfiles]
			, revision: checked.producerCommit, counts: run, command
			, scope: `Two independent author builds reproduce the complete Python wheel. Offline installation follows author removal; unchanged callers replay after moving the installed tree on both CPython floors, giving four executions per selection. ${run.mode === "full" ? "The full API checks per-site constructors, normalization, repeated record fields, active variants, aliases, mixed Fin guards, rejected-input snapshots and recovery." : "The standalone result-only API projects primitive payloads through scalars, copied containers, records, variants and aliases without any input constructor selections."} ${nominalPrimitiveSubtypePythonLimit}`
			, files: [{ path: nominalPrimitiveSubtypePythonArchive + "/index.json", sha256: nominalPrimitiveSubtypePythonArchiveSha256 }
				, ...files.map(file => ({ path: nominalPrimitiveSubtypePythonArchive + "/" + file.path, sha256: file.sha256 }))]
			, artifacts: Object.entries(report.builds[0].archives).map(([path, digest]) => ({ path, sha256: digest })) });
	}
	return references;
};

/**
 * Expand four existing observations without changing any other profile, position or stage state.
 *
 * @param original - Exact inventory at the prior milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalPrimitiveSubtypePython = async (original, references) => {
	assert.deepEqual(references, await nominalPrimitiveSubtypePythonReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of [
		"tests/helpers/nominal-primitive-subtype-python-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-python-archive.mjs"
		, "tests/helpers/nominal-primitive-subtype-python-controls.mjs"
		, "tests/helpers/nominal-primitive-subtype-python-promotion.mjs"
		, "tests/helpers/nominal-primitive-subtype-python-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-python-ci-report.mjs"
		, "scripts/check-nominal-primitive-subtype-python-ci.mjs"
		, "scripts/run-nominal-primitive-subtype-python-ci.sh"
		, ".github/workflows/nominal-primitive-subtype-python.yml"
	]) validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path })) });
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.some(profile => nominalPrimitiveSubtypePythonProfiles.includes(profile)));
		const mainId = path === "ordinary-source" ? "native-subtype-python-ordinary-source" : "reviewed-native-subtype-python";
		assert.deepEqual(matches.map(item => [item.id, item.profiles, item.shapes, item.positions]), [
			[mainId, nominalPrimitiveSubtypePythonProfiles, ["subtype"], ["parameter", "result"]]
			, [`nominal-subtype-python-fields-${path}`, nominalPrimitiveSubtypePythonProfiles, ["subtype"], ["field"]]
		], "Missing or overlapping Python Subtype observations");
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2); const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			observation.scope = observation.scope.replaceAll(nominalSubtypePythonLimit, "").trimEnd() + " Additional primitive-base Python acceptance: " + scope;
			assert.equal(observation.conversionNotes.subtype.split(nominalSubtypePythonConversion).length, 2);
			observation.conversionNotes.subtype = observation.conversionNotes.subtype.replace(nominalSubtypePythonConversion, nominalPrimitiveSubtypePythonConversion);
			assert.equal(observation.limitations.filter(item => item === nominalSubtypePythonLimit).length, 1);
			observation.limitations = observation.limitations.map(item => item === nominalSubtypePythonLimit ? nominalPrimitiveSubtypePythonLimit : item);
			if(observation.positions.includes("field")) observation.hostTypes.subtype.field = nominalPrimitiveSubtypePythonField;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note = stage.note.replaceAll(nominalSubtypePythonLimit, "").trimEnd() + " Additional primitive-base Python acceptance: " + scope;
			}
		}
	}
	return inventory;
};
