/**
 * Expand only Java and Kotlin positions established by nineteen-base Maven runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	nominalPrimitiveSubtypeJvmEvidence
	, nominalPrimitiveSubtypeJvmEvidenceSha256
} from "./nominal-primitive-subtype-jvm-evidence.mjs";
import {
	nominalPrimitiveSubtypeJvmLoadCeiling
	, nominalPrimitiveSubtypeJvmProducer
	, nominalPrimitiveSubtypeJvmSelections
} from "./nominal-primitive-subtype-jvm-provenance.mjs";
import { nominalSubtypeJvmConversion, nominalSubtypeJvmLimit } from "./nominal-subtype-jvm-promotion.mjs";

export const nominalPrimitiveSubtypeJvmProfiles = ["java", "kotlin"];
export const nominalPrimitiveSubtypeJvmField = "corresponding Java or Kotlin primitive value in generated records and sealed variant cases across all nineteen tested bases; no proof field";
export const nominalPrimitiveSubtypeJvmConversion = "In Java and Kotlin, checked nominal fields preserve all nineteen tested primitive representations with 64-bit machine words: the generated Unit singleton, boolean, int for UInt8 and UInt16, long for UInt32, BigInteger for UInt64, Nat, Int and USize, byte, short, int and long for the signed fixed-width integers, long for ISize, float and double including signed zero, String, byte[] for ByteArray and int Unicode scalars for Char. Generated records and sealed variant cases carry the payloads without proof fields; the Lean Pair record is renamed PacketPair to avoid the generated tuple class. Host conversions reject out-of-range unsigned values, negative Nat values, surrogate characters, invalid UTF-16 text and null payloads before Lean runs. Each input site keeps its selected checked constructor, including distinct normalizing choices for the same record. Copied results project existing Lean values without selecting or running an input constructor.";
export const nominalPrimitiveSubtypeJvmLimit = "Primitive-base nominal JVM acceptance covers the tested acyclic records, variants, aliases, nested Pair/Array/Option/Except values, mixed Fin guards and constructor-free results over Unit, Bool, UInt8, UInt16, UInt32, UInt64, Int8, Int16, Int32, Int64, Nat, Int, Float32, Float, String, ByteArray, Char, USize and ISize with JDK 22.0.2 and Kotlin 2.2.0 through offline Maven-package installation on Linux x64/glibc 2.36 with an explicit 2.36 package floor and 64-bit machine words. Java and Kotlin consumers run after relocation and again after removal of all consumer sources. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain pending. Constructor/source entry counts and memory are unmeasured; local runs do not establish hosted 2.38 release-floor acceptance.";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Derive four inventory references from validated evidence or its digest precheck.
 *
 * @param checked - Validated archive descriptor.
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
const referencesFromEvidence = async (checked, read) => {
	const index = JSON.parse(await read(`${nominalPrimitiveSubtypeJvmEvidence}/index.json`));
	assert.equal(index.producerCommit, checked.producerCommit);
	assert.equal(index.runs.length, checked.selections.length);
	const references = [];
	for(const [position, selection] of checked.selections.entries())
	{
		const run = index.runs[position], label = `${run.route}-${run.mode}`;
		assert.equal(selection.route, run.route); assert.equal(selection.mode, run.mode);
		const controls = JSON.parse(await read(`${nominalPrimitiveSubtypeJvmEvidence}/${label}/controls/controls.json`));
		const report = JSON.parse(await read(`${nominalPrimitiveSubtypeJvmEvidence}/${label}/records/report.json`));
		const start = JSON.parse(await read(`${nominalPrimitiveSubtypeJvmEvidence}/${label}/producer/start.json`));
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const files = checked.files.filter(file => file.path.startsWith(label + "/")
			|| file.path.startsWith("sources/") || file.path.startsWith("checkers/") || file.path.startsWith("runners/"));
		const { controls: controlCounts, tools, ...counts } = controls.checked;
		references.push({
			id: `nominal-primitive-subtype-jvm-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalPrimitiveSubtypeJvmProfiles]
			, revision: checked.producerCommit
			, counts: { ...counts, ...controlCounts, attempt: run.attempt, loadCeiling: run.loadCeiling, tools: { java: tools.java.version, javac: tools.javac.version, kotlinc: tools.kotlinc.version } }
			, command
			, scope: `Two independent author roots reproduce the complete Maven package. Offline installation follows author removal; Java and Kotlin callers run after moving the installed tree and again from a source-free deployment, giving six executions per selection, and compile-time API and Kotlin nullability probes check the generated surface. ${run.mode === "full" ? "The full fixture checks per-site constructor selection and normalization over all nineteen primitive bases, fixed-width wrapping, signed zero, refused non-finite floats, Unicode scalars, binary bytes, active variant branches, aliases, mixed Fin guards, exact rejection paths, host conversion refusals, caller-input preservation and recovery after rejection." : "The standalone result-only fixture has no input constructor selections and checks constructor-free results over all nineteen primitive bases, absent results, host conversion refusals and 256 replayed rounds."} Independent controls replay the retained records with coordinated record, execution, probe, package, compiler-model and resource mutations. ${nominalPrimitiveSubtypeJvmLimit}`
			, files: [{ path: nominalPrimitiveSubtypeJvmEvidence + "/index.json", sha256: nominalPrimitiveSubtypeJvmEvidenceSha256 }
				, ...files.map(file => ({ path: nominalPrimitiveSubtypeJvmEvidence + "/" + file.path, sha256: file.sha256 }))]
			, artifacts: report.receipt.packages[0].artifacts.map(({ path, sha256: digest }) => ({ path, sha256: digest }))
		});
	}
	return references;
};

let defaultReferences;

/**
 * Stream-check the immutable archive without replaying its controls.
 *
 * @param read - Reader of immutable repository-relative evidence bytes.
 * @param verifyFiles - Whether to hash every retained file.
 */
const checkPromotionEvidence = async (read, verifyFiles) => {
	const bytes = Buffer.from(await read(nominalPrimitiveSubtypeJvmEvidence + "/index.json"));
	assert.equal(sha256(bytes), nominalPrimitiveSubtypeJvmEvidenceSha256);
	const index = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-primitive-subtype-jvm-installed-v1");
	assert.equal(index.producerCommit, nominalPrimitiveSubtypeJvmProducer);
	assert.equal(index.loadCeiling, nominalPrimitiveSubtypeJvmLoadCeiling);
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypeJvmSelections);
	if(verifyFiles) for(const file of index.files)
	{
		const value = Buffer.from(await read(nominalPrimitiveSubtypeJvmEvidence + "/" + file.path));
		assert.equal(value.length, file.bytes, file.path); assert.equal(sha256(value), file.sha256, file.path);
	}
	return { producerCommit: index.producerCommit, files: index.files, selections: index.runs.map(run => ({ route: run.route, mode: run.mode })) };
};

/**
 * Authenticate every retained byte before deriving promotion references.
 *
 * @param read - Reader of immutable repository-relative evidence bytes.
 */
export const nominalPrimitiveSubtypeJvmReferences = async (read = readFile) => {
	if(read !== readFile) return referencesFromEvidence(await checkPromotionEvidence(read, true), read);
	defaultReferences ??= referencesFromEvidence(await checkPromotionEvidence(readFile, true), readFile);
	return structuredClone(await defaultReferences);
};

// Reject changed reference metadata before streaming the complete archive.
const referencePrecheck = async () => {
	const bytes = Buffer.from(await readFile(nominalPrimitiveSubtypeJvmEvidence + "/index.json"));
	const index = JSON.parse(bytes);
	const read = async path => {
		if(path === nominalPrimitiveSubtypeJvmEvidence + "/index.json") return bytes;
		const entry = index.files.find(file => nominalPrimitiveSubtypeJvmEvidence + "/" + file.path === path);
		assert.ok(entry, path); const value = await readFile(path);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		return value;
	};
	return referencesFromEvidence(await checkPromotionEvidence(read, false), read);
};

/**
 * Supplement the twelve proven Java and Kotlin cells and leave every other profile unchanged.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalPrimitiveSubtypeJvm = async (original, references) => {
	assert.deepEqual(references, await referencePrecheck());
	assert.deepEqual(references, await nominalPrimitiveSubtypeJvmReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of [
		"tests/helpers/nominal-primitive-subtype-jvm-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-jvm-evidence.mjs"
		, "tests/helpers/nominal-primitive-subtype-jvm-controls.mjs"
		, "tests/helpers/nominal-primitive-subtype-jvm-provenance.mjs"
		, "tests/helpers/nominal-primitive-subtype-jvm-promotion.mjs"
		, "tests/helpers/nominal-primitive-subtype-jvm-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-jvm-ci-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-jvm-ci-workflow.mjs"
		, "scripts/check-nominal-primitive-subtype-jvm-ci.mjs"
		, "scripts/run-nominal-primitive-subtype-jvm-ci.sh"
		, ".github/workflows/nominal-primitive-subtype-jvm.yml"
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
			&& item.profiles.some(profile => nominalPrimitiveSubtypeJvmProfiles.includes(profile)));
		const expected = path === "ordinary-source"
			? [["native-subtype-java-kotlin-ordinary-source", ["java", "kotlin"], ["parameter", "result"]]]
			: [["reviewed-native-subtype-java", ["java"], ["parameter", "result"]], ["reviewed-native-subtype-kotlin", ["kotlin"], ["parameter", "result"]]];
		expected.push([`nominal-subtype-jvm-fields-${path}`, ["java", "kotlin"], ["field"]]);
		assert.deepEqual(matches.map(item => [item.id, item.profiles, item.positions]), expected, "Missing or overlapping JVM Subtype observations");
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2); const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			observation.scope = observation.scope.replaceAll(nominalSubtypeJvmLimit, "").trimEnd() + " Additional primitive-base nominal JVM acceptance: " + scope;
			assert.equal(observation.conversionNotes.subtype.split(nominalSubtypeJvmConversion).length, 2);
			observation.conversionNotes.subtype = observation.conversionNotes.subtype.replace(nominalSubtypeJvmConversion, nominalPrimitiveSubtypeJvmConversion);
			assert.equal(observation.limitations.filter(item => item === nominalSubtypeJvmLimit).length, 1);
			observation.limitations = observation.limitations.map(item => item === nominalSubtypeJvmLimit ? nominalPrimitiveSubtypeJvmLimit : item);
			if(observation.positions.includes("field")) observation.hostTypes.subtype.field = nominalPrimitiveSubtypeJvmField;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note = stage.note.replaceAll(nominalSubtypeJvmLimit, "").trimEnd() + " Additional primitive-base nominal JVM acceptance: " + scope;
			}
		}
	}
	return inventory;
};
