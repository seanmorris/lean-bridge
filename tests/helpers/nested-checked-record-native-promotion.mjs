/**
 * Promote only the nested checked-record positions authenticated by C/C++ packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	nestedCheckedRecordNativeArchiveSha256
} from "./nested-checked-record-native-archive.mjs";
import {
	nestedCheckedRecordNativeEvidence
	, nestedCheckedRecordNativeProducer
	, nestedCheckedRecordNativeSelections
} from "./nested-checked-record-native-evidence.mjs";

export const nestedCheckedRecordNativeProfiles = Object.freeze(["c", "cpp"]);
export const nestedCheckedRecordNativeFields = Object.freeze({
	c: "Nested generated C Packet record with initialized GMP digit and word fields inside Holder and the active Choice branch; no proof fields"
	, cpp: "Nested generated C++ Packet value with cpp_int digit and word fields inside Holder and the active Choice branch; no proof fields"
});
export const nestedCheckedRecordNativeConversion = "The tested Packet carries a Fin 10 digit and a checked Nat Subtype word as ordinary GMP integers in C and cpp_int values in C++. The generated adapter applies the exact constructor selected for Packet and its nested Word field through direct and repeated parameters, Array, List, Option, Product, Except, Holder.packet and the active Choice.packet.value branch. C callers initialize and clear generated records and owning results; C++ callers use Packet values, vectors, optionals, products, results, Holder and Choice. Rejected inputs leave the complete caller graph and existing C output unchanged, and later valid calls recover. Array and Option results contain proof-free Packet payloads without input-constructor selections.";
export const nestedCheckedRecordNativeLimit = "Nested checked-record C/C++ acceptance covers only the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copied positions. Generic, recursive and inherited records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete packages from two roots. Independent C11/GMP and C++20 callers install offline after author removal and replay after physical relocation on Linux x64/glibc 2.36 with an explicit 2.36 package floor. Constructor/source entry counts and peak memory are unmeasured. These local runs do not establish hosted or glibc 2.38 release-floor acceptance.";

const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
const indexPath = `${nestedCheckedRecordNativeEvidence}/index.json`;
const json = bytes => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value));
	return value;
};

const referencesFromEvidence = async (checked, read) => {
	const index = json(await read(indexPath));
	assert.equal(index.producerCommit, checked.producerCommit);
	assert.equal(index.runs.length, checked.runs.length);
	const references = [];
	for(const [position, run] of index.runs.entries())
	{
		const selected = checked.runs[position];
		assert.deepEqual([run.route, run.mode], [selected.route, selected.mode]);
		const label = run.label;
		const report = json(await read(
			`${nestedCheckedRecordNativeEvidence}/${label}/records/report.json`));
		const output = run.originalRoot.slice(0
			, -`/${run.route}/${run.mode}`.length);
		const command = [
			"LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36"
			, "LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_TEST=1"
			, `LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_ROUTES=${quote(run.route)}`
			, `LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_MODES=${quote(run.mode)}`
			, "LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_MAX_LOAD=12"
			, `LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_OUTPUT=${quote(`/app/${output}`)}`
			, "LEAN_NUM_THREADS=1", "OMP_NUM_THREADS=1"
			, "CMAKE_BUILD_PARALLEL_LEVEL=1", "MAKEFLAGS=-j1"
			, "nice -n 10 taskset -c 1,2 node --test --test-concurrency=1"
			, "tests/nested-checked-record-native.test.mjs"
		].join(" ");
		const files = checked.files.filter(file => file.path.startsWith(`${label}/`)
			|| file.path.startsWith("sources/"));
		const full = run.mode === "full";
		const counts = {
			...run.counts, executions: run.executions
			, initialExecutions: run.initialExecutions, controls: run.controls
			, recordCount: run.recordCount, maxLoad: run.maxLoad
			, runtime: run.runtime, floor: run.floor
		};
		references.push({
			id: `nested-checked-record-native-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nestedCheckedRecordNativeProfiles]
			, positions: full ? ["parameter", "result", "field"] : ["result"]
			, revision: checked.producerCommit, counts, command
			, scope: `Two independent author roots reproduce complete C and C++ packages before source-free offline installation. Independent C11/GMP and C++20 callers replay unchanged after physical relocation, giving four replay executions plus two setup executions per selection. ${full ? "The full API checks direct and repeated parameters, Array, List, Option, Product, both Except branches, Holder.packet and the active Choice.packet.value field, including exact per-site constructors, normalization, complete rejected-input snapshots and recovery." : "The standalone result-only API projects checked-record payloads through Array and Option results without checked-input metadata."} Independent controls reject every missing record and coordinated report, resource, model and package mutation. ${nestedCheckedRecordNativeLimit}`
			, files: [{ path: indexPath, sha256: nestedCheckedRecordNativeArchiveSha256 }
				, ...files.map(file => ({ path: `${nestedCheckedRecordNativeEvidence}/${file.path}`
					, sha256: file.sha256 }))]
			, artifacts: report.builds[0].archives
				? Object.entries(report.builds[0].archives).map(([path, digest]) => ({
					path, sha256: digest
				})) : []
		});
	}
	return references;
};

let defaultReferences;

const checkPromotionEvidence = async (read, verifyFiles) => {
	const bytes = Buffer.from(await read(indexPath));
	assert.equal(sha256(bytes), nestedCheckedRecordNativeArchiveSha256);
	const index = json(bytes);
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "nested-checked-record-native-installed-v1");
	assert.equal(index.producerCommit, nestedCheckedRecordNativeProducer);
	assert.deepEqual(index.runs.map(run => [run.route, run.mode])
		, nestedCheckedRecordNativeSelections.map(run => [run.route, run.mode]));
	if(verifyFiles) for(const file of index.files)
	{
		const value = Buffer.from(await read(
			`${nestedCheckedRecordNativeEvidence}/${file.path}`));
		assert.equal(value.length, file.bytes, file.path);
		assert.equal(sha256(value), file.sha256, file.path);
	}
	return { producerCommit: index.producerCommit, files: index.files, runs: index.runs };
};

/**
 * Authenticate every retained byte before deriving four promotion references.
 *
 * @param read - Repository-relative evidence reader.
 */
export const nestedCheckedRecordNativeReferences = async (read = readFile) => {
	if(read !== readFile)
		return referencesFromEvidence(await checkPromotionEvidence(read, true), read);
	defaultReferences ??= referencesFromEvidence(
		await checkPromotionEvidence(readFile, true), readFile);
	return structuredClone(await defaultReferences);
};

const referencePrecheck = async () => {
	const bytes = Buffer.from(await readFile(indexPath));
	const index = json(bytes);
	const read = async path => {
		if(path === indexPath) return bytes;
		const prefix = nestedCheckedRecordNativeEvidence + "/";
		assert.ok(path.startsWith(prefix));
		const entry = index.files.find(file => prefix + file.path === path);
		assert.ok(entry, path);
		const value = await readFile(path);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		return value;
	};
	return referencesFromEvidence(await checkPromotionEvidence(read, false), read);
};

const removeOldBoundary = value => value
	.replace("Other indices, nested/refined/recursive records and dynamic dependent payloads are not covered.", "")
	.trim();

/**
 * Supplement twelve C/C++ cells without changing another host or callback position.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNestedCheckedRecordNative = async (original, references) => {
	assert.deepEqual(references, await referencePrecheck());
	assert.deepEqual(references, await nestedCheckedRecordNativeReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of [
		"tests/helpers/nested-checked-record-native-report.mjs"
		, "tests/helpers/nested-checked-record-native-controls.mjs"
		, "tests/helpers/nested-checked-record-native-archive.mjs"
		, "tests/helpers/nested-checked-record-native-archive-tests.mjs"
		, "tests/helpers/nested-checked-record-native-promotion.mjs"
		, "tests/helpers/nested-checked-record-native-promotion-tests.mjs"
		, "tests/helpers/nested-checked-record-native-ci-report.mjs"
		, "tests/helpers/nested-checked-record-native-ci-policy-tests.mjs"
		, "tests/helpers/nested-checked-record-native-ci-shell-tests.mjs"
		, "tests/helpers/nested-checked-record-native-ci-workflow.mjs"
		, "tests/helpers/nested-checked-record-native-ci-workflow-tests.mjs"
		, "scripts/check-nested-checked-record-native-ci.mjs"
		, "scripts/run-nested-checked-record-native-ci.sh"
		, ".github/workflows/nested-checked-record-native.yml"
	]) validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id)
			, "Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({
				...item, path: reference.id + "/" + item.path
			}))
		});
	}
	for(const profile of nestedCheckedRecordNativeProfiles)
		for(const path of ["ordinary-source", "reviewed-ir"])
		{
			const full = references.filter(item => item.sourcePath === path
				&& item.mode === "full");
			const result = references.filter(item => item.sourcePath === path
				&& item.positions.includes("result"));
			assert.equal(full.length, 1); assert.equal(result.length, 2);
			for(const position of ["parameter", "result"])
			{
				const observations = inventory.observations.filter(item =>
					item.profiles.includes(profile) && item.path === path
					&& item.shapes.includes("checked-record")
					&& item.positions.includes(position));
				assert.equal(observations.length, 1
					, `Missing or overlapping native checked-record cell: ${profile}/${path}/${position}`);
				const observation = observations[0];
				const matched = position === "result" ? result : full;
				const ids = matched.map(item => item.id);
				observation.scope += " Additional nested C/C++ acceptance: "
					+ matched.map(item => item.scope).join(" ");
				observation.conversionNotes["checked-record"]
					= removeOldBoundary(observation.conversionNotes["checked-record"])
					+ " " + nestedCheckedRecordNativeConversion;
				observation.limitations = [nestedCheckedRecordNativeLimit];
				for(const stage of Object.values(observation.stages))
				{
					assert.equal(stage.state, "passed");
					stage.evidence.push(...ids);
					assert.equal(new Set(stage.evidence).size, stage.evidence.length);
					stage.note += " Additional nested C/C++ acceptance: "
						+ matched.map(item => item.scope).join(" ");
				}
			}
			const overlap = inventory.observations.filter(item =>
				item.profiles.includes(profile) && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes("field"));
			assert.equal(overlap.length, 0
				, `Overlapping native checked-record field: ${profile}/${path}`);
			const conversion = inventory.observations.find(item =>
				item.profiles.includes(profile) && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes("parameter"))
				.conversionNotes["checked-record"];
			const scope = full[0].scope;
			const notes = {
				analysis: "Fresh Lean and independently reviewed IR agree on Packet's erased proof, nested Fin 10 and Subtype fields, and every exact constructor choice."
				, generation: "Generated C and C++ adapters recurse through supported copied containers, Holder.packet and the active Choice.packet.value field while retaining proof-free public records."
				, compilation: "Compiled Lean constructs Fin 10, the Word Subtype and Packet in dependency order at each selected public site."
				, packaging: "Two author roots reproduce complete C and C++ packages before source removal, offline installation and physical installed-tree relocation."
				, installedExecution: scope
			};
			assert.deepEqual(Object.keys(notes), inventory.stages);
			inventory.observations.push({
				id: `nested-checked-record-native-${profile}-${path}-field`
				, profiles: [profile], shapes: ["checked-record"]
				, positions: ["field"], path, scope
				, hostTypes: { "checked-record": {
					field: nestedCheckedRecordNativeFields[profile]
				} }
				, conversionNotes: {
					"checked-record": conversion
				}
				, limitations: [nestedCheckedRecordNativeLimit]
				, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
					state: "passed", evidence: [full[0].id], note: notes[stage]
				}]))
			});
		}
	return inventory;
};
