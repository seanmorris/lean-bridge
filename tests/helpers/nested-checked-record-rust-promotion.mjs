/**
 * Promote only nested checked-record positions authenticated by Rust crates.
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
	checkNestedCheckedRecordRustEvidence
	, nestedCheckedRecordRustEvidence
	, nestedCheckedRecordRustEvidenceSha256
} from "./nested-checked-record-rust-evidence.mjs";
import {
	nestedCheckedRecordRustProducer
	, nestedCheckedRecordRustSelections
} from "./nested-checked-record-rust-provenance.mjs";

export const nestedCheckedRecordRustProfiles = Object.freeze(["rust"]);
export const nestedCheckedRecordRustConversion = "The tested Rust Packet carries a Fin 10 digit and a checked Nat Subtype word as num_bigint::BigUint values. Holder nests Packet, and Choice::Packet carries it in the active Choice branch. Generated Rust adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, Array, List, Option, tuple, Result, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections.";
export const nestedCheckedRecordRustLimit = "Checked-record Rust acceptance covers the established top-level Interval, Sized 3 and Bounded 0 101 forms plus the tested acyclic Packet, Holder and Choice forms through Array, List, Option, tuple and Result copied positions. Generic, recursive and inherited checked records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete Cargo crates from two author roots, remove author roots, install offline from a complete vendored dependency closure, physically relocate each installed tree, and execute again after retaining only the compiled consumer. The runs use Rust and Cargo 1.90.0 on Linux x64/glibc 2.36 with an explicit 2.36 package floor, 64-bit machine words and a recorded 20.0 host-load admission ceiling. The archive retains complete crates, dependency archives, receipts, installed inventories, execution records and producer/verifier source closures. Rust, Cargo, the system linker and glibc remain trusted toolchain inputs. Hosted glibc 2.38 release-floor acceptance remains assigned to the dedicated workflow. Constructor dispatch and peak memory are unmeasured.";
export const nestedCheckedRecordRustField = "Generated Rust Packet with BigUint digit and word fields nested inside Holder and Choice::Packet; no proof field";

const validators = Object.freeze([
	"tests/helpers/nested-checked-record-rust-report.mjs"
	, "tests/helpers/nested-checked-record-rust-controls.mjs"
	, "tests/helpers/nested-checked-record-rust-evidence.mjs"
	, "tests/helpers/nested-checked-record-rust-evidence-tests.mjs"
	, "tests/helpers/nested-checked-record-rust-provenance.mjs"
	, "tests/helpers/nested-checked-record-rust-promotion.mjs"
	, "tests/helpers/nested-checked-record-rust-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-rust-promotion-history.mjs"
	, "tests/helpers/nested-checked-record-rust-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-rust-ci-report.mjs"
	, "tests/helpers/nested-checked-record-rust-ci-policy-tests.mjs"
	, "tests/helpers/nested-checked-record-rust-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-rust-ci-workflow-tests.mjs"
	, "tests/helpers/nested-checked-record-rust-ci-shell-tests.mjs"
	, "tests/helpers/nested-checked-record-rust-resources.mjs"
	, "tests/helpers/nested-checked-record-rust-install.mjs"
	, "scripts/archive-nested-checked-record-rust-evidence.mjs"
	, "scripts/check-nested-checked-record-rust-ci.mjs"
	, "scripts/run-nested-checked-record-rust-ci.sh"
	, "scripts/update-nested-checked-record-rust-promotion-history.mjs"
	, ".github/workflows/nested-checked-record-rust.yml"
]);

const command = (route, mode) => {
	const environment = {
		CARGO_BUILD_JOBS: "1", CMAKE_BUILD_PARALLEL_LEVEL: "1"
		, LEAN_BRIDGE_CARGO: "/app/.toolchains/rust-1.90.0/bin/cargo"
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUST_MAX_LOAD: "20"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUST_MODES: mode
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUST_OUTPUT:
			"/app/build/vo1510-nested-record-rust-da01260-r1/records"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUST_ROUTES: route
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUST_TEST: "1"
		, LEAN_BRIDGE_RUSTC: "/app/.toolchains/rust-1.90.0/bin/rustc"
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
	};
	const name = `installed nested checked-record Rust packages reproduce and relocate ${route} ${mode}`;
	const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
	return "source 'scripts/env.sh' && " + [...Object.entries(environment)
		.map(([key, value]) => `${key}=${quote(value)}`)
	, "node", "--test", "--test-concurrency=1", "--test-reporter=tap"
	, `--test-name-pattern=^${name}$`
	, "tests/helpers/nested-checked-record-rust-installed-tests.mjs"
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
export const nestedCheckedRecordRustReferences = async (read = readFile) => {
	const checked = await checkNestedCheckedRecordRustEvidence(read, {
		controls: "none"
	});
	const indexPath = `${nestedCheckedRecordRustEvidence}/index.json`;
	const index = await readJson(read, indexPath);
	assert.equal(index.producerCommit, checked.producerCommit);
	assert.equal(index.producerCommit, nestedCheckedRecordRustProducer);
	assert.deepEqual(index.runs.map(item => [item.route, item.mode])
		, nestedCheckedRecordRustSelections);
	return Promise.all(index.runs.map(async (run, position) => {
		const verified = checked.selections[position], label = run.label;
		assert.equal(verified.route, run.route);
		assert.equal(verified.mode, run.mode);
		assert.deepEqual(verified.artifacts, run.artifacts);
		const full = run.mode === "full";
		const paths = index.files.filter(file => file.path.startsWith(label + "/")
			|| file.path.startsWith("sources/"));
		return {
			id: `nested-checked-record-rust-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary"
				? "ordinary-source" : "reviewed-ir"
			, profiles: [...nestedCheckedRecordRustProfiles]
			, positions: full ? ["parameter", "result", "field"] : ["result"]
			, revision: index.producerCommit
			, counts: {
				...verified.counts, executions: verified.executions
				, records: run.records, generatorModules: verified.generatorModules
				, dispatchObserved: verified.dispatchObserved
				, loadCeiling: verified.loadCeiling, runtime: verified.runtime
				, floor: verified.floor, toolchain: verified.toolchain
				, recordControls: verified.recordControls
				, resourceControls: verified.resourceControls
				, environmentControls: verified.environmentControls
				, packageControls: verified.packageControls
				, modelControls: verified.modelControls
				, executionControls: verified.executionControls
			}
			, command: command(run.route, run.mode)
			, scope: `Two independent author builds reproduce the complete Cargo crate. Author roots are removed before offline installation from the authenticated vendored dependency closure; the unchanged caller runs from the installed tree, after moving that tree, and again with only the compiled executable retained, giving three executions per selection. ${full ? "The full API checks direct and repeated parameters, Array, List, Option, tuple, both Result branches, Holder.packet and the active Choice::Packet.value field, including exact per-site constructors, normalization, complete rejected-input snapshots and recovery." : "The standalone result-only API projects checked-record payloads through Array and Option results without checked-input metadata."} ${nestedCheckedRecordRustLimit}`
			, files: [
				{ path: indexPath, sha256: nestedCheckedRecordRustEvidenceSha256 }
				, ...paths.map(file => ({
					path: `${nestedCheckedRecordRustEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: run.artifacts.map(({ path, sha256: digest }) => ({
				path, sha256: digest
			}))
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
export const promoteNestedCheckedRecordRust = async (original, references) => {
	assert.deepEqual(references, await nestedCheckedRecordRustReferences());
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
				item.profiles.includes("rust") && item.path === path
					&& item.shapes.includes("checked-record")
					&& item.positions.includes(position));
			assert.equal(observations.length, 1
				, `Missing or overlapping nested Rust cell: ${path}/${position}`);
			const observation = observations[0];
			const ids = matched.map(item => item.id);
			const scope = matched.map(item => item.scope).join(" ");
			assert.ok(observation.scope.includes(checkedRecordNativeLimit));
			observation.scope = updateText(observation.scope
				, "Additional nested Rust acceptance: " + scope);
			assert.equal(observation.conversionNotes["checked-record"]
				, checkedRecordNativeConversion);
			observation.conversionNotes["checked-record"] += " "
				+ nestedCheckedRecordRustConversion;
			assert.deepEqual(observation.limitations, [checkedRecordNativeLimit]);
			observation.limitations = [nestedCheckedRecordRustLimit];
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				assert.equal(new Set(stage.evidence).size, stage.evidence.length);
				stage.note = updateText(stage.note
					, "Additional nested Rust acceptance: " + scope);
			}
		}
		const overlap = inventory.observations.filter(item =>
			item.profiles.includes("rust") && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes("field"));
		assert.equal(overlap.length, 0
			, `Overlapping nested Rust checked-record field: ${path}`);
		const conversion = inventory.observations.find(item =>
			item.profiles.includes("rust") && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes("parameter"))
			.conversionNotes["checked-record"];
		const scope = full[0].scope, notes = {
			analysis: "Fresh Lean and independently reviewed IR agree on Packet's erased proof, nested Fin 10 and Subtype fields, and every exact constructor choice."
			, generation: "Generated Rust adapters recurse through supported copied containers, Holder.packet and active Choice::Packet.value while retaining proof-free typed structs and enums."
			, compilation: "Compiled Lean constructs Fin 10, the Word Subtype and Packet in dependency order at each selected public site."
			, packaging: "Two author roots reproduce complete Cargo crates before author removal, source-free offline installation and physical installed-tree relocation."
			, installedExecution: scope
		};
		assert.deepEqual(Object.keys(notes), inventory.stages);
		inventory.observations.push({
			id: `nested-checked-record-rust-${path}-field`
			, profiles: ["rust"], shapes: ["checked-record"]
			, positions: ["field"], path, scope
			, hostTypes: { "checked-record": { field: nestedCheckedRecordRustField } }
			, conversionNotes: { "checked-record": conversion }
			, limitations: [nestedCheckedRecordRustLimit]
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
				state: "passed", evidence: [full[0].id], note: notes[stage]
			}]))
		});
	}
	return inventory;
};
