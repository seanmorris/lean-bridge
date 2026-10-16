/**
 * Promote only nested checked-record positions authenticated by WIT/WASI components.
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
	checkNestedCheckedRecordWitEvidence
	, nestedCheckedRecordWitEvidence
	, nestedCheckedRecordWitEvidenceSha256
} from "./nested-checked-record-wit-evidence.mjs";
import {
	nestedCheckedRecordWitProducer
	, nestedCheckedRecordWitSelections
} from "./nested-checked-record-wit-provenance.mjs";

export const nestedCheckedRecordWitProfiles = Object.freeze(["wit-wasi"]);
export const nestedCheckedRecordWitConversion = "The tested Component Model Packet is a WIT record whose Fin 10 digit and checked Nat Subtype word are canonical list<u32> limbs. A Holder record nests Packet, and the packet case of Choice carries it in its active branch. Generated WIT adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, Array, List, Option, Product, Except, Holder and Choice input site. Rejected calls preserve the complete caller value tree and output sentinel, and later valid calls recover. Packet arrays and options returned by Lean contain proof-free WIT records without input-constructor selections.";
export const nestedCheckedRecordWitLimit = "Checked-record WIT/WASI acceptance covers the established top-level Interval, Sized 3 and Bounded 0 101 forms plus the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copied positions. Generic, recursive and inherited checked records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete WIT component archives from two author roots, remove author roots, install offline, compile one unchanged public C caller, remove its source, and execute it before and after physically relocating each installation. The compiler-free runs use Wasmtime 42.0.1 and wasm-tools 1.245.1 on Linux x64/glibc 2.36 with an explicit 2.36 package floor, 64-bit native machine words and a recorded 20.0 host-load admission ceiling. The component requires its packaged native Lean host and is not a standalone WASI command. The archive retains complete handoff archives, extracted package records, receipts, installed inventories, execution records and both producer and verifier source closures. GCC, wasm-tools and Wasmtime remain trusted toolchain inputs. Hosted glibc 2.38 release-floor acceptance remains assigned to the dedicated workflow. Constructor dispatch and peak memory are unmeasured.";
export const nestedCheckedRecordWitField = "WIT record with list<u32> digit and word fields nested inside a Holder record and the packet case of a Choice variant; no proof field";

const validators = Object.freeze([
	"tests/helpers/nested-checked-record-wit-report.mjs"
	, "tests/helpers/nested-checked-record-wit-controls.mjs"
	, "tests/helpers/nested-checked-record-wit-evidence.mjs"
	, "tests/helpers/nested-checked-record-wit-evidence-tests.mjs"
	, "tests/helpers/nested-checked-record-wit-provenance.mjs"
	, "tests/helpers/nested-checked-record-wit-promotion.mjs"
	, "tests/helpers/nested-checked-record-wit-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-wit-promotion-history.mjs"
	, "tests/helpers/nested-checked-record-wit-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-wit-ci-report.mjs"
	, "tests/helpers/nested-checked-record-wit-ci-report-tests.mjs"
	, "tests/helpers/nested-checked-record-wit-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nested-checked-record-wit-ci-shell-tests.mjs"
	, "tests/helpers/nested-checked-record-wit-ci-handoff-tests.mjs"
	, "tests/helpers/nested-checked-record-wit-resources.mjs"
	, "scripts/archive-nested-checked-record-wit-evidence.mjs"
	, "scripts/check-nested-checked-record-wit-ci.mjs"
	, "scripts/run-nested-checked-record-wit-ci.sh"
	, "scripts/update-nested-checked-record-wit-promotion-history.mjs"
	, ".github/workflows/nested-checked-record-wit.yml"
]);

const command = () => {
	const environment = {
		CC: "/usr/bin/cc"
		, CMAKE_BUILD_PARALLEL_LEVEL: "1"
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_WIT_MAX_LOAD: "20"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_WIT_MODES: "full,result-only"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_WIT_OUTPUT:
			"/app/build/vo1511-nested-record-wit-b8ed8f9/records"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_WIT_ROUTES: "ordinary,reviewed"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_WIT_TEST: "1"
		, LEAN_BRIDGE_WASM_TOOLS:
			"/app/.toolchains/wasm-tools/bin/wasm-tools"
		, LEAN_BRIDGE_WASMTIME_C_API: "/app/.toolchains/wasmtime42"
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
	};
	const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
	return [...Object.entries(environment).map(([key, value]) =>
		`${key}=${quote(value)}`)
	, "taskset", "-c", "3", "nice", "-n", "19", "ionice", "-c", "3"
	, "node", "--max-old-space-size=3072", "--test"
	, "--test-concurrency=1", "--test-reporter=tap"
	, "tests/helpers/nested-checked-record-wit-installed-tests.mjs"
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
export const nestedCheckedRecordWitReferences = async (read = readFile) => {
	const checked = await checkNestedCheckedRecordWitEvidence(read, {
		controls: "none"
	});
	const indexPath = `${nestedCheckedRecordWitEvidence}/index.json`;
	const index = await readJson(read, indexPath);
	assert.equal(index.producerCommit, checked.producerCommit);
	assert.equal(index.producerCommit, nestedCheckedRecordWitProducer);
	assert.deepEqual(index.runs.map(item => [item.route, item.mode])
		, nestedCheckedRecordWitSelections);
	return Promise.all(index.runs.map(async (run, position) => {
		const verified = checked.selections[position], label = run.label;
		assert.equal(verified.route, run.route);
		assert.equal(verified.mode, run.mode);
		const receipt = await readJson(read, `${nestedCheckedRecordWitEvidence}`
			+ `/${label}/records/handoff/package-set-receipt.json`);
		assert.deepEqual(receipt.packages.map(item => [item.target, item.role])
			, [["wit-wasi", "component"]]);
		assert.equal(receipt.packages[0].artifacts.length, 1);
		const artifact = receipt.packages[0].artifacts[0];
		const full = run.mode === "full";
		const paths = index.files.filter(file => file.path.startsWith(label + "/")
			|| file.path.startsWith("sources/")
			|| file.path.startsWith("producer/"));
		return {
			id: `nested-checked-record-wit-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary"
				? "ordinary-source" : "reviewed-ir"
			, profiles: [...nestedCheckedRecordWitProfiles]
			, positions: full ? ["parameter", "result", "field"] : ["result"]
			, revision: index.producerCommit
			, counts: {
				...verified.counts, executions: verified.executions
				, records: run.records, loadCeiling: run.loadCeiling
			}
			, command: command()
			, scope: `Two independent author builds reproduce the complete WIT component handoff. Author roots are removed before offline installation; the unchanged public C caller is compiled once, its source is removed, and the resulting executable runs before and after moving the complete installed tree, giving two executions per selection. ${full ? "The full API checks direct and repeated parameters, Array, List, Option, Product, both Except branches, Holder.packet and the active Choice packet value field, including exact per-site constructors, normalization, complete rejected-input snapshots and recovery." : "The standalone result-only API projects checked-record payloads through Array and Option results without checked-input metadata."} ${nestedCheckedRecordWitLimit}`
			, files: [
				{ path: indexPath, sha256: nestedCheckedRecordWitEvidenceSha256 }
				, ...paths.map(file => ({
					path: `${nestedCheckedRecordWitEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: [{
				path: artifact.path, sha256: artifact.sha256
			}]
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
export const promoteNestedCheckedRecordWit = async (original, references) => {
	assert.deepEqual(references, await nestedCheckedRecordWitReferences());
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
				item.profiles.includes("wit-wasi") && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes(position));
			assert.equal(observations.length, 1
				, `Missing or overlapping nested WIT cell: ${path}/${position}`);
			const observation = observations[0];
			const ids = matched.map(item => item.id);
			const scope = matched.map(item => item.scope).join(" ");
			assert.ok(observation.scope.includes(checkedRecordNativeLimit));
			observation.scope = updateText(observation.scope
				, "Additional nested WIT acceptance: " + scope);
			assert.equal(observation.conversionNotes["checked-record"]
				, checkedRecordNativeConversion);
			observation.conversionNotes["checked-record"] += " "
				+ nestedCheckedRecordWitConversion;
			assert.deepEqual(observation.limitations, [checkedRecordNativeLimit]);
			observation.limitations = [nestedCheckedRecordWitLimit];
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				assert.equal(new Set(stage.evidence).size, stage.evidence.length);
				stage.note = updateText(stage.note
					, "Additional nested WIT acceptance: " + scope);
			}
		}
		const overlap = inventory.observations.filter(item =>
			item.profiles.includes("wit-wasi") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("field"));
		assert.equal(overlap.length, 0
			, `Overlapping nested WIT checked-record field: ${path}`);
		const conversion = inventory.observations.find(item =>
			item.profiles.includes("wit-wasi") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("parameter"))
			.conversionNotes["checked-record"];
		const scope = full[0].scope, notes = {
			analysis: "Fresh Lean and independently reviewed IR agree on Packet's erased proof, nested Fin 10 and Subtype fields, and every exact constructor choice."
			, generation: "Generated WIT adapters recurse through supported copied containers, Holder.packet and the active Choice packet value while retaining proof-free Component Model records and variants."
			, compilation: "Compiled Lean constructs Fin 10, the Word Subtype and Packet in dependency order at each selected public site."
			, packaging: "Two author roots reproduce complete WIT component archives before author removal, offline installation, one public-caller compilation, caller-source removal and physical installed-tree relocation."
			, installedExecution: scope
		};
		assert.deepEqual(Object.keys(notes), inventory.stages);
		inventory.observations.push({
			id: `nested-checked-record-wit-${path}-field`
			, profiles: ["wit-wasi"], shapes: ["checked-record"]
			, positions: ["field"], path, scope
			, hostTypes: { "checked-record": { field: nestedCheckedRecordWitField } }
			, conversionNotes: { "checked-record": conversion }
			, limitations: [nestedCheckedRecordWitLimit]
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
				state: "passed", evidence: [full[0].id], note: notes[stage]
			}]))
		});
	}
	return inventory;
};
