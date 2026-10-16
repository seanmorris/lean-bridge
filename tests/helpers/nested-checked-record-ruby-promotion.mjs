/**
 * Promote only nested checked-record positions authenticated by Ruby gems.
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
	checkNestedCheckedRecordRubyEvidence
	, nestedCheckedRecordRubyEvidence
	, nestedCheckedRecordRubyEvidenceSha256
} from "./nested-checked-record-ruby-evidence.mjs";
import {
	nestedCheckedRecordRubyProducer
	, nestedCheckedRecordRubySelections
} from "./nested-checked-record-ruby-provenance.mjs";

export const nestedCheckedRecordRubyProfiles = Object.freeze(["ruby"]);
export const nestedCheckedRecordRubyConversion = "The tested frozen Ruby Packet carries a Fin 10 digit and a checked Nat Subtype word as exact Integer values. Holder nests Packet, and Choice::Packet carries it in the active Choice branch. Generated Ruby adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, Array, List, Option, Product, Except, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections.";
export const nestedCheckedRecordRubyLimit = "Checked-record Ruby acceptance covers the established top-level Interval, Sized 3 and Bounded 0 101 forms plus the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copied positions. Generic, recursive and inherited checked records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete native gems from two author roots, remove author roots, install offline, and replay the unchanged caller before and after physically relocating each installation. The runs use MRI 3.3.12 on Linux x64/glibc 2.36 with an explicit 2.36 package floor, 64-bit machine words and a recorded 20.0 host-load admission ceiling. The archive retains complete gems, extracted packages, receipts, installed inventories, execution records and both producer and verifier source closures. RubyGems remains a trusted part of the selected interpreter toolchain. Hosted glibc 2.38 release-floor acceptance remains assigned to the dedicated workflow. Constructor dispatch and peak memory are unmeasured.";
export const nestedCheckedRecordRubyField = "Generated frozen Ruby Packet with Integer digit and word fields nested inside Holder and Choice::Packet; no proof field";

const validators = Object.freeze([
	"tests/helpers/nested-checked-record-ruby-report.mjs"
	, "tests/helpers/nested-checked-record-ruby-controls.mjs"
	, "tests/helpers/nested-checked-record-ruby-evidence.mjs"
	, "tests/helpers/nested-checked-record-ruby-evidence-tests.mjs"
	, "tests/helpers/nested-checked-record-ruby-provenance.mjs"
	, "tests/helpers/nested-checked-record-ruby-promotion.mjs"
	, "tests/helpers/nested-checked-record-ruby-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-ruby-promotion-history.mjs"
	, "tests/helpers/nested-checked-record-ruby-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-ruby-ci-report.mjs"
	, "tests/helpers/nested-checked-record-ruby-ci-policy-tests.mjs"
	, "tests/helpers/nested-checked-record-ruby-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-ruby-ci-workflow-tests.mjs"
	, "tests/helpers/nested-checked-record-ruby-ci-shell-tests.mjs"
	, "tests/helpers/nested-checked-record-ruby-resources.mjs"
	, "scripts/archive-nested-checked-record-ruby-evidence.mjs"
	, "scripts/check-nested-checked-record-ruby-ci.mjs"
	, "scripts/run-nested-checked-record-ruby-ci.sh"
	, "scripts/update-nested-checked-record-ruby-promotion-history.mjs"
	, ".github/workflows/nested-checked-record-ruby.yml"
]);

const command = () => {
	const environment = {
		CMAKE_BUILD_PARALLEL_LEVEL: "1"
		, LEAN_BRIDGE_GEM: "/app/.toolchains/ruby33/bin/gem"
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUBY_MAX_LOAD: "20"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUBY_MODES: "full,result-only"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUBY_OUTPUT:
			"/app/build/vo1508-nested-record-ruby-6d0c683-archive/records"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUBY_ROUTES: "ordinary,reviewed"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUBY_TEST: "1"
		, LEAN_BRIDGE_RUBY: "/app/.toolchains/ruby33/bin/ruby"
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
	};
	const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
	return [...Object.entries(environment).map(([key, value]) =>
		`${key}=${quote(value)}`)
	, "taskset", "-c", "3", "nice", "-n", "10", "node", "--test"
	, "--test-concurrency=1", "--test-reporter=tap"
	, "tests/helpers/nested-checked-record-ruby-installed-tests.mjs"
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
export const nestedCheckedRecordRubyReferences = async (read = readFile) => {
	const checked = await checkNestedCheckedRecordRubyEvidence(read, {
		controls: "none"
	});
	const indexPath = `${nestedCheckedRecordRubyEvidence}/index.json`;
	const index = await readJson(read, indexPath);
	assert.equal(index.producerCommit, checked.producerCommit);
	assert.equal(index.producerCommit, nestedCheckedRecordRubyProducer);
	assert.deepEqual(index.runs.map(item => [item.route, item.mode])
		, nestedCheckedRecordRubySelections);
	return Promise.all(index.runs.map(async (run, position) => {
		const verified = checked.selections[position], label = run.label;
		assert.equal(verified.route, run.route);
		assert.equal(verified.mode, run.mode);
		const gem = await readJson(read
			, `${nestedCheckedRecordRubyEvidence}/${label}/records/gem.json`);
		const full = run.mode === "full";
		const paths = index.files.filter(file => file.path.startsWith(label + "/")
			|| file.path.startsWith("sources/")
			|| file.path.startsWith("producer/"));
		return {
			id: `nested-checked-record-ruby-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary"
				? "ordinary-source" : "reviewed-ir"
			, profiles: [...nestedCheckedRecordRubyProfiles]
			, positions: full ? ["parameter", "result", "field"] : ["result"]
			, revision: index.producerCommit
			, counts: {
				...verified.counts, executions: verified.executions
				, records: run.records, loadCeiling: run.loadCeiling
			}
			, command: command()
			, scope: `Two independent author builds reproduce the complete native gem. Author roots are removed before offline installation; the unchanged caller runs before and after moving the complete installed tree, giving two executions per selection. ${full ? "The full API checks direct and repeated parameters, Array, List, Option, Product, both Except branches, Holder.packet and the active Choice::Packet.value field, including exact per-site constructors, normalization, complete rejected-input snapshots and recovery." : "The standalone result-only API projects checked-record payloads through Array and Option results without checked-input metadata."} ${nestedCheckedRecordRubyLimit}`
			, files: [
				{ path: indexPath, sha256: nestedCheckedRecordRubyEvidenceSha256 }
				, ...paths.map(file => ({
					path: `${nestedCheckedRecordRubyEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: [{
				path: gem.archive.path, sha256: gem.archive.sha256
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
export const promoteNestedCheckedRecordRuby = async (original, references) => {
	assert.deepEqual(references, await nestedCheckedRecordRubyReferences());
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
				item.profiles.includes("ruby") && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes(position));
			assert.equal(observations.length, 1
				, `Missing or overlapping nested Ruby cell: ${path}/${position}`);
			const observation = observations[0];
			const ids = matched.map(item => item.id);
			const scope = matched.map(item => item.scope).join(" ");
			assert.ok(observation.scope.includes(checkedRecordNativeLimit));
			observation.scope = updateText(observation.scope
				, "Additional nested Ruby acceptance: " + scope);
			assert.equal(observation.conversionNotes["checked-record"]
				, checkedRecordNativeConversion);
			observation.conversionNotes["checked-record"] += " "
				+ nestedCheckedRecordRubyConversion;
			assert.deepEqual(observation.limitations, [checkedRecordNativeLimit]);
			observation.limitations = [nestedCheckedRecordRubyLimit];
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				assert.equal(new Set(stage.evidence).size, stage.evidence.length);
				stage.note = updateText(stage.note
					, "Additional nested Ruby acceptance: " + scope);
			}
		}
		const overlap = inventory.observations.filter(item =>
			item.profiles.includes("ruby") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("field"));
		assert.equal(overlap.length, 0
			, `Overlapping nested Ruby checked-record field: ${path}`);
		const conversion = inventory.observations.find(item =>
			item.profiles.includes("ruby") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("parameter"))
			.conversionNotes["checked-record"];
		const scope = full[0].scope, notes = {
			analysis: "Fresh Lean and independently reviewed IR agree on Packet's erased proof, nested Fin 10 and Subtype fields, and every exact constructor choice."
			, generation: "Generated Ruby adapters recurse through supported copied containers, Holder.packet and active Choice::Packet.value while retaining proof-free frozen classes."
			, compilation: "Compiled Lean constructs Fin 10, the Word Subtype and Packet in dependency order at each selected public site."
			, packaging: "Two author roots reproduce complete native gems before author removal, offline installation and physical installed-tree relocation."
			, installedExecution: scope
		};
		assert.deepEqual(Object.keys(notes), inventory.stages);
		inventory.observations.push({
			id: `nested-checked-record-ruby-${path}-field`
			, profiles: ["ruby"], shapes: ["checked-record"]
			, positions: ["field"], path, scope
			, hostTypes: { "checked-record": { field: nestedCheckedRecordRubyField } }
			, conversionNotes: { "checked-record": conversion }
			, limitations: [nestedCheckedRecordRubyLimit]
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
				state: "passed", evidence: [full[0].id], note: notes[stage]
			}]))
		});
	}
	return inventory;
};
