/**
 * Expand only Ruby's proven nominal Subtype parameter, result and field positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkNominalPrimitiveSubtypeRubyEvidence
	, nominalPrimitiveSubtypeRubyEvidence
	, nominalPrimitiveSubtypeRubyEvidenceSha256
} from "./nominal-primitive-subtype-ruby-evidence.mjs";
import {
	nominalSubtypeRubyConversion
	, nominalSubtypeRubyLimit
} from "./nominal-subtype-ruby-promotion.mjs";

export const nominalPrimitiveSubtypeRubyProfiles = ["ruby"];
export const nominalPrimitiveSubtypeRubyConversion = "In Ruby, checked nominal fields preserve all nineteen tested primitive representations: the generated Unit singleton, true or false, Integer for every fixed-width integer and native machine word, Float for Float32 and Float, UTF-8 String for String and Char, and binary String for ByteArray. Generated frozen keyword-initialized classes carry record and active-variant fields. Each input site retains its selected checked constructor and accepted normalization. Rejection preserves the complete caller value and later valid calls succeed. Copied results project proof-backed payloads without proof fields or input constructor selections, including standalone result-only packages.";
export const nominalPrimitiveSubtypeRubyLimit = "Primitive-base nominal Ruby acceptance covers the tested acyclic records, variants, aliases, mixed Fin guards and constructor-free results over Unit, Bool, UInt8, UInt16, UInt32, UInt64, Int8, Int16, Int32, Int64, Nat, Int, Float32, Float, String, ByteArray, Char, USize and ISize. Both author routes and full/result-only APIs reproduce complete gems from two author roots, install offline after author removal and replay after moving the installed tree on MRI Ruby 3.3.12, Linux x64/glibc 2.36 and 64-bit machine words. Original gems, complete package identities, execution/control records, the preserved failed launch and selected sources are retained; external toolchain binaries are not. Other hosts require their own primitive-base nominal acceptance. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work. Constructor/source entry counts and memory are unmeasured. These local runs do not establish hosted release-floor acceptance; archived absolute paths describe the original machine and are not CI prerequisites.";
export const nominalPrimitiveSubtypeRubyHostTypes = Object.freeze({
	parameter: "generated Unit singleton, true or false, Integer, Float, UTF-8 String or binary String; checked by the selected Lean constructor before dispatch, including inside generated structural and nominal values"
	, result: "corresponding generated Unit singleton, boolean, Integer, Float, UTF-8 String or binary String projected from the proof-backed Lean result, including inside generated structural and nominal values"
	, field: "generated Unit singleton, boolean, Integer, Float, UTF-8 String or binary String payload in generated frozen record and variant classes; no proof field"
});
export const nominalPrimitiveSubtypeRubyField = nominalPrimitiveSubtypeRubyHostTypes.field;
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Derive four inventory references from an explicitly selected evidence descriptor.
 *
 * @param checked - Fully validated evidence or a metadata-only rejection precheck.
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
const referencesFromEvidence = async (checked, read) => {
	const references = [];
	for(const run of checked.selections)
	{
		const label = `${run.route}-${run.mode}`;
		const start = JSON.parse(await read(`${nominalPrimitiveSubtypeRubyEvidence}/${label}/producer/start.json`));
		const report = JSON.parse(await read(`${nominalPrimitiveSubtypeRubyEvidence}/${label}/records/report.json`));
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const files = checked.files.filter(file => file.path.startsWith(label + "/")
			|| file.path.startsWith("sources/") || file.path.startsWith("checkers/") || file.path.startsWith("runners/"));
		references.push({
			id: `nominal-primitive-subtype-ruby-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalPrimitiveSubtypeRubyProfiles]
			, revision: checked.producerCommit, counts: run, command
			, scope: `Two independent author builds reproduce the complete Ruby gem. Offline installation follows author removal; unchanged callers replay after moving the installed tree, giving two executions per selection. ${run.mode === "full" ? "The full API checks all nineteen primitive fields, per-site constructors and normalization, repeated fields, active variants, aliases, mixed Fin guards, exact rejection paths, caller snapshots and recovery." : "The standalone result-only API projects all nineteen primitive payloads through scalars, copied containers, records, variants and aliases without any input constructor selections."} ${nominalPrimitiveSubtypeRubyLimit}`
			, files: [{ path: nominalPrimitiveSubtypeRubyEvidence + "/index.json", sha256: nominalPrimitiveSubtypeRubyEvidenceSha256 }
				, ...files.map(file => ({ path: nominalPrimitiveSubtypeRubyEvidence + "/" + file.path, sha256: file.sha256 }))]
			, artifacts: Object.entries(report.builds[0].archives).map(([path, digest]) => ({ path, sha256: digest }))
		});
	}
	return references;
};

let defaultReferences;

/**
 * Derive references only after authenticating every original selection and failure.
 * The immutable repository archive is replayed once per process; custom readers
 * remain uncached so substitution tests always exercise their supplied bytes.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
export const nominalPrimitiveSubtypeRubyReferences = async (read = readFile) => {
	if(read !== readFile) return referencesFromEvidence(await checkNominalPrimitiveSubtypeRubyEvidence(read), read);
	defaultReferences ??= referencesFromEvidence(await checkNominalPrimitiveSubtypeRubyEvidence(readFile), readFile);
	return structuredClone(await defaultReferences);
};

// Refuse changed reference metadata before replaying the retained gems and
// constructor controls. This precheck grants no acceptance: every valid
// promotion still runs the complete evidence checker below.
const referencePrecheck = async () => {
	const bytes = await readFile(nominalPrimitiveSubtypeRubyEvidence + "/index.json");
	assert.equal(sha256(bytes), nominalPrimitiveSubtypeRubyEvidenceSha256);
	const index = JSON.parse(bytes), read = async path => {
		const entry = index.files.find(file => nominalPrimitiveSubtypeRubyEvidence + "/" + file.path === path);
		assert.ok(entry, path);
		const value = await readFile(path);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		return value;
	};
	const selections = [];
	for(const run of index.runs)
	{
		const controls = JSON.parse(await read(`${nominalPrimitiveSubtypeRubyEvidence}/${run.label}/controls/controls.json`));
		selections.push({ ...controls.checked, attempt: run.attempt, loadCeiling: run.loadCeiling });
	}
	return referencesFromEvidence({ producerCommit: index.producerCommit, files: index.files, selections }, read);
};

/**
 * Supplement the six proven Ruby cells and leave every other profile and position unchanged.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalPrimitiveSubtypeRuby = async (original, references) => {
	assert.deepEqual(references, await referencePrecheck());
	assert.deepEqual(references, await nominalPrimitiveSubtypeRubyReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of [
		"tests/helpers/nominal-primitive-subtype-ruby-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-ruby-evidence.mjs"
		, "tests/helpers/nominal-primitive-subtype-ruby-controls.mjs"
		, "tests/helpers/nominal-primitive-subtype-ruby-provenance.mjs"
		, "tests/helpers/nominal-primitive-subtype-ruby-promotion.mjs"
		, "tests/helpers/nominal-primitive-subtype-ruby-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-ruby-ci-report.mjs"
		, "scripts/check-nominal-primitive-subtype-ruby-ci.mjs"
		, "scripts/run-nominal-primitive-subtype-ruby-ci.sh"
		, ".github/workflows/nominal-primitive-subtype-ruby.yml"
	]) validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path }))
		});
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype")
			&& item.profiles.some(profile => nominalPrimitiveSubtypeRubyProfiles.includes(profile)));
		const mainId = path === "ordinary-source" ? "native-subtype-ruby-ordinary-source" : "reviewed-native-subtype-ruby";
		assert.deepEqual(matches.map(item => [item.id, item.profiles, item.shapes, item.positions]), [
			[mainId, nominalPrimitiveSubtypeRubyProfiles, ["subtype"], ["parameter", "result"]]
			, [`nominal-subtype-ruby-fields-${path}`, nominalPrimitiveSubtypeRubyProfiles, ["subtype"], ["field"]]
		], "Missing or overlapping Ruby Subtype observations");
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2); const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			observation.scope = observation.scope.replaceAll(nominalSubtypeRubyLimit, "").trimEnd() + " Additional primitive-base Ruby acceptance: " + scope;
			assert.equal(observation.conversionNotes.subtype.split(nominalSubtypeRubyConversion).length, 2);
			observation.conversionNotes.subtype = observation.conversionNotes.subtype.replace(nominalSubtypeRubyConversion, nominalPrimitiveSubtypeRubyConversion);
			assert.equal(observation.limitations.filter(item => item === nominalSubtypeRubyLimit).length, 1);
			observation.limitations = observation.limitations.map(item => item === nominalSubtypeRubyLimit ? nominalPrimitiveSubtypeRubyLimit : item);
			if(observation.positions.includes("field")) observation.hostTypes.subtype.field = nominalPrimitiveSubtypeRubyField;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note = stage.note.replaceAll(nominalSubtypeRubyLimit, "").trimEnd() + " Additional primitive-base Ruby acceptance: " + scope;
			}
		}
	}
	return inventory;
};
