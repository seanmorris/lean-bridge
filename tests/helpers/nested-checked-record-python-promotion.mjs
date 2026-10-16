/**
 * Promote only nested checked-record positions authenticated by Python wheels.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordNativeConversion
	, checkedRecordNativeLimit
} from "./checked-record-native-promotion.mjs";
import {
	checkNestedCheckedRecordPythonEvidence
	, nestedCheckedRecordPythonEvidence
	, nestedCheckedRecordPythonEvidenceSha256
} from "./nested-checked-record-python-evidence.mjs";
import {
	nestedCheckedRecordPythonProducer
	, nestedCheckedRecordPythonSelections
} from "./nested-checked-record-python-provenance.mjs";

export const nestedCheckedRecordPythonProfiles = Object.freeze(["python"]);
export const nestedCheckedRecordPythonConversion = "The tested frozen Packet dataclass carries a Fin 10 digit and a checked Nat Subtype word as exact Python int values. Holder nests Packet, and ChoicePacket carries it in the active Choice branch. Generated Python adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, Array, List, Option, Product, Except, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections.";
export const nestedCheckedRecordPythonLimit = "Checked-record Python acceptance covers the established top-level Interval, Sized 3 and Bounded 0 101 forms plus the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copied positions. Generic, recursive and inherited checked records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete wheels from two author roots, remove author roots, install offline on CPython 3.11.16 and 3.12.14, and replay the unchanged caller after physically relocating each installation. The same wheel spans both interpreter floors. The runs use Linux x64/glibc 2.36 with an explicit 2.36 package floor, 64-bit machine words and a recorded 20.0 host-load admission ceiling. The archive retains complete wheels, extracted packages, receipts, installation inventories, execution records and both producer and verifier source closures. Hosted glibc 2.38 release-floor acceptance remains assigned to the dedicated workflow. Constructor dispatch and peak memory are unmeasured.";
export const nestedCheckedRecordPythonField = "Generated frozen Python Packet dataclass with int digit and word fields nested inside Holder and ChoicePacket; no proof field";

const validators = Object.freeze([
	"tests/helpers/nested-checked-record-python-report.mjs"
	, "tests/helpers/nested-checked-record-python-controls.mjs"
	, "tests/helpers/nested-checked-record-python-evidence.mjs"
	, "tests/helpers/nested-checked-record-python-evidence-tests.mjs"
	, "tests/helpers/nested-checked-record-python-provenance.mjs"
	, "tests/helpers/nested-checked-record-python-promotion.mjs"
	, "tests/helpers/nested-checked-record-python-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-python-promotion-history.mjs"
	, "tests/helpers/nested-checked-record-python-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-python-ci-report.mjs"
	, "tests/helpers/nested-checked-record-python-ci-policy-tests.mjs"
	, "tests/helpers/nested-checked-record-python-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-python-ci-workflow-tests.mjs"
	, "tests/helpers/nested-checked-record-python-ci-shell-tests.mjs"
	, "tests/helpers/nested-checked-record-python-resources.mjs"
	, "scripts/archive-nested-checked-record-python-evidence.mjs"
	, "scripts/check-nested-checked-record-python-ci.mjs"
	, "scripts/run-nested-checked-record-python-ci.sh"
	, "scripts/update-nested-checked-record-python-promotion-history.mjs"
	, ".github/workflows/nested-checked-record-python.yml"
]);

const command = () => {
	const environment = {
		CMAKE_BUILD_PARALLEL_LEVEL: "1"
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_MAX_LOAD: "20"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_MODES: "full,result-only"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_OUTPUT:
			"build/vo1509-nested-record-python-c9ae661/records"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_ROUTES: "ordinary,reviewed"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_TEST: "1"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHONS:
			'{"3.11":"/app/.toolchains/python311/bin/python3.11","3.12":"/app/.toolchains/python312/bin/python3.12"}'
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1"
		, MAKEFLAGS: "-j1"
	};
	const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
	return "source 'scripts/env.sh' && "
		+ [...Object.entries(environment).map(([key, value]) =>
			`${key}=${quote(value)}`)
		, "node", "--test", "--test-concurrency=1", "--test-reporter=tap"
		, "tests/helpers/nested-checked-record-python-installed-tests.mjs"
		].map((value, index) => index < Object.keys(environment).length
			? value : quote(value)).join(" ");
};

const readJson = async (read, path) => {
	const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};

/**
 * Authenticate every retained byte before deriving four promotion references.
 *
 * @param read - Reader of immutable repository-relative evidence bytes.
 */
export const nestedCheckedRecordPythonReferences = async (read = readFile) => {
	const checked = await checkNestedCheckedRecordPythonEvidence(read, {
		controls: "none"
	});
	const indexPath = `${nestedCheckedRecordPythonEvidence}/index.json`;
	const index = await readJson(read, indexPath);
	assert.equal(index.producerCommit, checked.producerCommit);
	assert.equal(index.producerCommit, nestedCheckedRecordPythonProducer);
	assert.deepEqual(index.runs.map(item => [item.route, item.mode])
		, nestedCheckedRecordPythonSelections);
	return Promise.all(index.runs.map(async (run, position) => {
		const verified = checked.selections[position], label = run.label;
		assert.equal(verified.route, run.route); assert.equal(verified.mode, run.mode);
		const wheel = await readJson(read
			, `${nestedCheckedRecordPythonEvidence}/${label}/records/wheel.json`);
		const full = run.mode === "full";
		const paths = index.files.filter(file => file.path.startsWith(label + "/")
			|| file.path.startsWith("sources/") || file.path.startsWith("producer/"));
		return {
			id: `nested-checked-record-python-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nestedCheckedRecordPythonProfiles]
			, positions: full ? ["parameter", "result", "field"] : ["result"]
			, revision: index.producerCommit
			, counts: {
				...verified.counts, executions: verified.executions
				, records: run.records, loadCeiling: run.loadCeiling
			}
			, command: command()
			, scope: `Two independent author builds reproduce one complete wheel for both CPython floors. Author roots are removed before offline installation; the unchanged caller runs on CPython 3.11 and 3.12 before and after moving each complete installed tree, giving four executions per selection. ${full ? "The full API checks direct and repeated parameters, Array, List, Option, Product, both Except branches, Holder.packet and the active ChoicePacket.value field, including exact per-site constructors, normalization, complete rejected-input snapshots and recovery." : "The standalone result-only API projects checked-record payloads through Array and Option results without checked-input metadata."} ${nestedCheckedRecordPythonLimit}`
			, files: [
				{ path: indexPath, sha256: nestedCheckedRecordPythonEvidenceSha256 }
				, ...paths.map(file => ({
					path: `${nestedCheckedRecordPythonEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: [{ path: wheel.archive.path, sha256: wheel.archive.sha256 }]
		};
	}));
};

const updateText = (source, addition) => source.split(checkedRecordNativeLimit)
	.join("").trimEnd() + " " + addition;

/**
 * Supplement four parameter/result cells, add two fields, and preserve all else.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNestedCheckedRecordPython = async (original, references) => {
	assert.deepEqual(references, await nestedCheckedRecordPythonReferences());
	const inventory = structuredClone(original);
	for(const reference of references)
		assert.ok(!inventory.evidence.some(item => item.id === reference.id)
			, "Already promoted: " + reference.id);
	const sources = await Promise.all(validators.map(async path => ({
		path, sha256: sha256(await readFile(path))
	})));
	for(const reference of references)
	{
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...sources, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({
				...item, path: reference.id + "/" + item.path
			}))
		});
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const full = references.filter(item => item.sourcePath === path
			&& item.mode === "full");
		const results = references.filter(item => item.sourcePath === path
			&& item.positions.includes("result"));
		assert.equal(full.length, 1); assert.equal(results.length, 2);
		for(const position of ["parameter", "result"])
		{
			const matched = position === "result" ? results : full;
			const observations = inventory.observations.filter(item =>
				item.profiles.includes("python") && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes(position));
			assert.equal(observations.length, 1
				, `Missing or overlapping nested Python cell: ${path}/${position}`);
			const observation = observations[0], ids = matched.map(item => item.id);
			const scope = matched.map(item => item.scope).join(" ");
			assert.ok(observation.scope.includes(checkedRecordNativeLimit));
			observation.scope = updateText(observation.scope
				, "Additional nested Python acceptance: " + scope);
			assert.equal(observation.conversionNotes["checked-record"]
				, checkedRecordNativeConversion);
			observation.conversionNotes["checked-record"] += " "
				+ nestedCheckedRecordPythonConversion;
			assert.deepEqual(observation.limitations, [checkedRecordNativeLimit]);
			observation.limitations = [nestedCheckedRecordPythonLimit];
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				assert.equal(new Set(stage.evidence).size, stage.evidence.length);
				stage.note = updateText(stage.note
					, "Additional nested Python acceptance: " + scope);
			}
		}
		const overlap = inventory.observations.filter(item =>
			item.profiles.includes("python") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("field"));
		assert.equal(overlap.length, 0
			, `Overlapping nested Python checked-record field: ${path}`);
		const conversion = inventory.observations.find(item =>
			item.profiles.includes("python") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("parameter"))
			.conversionNotes["checked-record"];
		const scope = full[0].scope, notes = {
			analysis: "Fresh Lean and independently reviewed IR agree on Packet's erased proof, nested Fin 10 and Subtype fields, and every exact constructor choice."
			, generation: "Generated Python adapters recurse through supported copied containers, Holder.packet and active ChoicePacket.value while retaining proof-free frozen dataclasses."
			, compilation: "Compiled Lean constructs Fin 10, the Word Subtype and Packet in dependency order at each selected public site."
			, packaging: "Two author roots reproduce one complete wheel for both CPython floors before author removal, offline installation and physical installed-tree relocation."
			, installedExecution: scope
		};
		assert.deepEqual(Object.keys(notes), inventory.stages);
		inventory.observations.push({
			id: `nested-checked-record-python-${path}-field`
			, profiles: ["python"], shapes: ["checked-record"]
			, positions: ["field"], path, scope
			, hostTypes: { "checked-record": { field: nestedCheckedRecordPythonField } }
			, conversionNotes: { "checked-record": conversion }
			, limitations: [nestedCheckedRecordPythonLimit]
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
				state: "passed", evidence: [full[0].id], note: notes[stage]
			}]))
		});
	}
	return inventory;
};
