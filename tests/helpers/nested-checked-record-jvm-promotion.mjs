/**
 * Promote only nested checked-record positions authenticated by installed JVM runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkedRecordNativeLimit } from "./checked-record-native-promotion.mjs";
import {
	nestedCheckedRecordJvmEvidence
	, nestedCheckedRecordJvmEvidenceSha256
} from "./nested-checked-record-jvm-evidence.mjs";
import {
	nestedCheckedRecordJvmLoadCeiling
	, nestedCheckedRecordJvmProducer
	, nestedCheckedRecordJvmSelections
} from "./nested-checked-record-jvm-provenance.mjs";

export const nestedCheckedRecordJvmProfiles = Object.freeze(["java", "kotlin"]);
export const nestedCheckedRecordJvmConversion = "The tested Packet carries a Fin 10 digit and a checked Nat Subtype word as BigInteger values. Holder nests Packet, and ChoicePacket carries it in the active Choice branch. Generated Java and Kotlin adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, array, list, option, tuple, result, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections.";
export const nestedCheckedRecordJvmLimit = "Checked-record JVM acceptance covers the established top-level Interval, Sized 3 and Bounded 0 101 forms plus the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copied positions. Generic, recursive and inherited records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete Maven packages from two author roots, remove author sources, install offline, replay after relocation and execute again after deleting all consumer sources. The runs use JDK 22.0.2, Kotlin 2.2.0 and Lean 4.32.2 on Linux x64/glibc 2.36 with an explicit 2.36 package floor and 64-bit machine words. Original receipts, retained package members, compiler probes, execution records and selected sources are archived; native libraries and the closed JAR retain exact identities without copied bytes. Constructor entry counts and peak memory are unmeasured. Hosted glibc 2.38 release-floor acceptance remains assigned to the recurring workflow.";
export const nestedCheckedRecordJvmFields = Object.freeze({
	java: "Generated Java Packet record with BigInteger digit and word fields nested inside Holder and ChoicePacket; no proof field"
	, kotlin: "Generated Kotlin Packet class with BigInteger digit and word fields nested inside Holder and ChoicePacket; no proof field"
});

const validators = Object.freeze([
	"tests/helpers/nested-checked-record-jvm-report.mjs"
	, "tests/helpers/nested-checked-record-jvm-evidence.mjs"
	, "tests/helpers/nested-checked-record-jvm-controls.mjs"
	, "tests/helpers/nested-checked-record-jvm-provenance.mjs"
	, "tests/helpers/nested-checked-record-jvm-promotion.mjs"
	, "tests/helpers/nested-checked-record-jvm-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-jvm-ci-report.mjs"
	, "tests/helpers/nested-checked-record-jvm-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-jvm-ci-workflow-tests.mjs"
	, "scripts/check-nested-checked-record-jvm-ci.mjs"
	, "scripts/run-nested-checked-record-jvm-ci.sh"
	, ".github/workflows/nested-checked-record-jvm.yml"
]);
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
const commandFor = start => [...Object.entries(start.environment).map(([key, value]) => {
	assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
	return key + "=" + quote(value);
})
, quote(start.command), ...start.args.map(quote)].join(" ");

/**
 * Stream-check the immutable archive without replaying its mutation controls.
 *
 * @param read - Reader of immutable repository-relative evidence bytes.
 * @param verifyFiles - Whether to hash every retained file.
 */
const checkPromotionEvidence = async (read, verifyFiles) => {
	const bytes = Buffer.from(await read(nestedCheckedRecordJvmEvidence + "/index.json"));
	assert.equal(sha256(bytes), nestedCheckedRecordJvmEvidenceSha256);
	const index = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nested-checked-record-jvm-installed-v1");
	assert.equal(index.producerCommit, nestedCheckedRecordJvmProducer);
	assert.equal(index.loadCeiling, nestedCheckedRecordJvmLoadCeiling);
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nestedCheckedRecordJvmSelections);
	if(verifyFiles) for(const file of index.files)
	{
		const value = Buffer.from(await read(nestedCheckedRecordJvmEvidence + "/" + file.path));
		assert.equal(value.length, file.bytes, file.path); assert.equal(sha256(value), file.sha256, file.path);
	}
	return index;
};

/**
 * Derive four inventory references from authenticated archive metadata.
 *
 * @param index - Validated immutable archive index.
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
const referencesFromEvidence = async (index, read) => {
	const references = [];
	for(const run of index.runs)
	{
		const label = `${run.route}-${run.mode}`;
		const verification = JSON.parse(await read(`${nestedCheckedRecordJvmEvidence}/${label}/producer/verification.json`));
		const controls = JSON.parse(await read(`${nestedCheckedRecordJvmEvidence}/${label}/producer/controls.json`));
		const report = JSON.parse(await read(`${nestedCheckedRecordJvmEvidence}/${label}/records/report.json`));
		const start = JSON.parse(await read(`${nestedCheckedRecordJvmEvidence}/${label}/producer/start.json`));
		assert.equal(verification.producerCommit, index.producerCommit);
		assert.deepEqual(controls.checked, verification); assert.deepEqual(controls.controls, run.controls);
		const sourcePath = run.route === "ordinary" ? "ordinary-source" : "reviewed-ir";
		const files = index.files.filter(file => file.path.startsWith(label + "/")
			|| file.path.startsWith("sources/") || file.path.startsWith("runners/"));
		references.push({
			id: `nested-checked-record-jvm-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode, sourcePath
			, profiles: [...nestedCheckedRecordJvmProfiles]
			, positions: run.mode === "full"
				? ["parameter", "result", "field"] : ["result"]
			, revision: index.producerCommit
			, counts: { ...verification, ...run.controls
				, originalFiles: run.originalFiles, loadCeiling: index.loadCeiling }
			, command: commandFor(start)
			, scope: `Two independent author builds reproduce the complete Maven package. Author sources are removed before offline installation; Java and Kotlin callers replay after moving the installed tree and execute again after deleting all consumer sources, giving six executions per selection. Compiler probes check the generated API, Java and Kotlin Unit classes, Kotlin function references and result nullability. ${run.mode === "full" ? "The full API checks direct and repeated parameters, Array, List, Option, Product, both Except branches, Holder.packet and the active Choice.packet.value field, including exact per-site constructors, normalization, complete rejected-input snapshots and recovery." : "The standalone result-only API projects checked-record payloads through Array and Option results without checked-input metadata."} Independent controls reject every missing or changed retained record and coordinated resource, model, package, probe and execution mutations. ${nestedCheckedRecordJvmLimit}`
			, files: [{ path: nestedCheckedRecordJvmEvidence + "/index.json"
				, sha256: nestedCheckedRecordJvmEvidenceSha256 }
			, ...files.map(file => ({ path: nestedCheckedRecordJvmEvidence + "/" + file.path
				, sha256: file.sha256 }))]
			, artifacts: report.receipt.packages[0].artifacts
				.map(({ path, sha256: digest }) => ({ path, sha256: digest }))
		});
	}
	return references;
};

let defaultReferences;

/**
 * Authenticate every retained byte before deriving promotion references.
 *
 * @param read - Reader of immutable repository-relative evidence bytes.
 */
export const nestedCheckedRecordJvmReferences = async (read = readFile) => {
	if(read !== readFile) return referencesFromEvidence(await checkPromotionEvidence(read, true), read);
	defaultReferences ??= referencesFromEvidence(await checkPromotionEvidence(readFile, true), readFile);
	return structuredClone(await defaultReferences);
};

const referencePrecheck = async () => {
	const bytes = Buffer.from(await readFile(nestedCheckedRecordJvmEvidence + "/index.json"));
	const index = JSON.parse(bytes);
	const read = async path => {
		if(path === nestedCheckedRecordJvmEvidence + "/index.json") return bytes;
		const entry = index.files.find(file => nestedCheckedRecordJvmEvidence + "/" + file.path === path);
		assert.ok(entry, path); const value = await readFile(path);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		return value;
	};
	return referencesFromEvidence(await checkPromotionEvidence(read, false), read);
};

const updateText = (source, addition) => {
	return source.split(checkedRecordNativeLimit).join("").trimEnd() + " " + addition;
};

/**
 * Supplement eight parameter/result cells, add four field cells, and preserve every other claim.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNestedCheckedRecordJvm = async (original, references) => {
	assert.deepEqual(references, await referencePrecheck());
	assert.deepEqual(references, await nestedCheckedRecordJvmReferences());
	const inventory = structuredClone(original), sources = await Promise.all(validators.map(async path => ({
		path, sha256: sha256(await readFile(path))
	})));
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id)
			, "Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...sources, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({
				...item, path: reference.id + "/" + item.path
			}))
		});
	}
	for(const profile of nestedCheckedRecordJvmProfiles)
		for(const path of ["ordinary-source", "reviewed-ir"])
		{
			const full = references.filter(item => item.sourcePath === path
				&& item.mode === "full");
			const result = references.filter(item => item.sourcePath === path
				&& item.positions.includes("result"));
			assert.equal(full.length, 1); assert.equal(result.length, 2);
			for(const position of ["parameter", "result"])
			{
				const matched = position === "result" ? result : full;
				const observations = inventory.observations.filter(item =>
					item.profiles.includes(profile) && item.path === path
					&& item.shapes.includes("checked-record")
					&& item.positions.includes(position));
				assert.equal(observations.length, 1
					, `Missing or overlapping nested JVM checked-record cell: ${profile}/${path}/${position}`);
				const observation = observations[0], ids = matched.map(item => item.id);
				const scope = matched.map(item => item.scope).join(" ");
				assert.ok(observation.scope.includes(checkedRecordNativeLimit));
				observation.scope = updateText(observation.scope
					, "Additional nested JVM acceptance: " + scope);
				observation.conversionNotes["checked-record"] += " "
					+ nestedCheckedRecordJvmConversion;
				assert.deepEqual(observation.limitations, [checkedRecordNativeLimit]);
				observation.limitations = [nestedCheckedRecordJvmLimit];
				for(const stage of Object.values(observation.stages))
				{
					assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
					assert.equal(new Set(stage.evidence).size, stage.evidence.length);
					stage.note = updateText(stage.note
						, "Additional nested JVM acceptance: " + scope);
				}
			}
			const overlap = inventory.observations.filter(item =>
				item.profiles.includes(profile) && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes("field"));
			assert.equal(overlap.length, 0
				, `Overlapping nested JVM checked-record field: ${profile}/${path}`);
			const conversion = inventory.observations.find(item =>
				item.profiles.includes(profile) && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes("parameter"))
				.conversionNotes["checked-record"];
			const scope = full[0].scope, notes = {
				analysis: "Fresh Lean and independently reviewed IR agree on Packet's erased proof, nested Fin 10 and Subtype fields, and every exact constructor choice."
				, generation: "Generated Java and Kotlin adapters recurse through supported copied containers, Holder.packet and the active Choice.packet.value field while retaining proof-free host classes."
				, compilation: "Compiled Lean constructs Fin 10, the Word Subtype and Packet in dependency order at each selected public site."
				, packaging: "Two author roots reproduce complete Maven packages before author removal, offline installation and physical installed-tree relocation."
				, installedExecution: scope
			};
			assert.deepEqual(Object.keys(notes), inventory.stages);
			inventory.observations.push({
				id: `nested-checked-record-jvm-${profile}-${path}-field`
				, profiles: [profile], shapes: ["checked-record"]
				, positions: ["field"], path, scope
				, hostTypes: { "checked-record": {
					field: nestedCheckedRecordJvmFields[profile]
				} }
				, conversionNotes: { "checked-record": conversion }
				, limitations: [nestedCheckedRecordJvmLimit]
				, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
					state: "passed", evidence: [full[0].id], note: notes[stage]
				}]))
			});
		}
	return inventory;
};
