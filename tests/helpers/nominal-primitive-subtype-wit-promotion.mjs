/**
 * Expand only WIT/WASI positions established by nineteen-base Wasmtime runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	nominalPrimitiveSubtypeWitEvidence
	, nominalPrimitiveSubtypeWitEvidenceSha256
} from "./nominal-primitive-subtype-wit-evidence.mjs";
import {
	nominalPrimitiveSubtypeWitLoadCeiling
	, nominalPrimitiveSubtypeWitProducer
	, nominalPrimitiveSubtypeWitSelections
} from "./nominal-primitive-subtype-wit-provenance.mjs";
import {
	nominalSubtypeWitConversion
	, nominalSubtypeWitHostSuffix
	, nominalSubtypeWitLimit
} from "./nominal-subtype-wit-promotion.mjs";

export const nominalPrimitiveSubtypeWitProfiles = ["wit-wasi"];
export const nominalPrimitiveSubtypeWitParameter = "the WIT value of each tested primitive base (the unit enum, bool, u8/u16/u32/u64, s8/s16/s32/s64, little-endian `list<u32>` Nat limbs, the signed Int limb record, f32/f64, string, `list<u8>` bytes, char, and u64/s64 for the 64-bit native USize/ISize), checked and constructed by the selected Lean constructor across all nineteen tested primitive bases; also in generated structural containers, acyclic records and active variant cases";
export const nominalPrimitiveSubtypeWitResult = "the corresponding WIT primitive value projected from the proof-backed Lean result across all nineteen tested bases; also in generated structural containers, acyclic records and active variant cases";
export const nominalPrimitiveSubtypeWitField = "corresponding WIT primitive value in named record fields and active variant payloads across all nineteen tested bases; no proof field";
export const nominalPrimitiveSubtypeWitConversion = "In WIT, checked nominal values preserve all nineteen tested primitive representations through the Component Model adapter and its 64-bit native Lean host: the unit enum for Unit; bool; u8, u16, u32 and u64; s8, s16, s32 and s64; exact little-endian `list<u32>` limbs for Nat; a record of sign and limbs for Int; f32 and f64 including signed zero; string with embedded NUL; `list<u8>` for ByteArray; char as a Unicode scalar; and u64/s64 for USize/ISize. Each input site keeps its selected checked constructor, including distinct normalizing choices for the same record, fixed-width wrapping, float negation, text and byte extension and the tested character replacement. The host rejects wrong kinds, malformed fields, non-canonical limbs, negative zero, surrogates and invalid UTF-8 before Lean runs. Rejected refinements leave caller values unchanged; a later valid call succeeds. Copied results project existing Lean values and require no input constructor selection.";
export const nominalPrimitiveSubtypeWitLimit = "Primitive-base nominal WIT acceptance covers the tested acyclic records, variants, aliases, nested Pair/Array/Option/Except values, mixed Fin guards and constructor-free results over Unit, Bool, UInt8, UInt16, UInt32, UInt64, Int8, Int16, Int32, Int64, Nat, Int, Float32, Float, String, ByteArray, Char, USize and ISize on Linux x64/glibc 2.36 with an explicit 2.36 package floor, Wasmtime 42.0.1 and wasm-tools 1.245.1, with 64-bit native machine words. Two independent author builds reproduce each archive. Author/build roots are removed before offline installation, and caller compilation inputs are removed before the identical executable runs and replays after relocation. Generated package sources remain installed. The Component Model adapter requires its native host and is not a standalone WASI command. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work. Constructor/source entry counts and memory are unmeasured; local runs do not establish hosted 2.38 release-floor acceptance. The archive retains original text members, compiled components, caller binaries and complete producer and control receipts, but not complete native archives or native libraries. Compiler and operating system distributions remain trusted.";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Derive four inventory references from validated evidence or its digest precheck.
 *
 * @param checked - Validated archive descriptor.
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
const referencesFromEvidence = async (checked, read) => {
	const index = JSON.parse(await read(`${nominalPrimitiveSubtypeWitEvidence}/index.json`));
	assert.equal(index.producerCommit, checked.producerCommit);
	assert.equal(index.runs.length, checked.selections.length);
	const references = [];
	for(const [position, selection] of checked.selections.entries())
	{
		const run = index.runs[position], label = `${run.route}-${run.mode}`;
		assert.equal(selection.route, run.route); assert.equal(selection.mode, run.mode);
		const report = JSON.parse(await read(`${nominalPrimitiveSubtypeWitEvidence}/${label}/records/report.json`));
		const start = JSON.parse(await read(`${nominalPrimitiveSubtypeWitEvidence}/${label}/producer/start.json`));
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const files = checked.files.filter(file => file.path.startsWith(label + "/")
			|| file.path.startsWith("sources/") || file.path.startsWith("checkers/") || file.path.startsWith("runners/"));
		const counts = { ...run, ...run.controls, producerCommit: checked.producerCommit };
		delete counts.controls; delete counts.label;
		counts.tools = { cc: report.tools.selected.cc, wasmTools: report.tools.selected.wasmTools, wasmtime: report.tools.wasmtime.version };
		references.push({
			id: `nominal-primitive-subtype-wit-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalPrimitiveSubtypeWitProfiles]
			, revision: checked.producerCommit, counts, command
			, scope: `Two independent author roots reproduce the complete WIT archive. Author and build roots are removed before offline installation. One independently compiled public C caller executes the actual Component Model host and its native Lean host before and after moving the installed tree, for two executions per selection; caller source and compilation tools are removed before execution and generated package sources remain installed. ${run.mode === "full" ? "The full fixture checks per-site constructor selection and normalization over all nineteen primitive bases, fixed-width wrapping, signed zero, refused non-finite floats, Unicode scalars, embedded NUL text, binary bytes, repeated record fields, active variant branches, aliases, mixed Fin guards, exact rejection paths, host-level shape and encoding refusals, caller-input preservation and recovery after rejection." : "The standalone result-only fixture has no input constructor selections and checks constructor-free results over all nineteen primitive bases, absent results, host-level shape and encoding refusals and 256 replayed rounds."} Independent controls replay the retained records with coordinated record, execution, tool, resource, environment, package and compiler-model mutations. ${nominalPrimitiveSubtypeWitLimit}`
			, files: [{
				path: nominalPrimitiveSubtypeWitEvidence + "/index.json"
				, sha256: nominalPrimitiveSubtypeWitEvidenceSha256
			}
			, ...files.map(file => ({
				path: nominalPrimitiveSubtypeWitEvidence + "/" + file.path
				, sha256: file.sha256
			}))]
			, artifacts: report.receipt.packages[0].artifacts.map(({ path, sha256: digest }) => ({ path, sha256: digest }))
		});
	}
	return references;
};

let defaultReferences;

/**
 * Stream-check the immutable archive without replaying its controls.
 * The evidence gate separately replays every receipt, record and control.
 *
 * @param read - Reader of immutable repository-relative evidence bytes.
 * @param verifyFiles - Whether to hash every retained file.
 */
const checkPromotionEvidence = async (read, verifyFiles) => {
	const indexPath = nominalPrimitiveSubtypeWitEvidence + "/index.json";
	const bytes = Buffer.from(await read(indexPath));
	assert.equal(sha256(bytes), nominalPrimitiveSubtypeWitEvidenceSha256);
	const index = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "nominal-primitive-subtype-wit-installed-v1");
	assert.equal(index.producerCommit, nominalPrimitiveSubtypeWitProducer);
	assert.equal(index.loadCeiling, nominalPrimitiveSubtypeWitLoadCeiling);
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypeWitSelections);
	if(verifyFiles) for(const file of index.files)
	{
		const value = Buffer.from(await read(nominalPrimitiveSubtypeWitEvidence + "/" + file.path));
		assert.equal(value.length, file.bytes, file.path);
		assert.equal(sha256(value), file.sha256, file.path);
	}
	return {
		producerCommit: index.producerCommit
		, files: index.files
		, selections: index.runs.map(run => ({ route: run.route, mode: run.mode }))
	};
};

/**
 * Authenticate every retained byte before deriving promotion references.
 *
 * @param read - Reader of immutable repository-relative evidence bytes.
 */
export const nominalPrimitiveSubtypeWitReferences = async (read = readFile) => {
	if(read !== readFile) return referencesFromEvidence(await checkPromotionEvidence(read, true), read);
	defaultReferences ??= referencesFromEvidence(await checkPromotionEvidence(readFile, true), readFile);
	return structuredClone(await defaultReferences);
};

// Reject changed reference metadata before streaming the complete archive.
// Every accepted promotion still checks every retained byte above.
const referencePrecheck = async () => {
	const bytes = Buffer.from(await readFile(nominalPrimitiveSubtypeWitEvidence + "/index.json"));
	const index = JSON.parse(bytes);
	const read = async path => {
		if(path === nominalPrimitiveSubtypeWitEvidence + "/index.json") return bytes;
		const entry = index.files.find(file => nominalPrimitiveSubtypeWitEvidence + "/" + file.path === path);
		assert.ok(entry, path); const value = await readFile(path);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		return value;
	};
	return referencesFromEvidence(await checkPromotionEvidence(read, false), read);
};

/**
 * Supplement six proven WIT cells and leave every other profile unchanged.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalPrimitiveSubtypeWit = async (original, references) => {
	assert.deepEqual(references, await referencePrecheck());
	assert.deepEqual(references, await nominalPrimitiveSubtypeWitReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of [
		"tests/helpers/nominal-primitive-subtype-wit-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-wit-evidence.mjs"
		, "tests/helpers/nominal-primitive-subtype-wit-controls.mjs"
		, "tests/helpers/nominal-primitive-subtype-wit-provenance.mjs"
		, "tests/helpers/nominal-primitive-subtype-wit-promotion.mjs"
		, "tests/helpers/nominal-primitive-subtype-wit-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-wit-ci-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-wit-ci-workflow.mjs"
		, "scripts/check-nominal-primitive-subtype-wit-ci.mjs"
		, "scripts/run-nominal-primitive-subtype-wit-ci.sh"
		, ".github/workflows/nominal-primitive-subtype-wit.yml"
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
		const matches = inventory.observations.filter(item => item.path === path
			&& item.shapes.includes("subtype")
			&& item.profiles.some(profile => nominalPrimitiveSubtypeWitProfiles.includes(profile)));
		const mainId = path === "ordinary-source" ? "native-subtype-wit-wasi-ordinary-source" : "reviewed-native-subtype-wit-wasi";
		assert.deepEqual(matches.map(item => [item.id, item.profiles, item.shapes, item.positions]), [
			[mainId, nominalPrimitiveSubtypeWitProfiles, ["subtype"], ["parameter", "result"]]
			, [`nominal-subtype-wit-fields-${path}`, nominalPrimitiveSubtypeWitProfiles, ["subtype"], ["field"]]
		], "Missing or overlapping WIT Subtype observations");
		const matched = references.filter(item => item.sourcePath === path);
		const ids = matched.map(item => item.id); assert.equal(matched.length, 2);
		const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			observation.scope = observation.scope.replaceAll(nominalSubtypeWitLimit, "").trimEnd()
				+ " Additional primitive-base nominal WIT acceptance: " + scope;
			assert.equal(observation.conversionNotes.subtype.split(nominalSubtypeWitConversion).length, 2);
			observation.conversionNotes.subtype = observation.conversionNotes.subtype.replace(nominalSubtypeWitConversion, nominalPrimitiveSubtypeWitConversion);
			assert.equal(observation.limitations.filter(item => item === nominalSubtypeWitLimit).length, 1);
			observation.limitations = observation.limitations.map(item => item === nominalSubtypeWitLimit ? nominalPrimitiveSubtypeWitLimit : item);
			for(const position of observation.positions)
			{
				if(position !== "field") assert.ok(observation.hostTypes.subtype[position].endsWith(nominalSubtypeWitHostSuffix));
				observation.hostTypes.subtype[position] = {
					parameter: nominalPrimitiveSubtypeWitParameter
					, result: nominalPrimitiveSubtypeWitResult
					, field: nominalPrimitiveSubtypeWitField
				}[position];
			}
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note = stage.note.replaceAll(nominalSubtypeWitLimit, "").trimEnd()
					+ " Additional primitive-base nominal WIT acceptance: " + scope;
			}
		}
	}
	return inventory;
};
