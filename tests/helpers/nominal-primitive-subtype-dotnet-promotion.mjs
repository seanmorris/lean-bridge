/**
 * Expand only C# positions established by nineteen-base nominal NuGet runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkNominalPrimitiveSubtypeDotnetEvidence
	, nominalPrimitiveSubtypeDotnetEvidence
	, nominalPrimitiveSubtypeDotnetEvidenceSha256
} from "./nominal-primitive-subtype-dotnet-evidence.mjs";
import {
	nominalSubtypeDotnetConversion
	, nominalSubtypeDotnetLimit
} from "./nominal-subtype-dotnet-promotion.mjs";

export const nominalPrimitiveSubtypeDotnetProfiles = ["dotnet"];
export const nominalPrimitiveSubtypeDotnetConversion = "In C#, checked nominal values preserve all nineteen tested primitive representations: Unit, bool, byte, ushort, uint, ulong, sbyte, short, int, long, BigInteger for Nat and Int, float, double, string, byte[], Rune, ulong for USize and long for ISize. Generated sealed records and cases carry the record and active-variant fields. Each input site retains its selected checked constructor and accepted normalization; only the active variant branch is checked. Rejection preserves the complete caller value and later valid calls succeed. Copied results project proof-backed payloads without proof fields or input constructor selections, including standalone result-only packages.";
export const nominalPrimitiveSubtypeDotnetLimit = "Primitive-base nominal C# acceptance covers the tested acyclic records, variants, aliases, mixed Fin guards and constructor-free results over Unit, Bool, UInt8, UInt16, UInt32, UInt64, Int8, Int16, Int32, Int64, Nat, Int, Float32, Float, String, ByteArray, Char, USize and ISize. Both author routes and full/result-only APIs reproduce complete NuGet packages from two author roots, remove author sources, restore offline, replay after relocation and execute again after deleting all consumer sources. The runs use .NET SDK 8.0.424 and shared framework 8.0.30 on Linux x64/glibc 2.36 with an explicit 2.36 package floor and 64-bit machine words. Original packages, receipts, restore inputs, API-probe diagnostics, execution records and selected sources are retained; external toolchain binaries are represented by version, size and digest. Other hosts need their own primitive-base nominal acceptance. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work. Constructor/source entry counts and memory are unmeasured. Hosted release-floor acceptance remains assigned to the recurring workflow; archived absolute paths describe the original local runs and are not CI prerequisites.";
export const nominalPrimitiveSubtypeDotnetField = "corresponding C# primitive value in generated sealed records and active case records across all nineteen tested bases; no proof field";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

const commandFor = start => [...Object.entries(start.environment).map(([key, value]) => {
	assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
	return key + "=" + quote(value);
})
, quote(start.command), ...start.args.map(quote)].join(" ");

/**
 * Derive four inventory references from validated evidence or a metadata precheck.
 *
 * @param checked - Validated archive descriptor.
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
const referencesFromEvidence = async (checked, read) => {
	const index = JSON.parse(await read(`${nominalPrimitiveSubtypeDotnetEvidence}/index.json`));
	assert.equal(index.producerCommit, checked.producerCommit);
	assert.equal(index.runs.length, checked.selections.length);
	const references = [];
	for(const [position, counts] of checked.selections.entries())
	{
		const run = index.runs[position], label = `${run.route}-${run.mode}`;
		assert.equal(counts.route, run.route); assert.equal(counts.mode, run.mode);
		const start = JSON.parse(await read(`${nominalPrimitiveSubtypeDotnetEvidence}/${label}/producer/start.json`));
		const report = JSON.parse(await read(`${nominalPrimitiveSubtypeDotnetEvidence}/${label}/records/report.json`));
		const files = checked.files.filter(file => file.path.startsWith(label + "/")
			|| file.path.startsWith("sources/"));
		references.push({
			id: `nominal-primitive-subtype-dotnet-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalPrimitiveSubtypeDotnetProfiles]
			, revision: checked.producerCommit, counts, command: commandFor(start)
			, scope: `Two independent author builds reproduce the complete NuGet package. Author sources are removed before offline restore; unchanged callers replay after moving the installed tree and execute again after deleting all consumer sources, giving three executions per selection. ${run.mode === "full" ? "The full API checks all nineteen primitive fields, per-site constructors and normalization, repeated fields, active variants, aliases, mixed Fin guards, exact rejection paths, caller snapshots and recovery." : "The standalone result-only API projects all nineteen primitive payloads through scalars, copied containers, records, variants and aliases without any input constructor selections."} ${nominalPrimitiveSubtypeDotnetLimit}`
			, files: [{
				path: nominalPrimitiveSubtypeDotnetEvidence + "/index.json"
				, sha256: nominalPrimitiveSubtypeDotnetEvidenceSha256
			}
			, ...files.map(file => ({
				path: nominalPrimitiveSubtypeDotnetEvidence + "/" + file.path
				, sha256: file.sha256
			}))]
			, artifacts: report.receipt.packages[0].artifacts
				.map(({ path, sha256 }) => ({ path, sha256 }))
		});
	}
	return references;
};

let defaultReferences;

/**
 * Derive references only after authenticating all four original packages.
 *
 * @param read - Reader used to authenticate retained evidence bytes.
 */
export const nominalPrimitiveSubtypeDotnetReferences = async (read = readFile) => {
	if(read !== readFile)
		return referencesFromEvidence(await checkNominalPrimitiveSubtypeDotnetEvidence(read), read);
	defaultReferences ??= referencesFromEvidence(
		await checkNominalPrimitiveSubtypeDotnetEvidence(), readFile
	);
	return structuredClone(await defaultReferences);
};

// Reject changed metadata before the representative mutation replay. Every
// accepted promotion still runs the complete archive verifier above.
const referencePrecheck = async () => {
	const bytes = await readFile(nominalPrimitiveSubtypeDotnetEvidence + "/index.json");
	assert.equal(sha256(bytes), nominalPrimitiveSubtypeDotnetEvidenceSha256);
	const index = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(index));
	const read = async path => {
		if(path === nominalPrimitiveSubtypeDotnetEvidence + "/index.json") return bytes;
		const entry = index.files.find(file =>
			nominalPrimitiveSubtypeDotnetEvidence + "/" + file.path === path);
		assert.ok(entry, path); const value = await readFile(path);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		return value;
	};
	const selections = [];
	for(const run of index.runs)
	{
		const verification = JSON.parse(await read(
			`${nominalPrimitiveSubtypeDotnetEvidence}/${run.label}/producer/verification.json`
		));
		const { archiveSha256, ...result } = verification;
		assert.equal(archiveSha256, run.archiveSha256);
		selections.push({ ...result, ...run.controls
			, attempt: run.attempt, loadCeiling: run.loadCeiling });
	}
	return referencesFromEvidence({
		producerCommit: index.producerCommit, files: index.files, selections
	}, read);
};

/**
 * Supplement six proven C# cells and leave every other profile unchanged.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalPrimitiveSubtypeDotnet = async (original, references) => {
	assert.deepEqual(references, await referencePrecheck());
	assert.deepEqual(references, await nominalPrimitiveSubtypeDotnetReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of [
		"tests/helpers/nominal-primitive-subtype-dotnet-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-dotnet-evidence.mjs"
		, "tests/helpers/nominal-primitive-subtype-dotnet-controls.mjs"
		, "tests/helpers/nominal-primitive-subtype-dotnet-provenance.mjs"
		, "tests/helpers/nominal-primitive-subtype-dotnet-promotion.mjs"
		, "tests/helpers/nominal-primitive-subtype-dotnet-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-dotnet-ci-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-dotnet-ci-workflow.mjs"
		, "scripts/check-nominal-primitive-subtype-dotnet-ci.mjs"
		, "scripts/run-nominal-primitive-subtype-dotnet-ci.sh"
		, ".github/workflows/nominal-primitive-subtype-dotnet.yml"
	]) validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id),
			"Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({
				...item, path: reference.id + "/" + item.path
			}))
		});
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.path === path
			&& item.shapes.includes("subtype")
			&& item.profiles.some(profile => nominalPrimitiveSubtypeDotnetProfiles.includes(profile)));
		const mainId = path === "ordinary-source"
			? "native-subtype-dotnet-ordinary-source" : "reviewed-native-subtype-dotnet";
		assert.deepEqual(matches.map(item => [item.id, item.profiles, item.shapes, item.positions]), [
			[mainId, nominalPrimitiveSubtypeDotnetProfiles, ["subtype"], ["parameter", "result"]]
			, [`nominal-subtype-dotnet-fields-${path}`
				, nominalPrimitiveSubtypeDotnetProfiles, ["subtype"], ["field"]]
		], "Missing or overlapping C# Subtype observations");
		const matched = references.filter(item => item.sourcePath === path);
		const ids = matched.map(item => item.id); assert.equal(matched.length, 2);
		const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			observation.scope = observation.scope.replaceAll(nominalSubtypeDotnetLimit, "").trimEnd()
				+ " Additional primitive-base C# acceptance: " + scope;
			assert.equal(observation.conversionNotes.subtype.split(nominalSubtypeDotnetConversion).length, 2);
			observation.conversionNotes.subtype = observation.conversionNotes.subtype.replace(
				nominalSubtypeDotnetConversion, nominalPrimitiveSubtypeDotnetConversion
			);
			assert.equal(observation.limitations.filter(item => item === nominalSubtypeDotnetLimit).length, 1);
			observation.limitations = observation.limitations.map(item =>
				item === nominalSubtypeDotnetLimit ? nominalPrimitiveSubtypeDotnetLimit : item);
			if(observation.positions.includes("field"))
				observation.hostTypes.subtype.field = nominalPrimitiveSubtypeDotnetField;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note = stage.note.replaceAll(nominalSubtypeDotnetLimit, "").trimEnd()
					+ " Additional primitive-base C# acceptance: " + scope;
			}
		}
	}
	return inventory;
};
