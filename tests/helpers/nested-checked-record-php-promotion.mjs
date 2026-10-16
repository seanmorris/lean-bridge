/**
 * Promote only nested checked-record positions authenticated by native PHP.
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
	checkNestedCheckedRecordPhpEvidence
	, nestedCheckedRecordPhpEvidence
	, nestedCheckedRecordPhpEvidenceSha256
} from "./nested-checked-record-php-evidence.mjs";
import {
	nestedCheckedRecordPhpProducer
	, nestedCheckedRecordPhpSelections
} from "./nested-checked-record-php-provenance.mjs";

export const nestedCheckedRecordPhpProfiles = Object.freeze(["php-native"]);
export const nestedCheckedRecordPhpConversion = "The tested final readonly Packet carries a Fin 10 digit and a checked Nat Subtype word as Brick\\Math\\BigInteger values. Holder nests Packet, and ChoicePacket carries it in the active Choice branch. Generated native PHP adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, Array, List, Option, Product, Except, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections.";
export const nestedCheckedRecordPhpLimit = "Checked-record native PHP acceptance covers the established top-level Interval, Sized 3 and Bounded 0 101 forms plus the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copied positions. Generic, recursive and inherited checked records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete Composer ZIPs from two author roots, remove author and build roots, install offline, and replay unchanged weak and strict callers after relocating each installation. The runs use PHP 8.2.33 and Composer 2.5.5 on Linux x64/glibc 2.36 with an explicit 2.36 package floor, 64-bit machine words and a recorded 20.0 host-load admission ceiling. The archive retains complete packages, receipts, installed closures, execution records and both producer and verifier source closures. Consumer PHP source remains required at runtime. Hosted glibc 2.38 release-floor acceptance remains assigned to the dedicated workflow. Constructor dispatch and peak memory are unmeasured.";
export const nestedCheckedRecordPhpField = "Generated final readonly PHP Packet with Brick\\Math\\BigInteger digit and word fields nested inside Holder and ChoicePacket; no proof field";

const validators = Object.freeze([
	"tests/helpers/nested-checked-record-php-report.mjs"
	, "tests/helpers/nested-checked-record-php-controls.mjs"
	, "tests/helpers/nested-checked-record-php-evidence.mjs"
	, "tests/helpers/nested-checked-record-php-evidence-tests.mjs"
	, "tests/helpers/nested-checked-record-php-provenance.mjs"
	, "tests/helpers/nested-checked-record-php-promotion.mjs"
	, "tests/helpers/nested-checked-record-php-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-php-promotion-history.mjs"
	, "tests/helpers/nested-checked-record-php-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-php-ci-report.mjs"
	, "tests/helpers/nested-checked-record-php-ci-policy-tests.mjs"
	, "tests/helpers/nested-checked-record-php-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-php-ci-workflow-tests.mjs"
	, "tests/helpers/nested-checked-record-php-ci-shell-tests.mjs"
	, "scripts/archive-nested-checked-record-php-evidence.mjs"
	, "scripts/check-nested-checked-record-php-ci.mjs"
	, "scripts/run-nested-checked-record-php-ci.sh"
	, "scripts/update-nested-checked-record-php-promotion-history.mjs"
	, ".github/workflows/nested-checked-record-php.yml"
]);

const command = () => {
	const environment = {
		CMAKE_BUILD_PARALLEL_LEVEL: "1"
		, LEAN_BRIDGE_COMPOSER: "/usr/bin/composer"
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_MAX_LOAD: "20"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_MODES: "full,result-only"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_OUTPUT:
			"build/vo1504-nested-record-php-933371c/records"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_ROUTES: "ordinary,reviewed"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_TEST: "1"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION: "2.5.5"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION: "8.2.33"
		, LEAN_BRIDGE_PHP: "/usr/bin/php"
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1"
		, MAKEFLAGS: "-j1"
	};
	const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
	return "source 'scripts/env.sh' && "
		+ [...Object.entries(environment).map(([key, value]) =>
			`${key}=${quote(value)}`)
		, "node", "--test", "--test-concurrency=1", "--test-reporter=tap"
		, "tests/helpers/nested-checked-record-php-installed-tests.mjs"
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
export const nestedCheckedRecordPhpReferences = async (read = readFile) => {
	const checked = await checkNestedCheckedRecordPhpEvidence(read, {
		controls: "none"
	});
	const indexPath = `${nestedCheckedRecordPhpEvidence}/index.json`;
	const index = await readJson(read, indexPath);
	assert.equal(index.producerCommit, checked.producerCommit);
	assert.equal(index.producerCommit, nestedCheckedRecordPhpProducer);
	assert.deepEqual(index.runs.map(item => [item.route, item.mode])
		, nestedCheckedRecordPhpSelections);
	return Promise.all(index.runs.map(async (run, position) => {
		const verified = checked.selections[position], label = run.label;
		assert.equal(verified.route, run.route); assert.equal(verified.mode, run.mode);
		const report = await readJson(read
			, `${nestedCheckedRecordPhpEvidence}/${label}/records/report.json`);
		const full = run.mode === "full";
		const paths = index.files.filter(file => file.path.startsWith(label + "/")
			|| file.path.startsWith("sources/") || file.path.startsWith("producer/"));
		return {
			id: `nested-checked-record-php-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nestedCheckedRecordPhpProfiles]
			, positions: full ? ["parameter", "result", "field"] : ["result"]
			, revision: index.producerCommit
			, counts: {
				checks: verified.checks, rejections: verified.rejections
				, hostRejections: verified.hostRejections
				, recoveries: verified.recoveries, snapshots: verified.snapshots
				, snapshotControls: verified.snapshotControls
				, rounds: verified.rounds, executions: verified.executions
				, records: run.records, loadCeiling: run.loadCeiling
			}
			, command: command()
			, scope: `Two independent author builds reproduce the complete Composer ZIP. Author and build roots are removed before offline installation; unchanged weak and strict callers run before and after moving the complete installed tree, giving four executions per selection. ${full ? "The full API checks direct and repeated parameters, Array, List, Option, Product, both Except branches, Holder.packet and the active ChoicePacket.value field, including exact per-site constructors, normalization, complete rejected-input snapshots and recovery." : "The standalone result-only API projects checked-record payloads through Array and Option results without checked-input metadata."} ${nestedCheckedRecordPhpLimit}`
			, files: [
				{ path: indexPath, sha256: nestedCheckedRecordPhpEvidenceSha256 }
				, ...paths.map(file => ({
					path: `${nestedCheckedRecordPhpEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: report.receipt.packages[0].artifacts.map(
				({ path, sha256: digest }) => ({ path, sha256: digest })
			)
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
export const promoteNestedCheckedRecordPhp = async (original, references) => {
	assert.deepEqual(references, await nestedCheckedRecordPhpReferences());
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
				item.profiles.includes("php-native") && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes(position));
			assert.equal(observations.length, 1
				, `Missing or overlapping nested native PHP cell: ${path}/${position}`);
			const observation = observations[0], ids = matched.map(item => item.id);
			const scope = matched.map(item => item.scope).join(" ");
			assert.ok(observation.scope.includes(checkedRecordNativeLimit));
			observation.scope = updateText(observation.scope
				, "Additional nested native PHP acceptance: " + scope);
			assert.equal(observation.conversionNotes["checked-record"]
				, checkedRecordNativeConversion);
			observation.conversionNotes["checked-record"] += " "
				+ nestedCheckedRecordPhpConversion;
			assert.deepEqual(observation.limitations, [checkedRecordNativeLimit]);
			observation.limitations = [nestedCheckedRecordPhpLimit];
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				assert.equal(new Set(stage.evidence).size, stage.evidence.length);
				stage.note = updateText(stage.note
					, "Additional nested native PHP acceptance: " + scope);
			}
		}
		const overlap = inventory.observations.filter(item =>
			item.profiles.includes("php-native") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("field"));
		assert.equal(overlap.length, 0
			, `Overlapping nested native PHP checked-record field: ${path}`);
		const conversion = inventory.observations.find(item =>
			item.profiles.includes("php-native") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("parameter"))
			.conversionNotes["checked-record"];
		const scope = full[0].scope, notes = {
			analysis: "Fresh Lean and independently reviewed IR agree on Packet's erased proof, nested Fin 10 and Subtype fields, and every exact constructor choice."
			, generation: "Generated native PHP adapters recurse through supported copied containers, Holder.packet and active ChoicePacket.value while retaining proof-free final readonly classes."
			, compilation: "Compiled Lean constructs Fin 10, the Word Subtype and Packet in dependency order at each selected public site."
			, packaging: "Two author roots reproduce complete Composer ZIPs before author and build removal, offline installation and physical installed-tree relocation."
			, installedExecution: scope
		};
		assert.deepEqual(Object.keys(notes), inventory.stages);
		inventory.observations.push({
			id: `nested-checked-record-php-${path}-field`
			, profiles: ["php-native"], shapes: ["checked-record"]
			, positions: ["field"], path, scope
			, hostTypes: { "checked-record": { field: nestedCheckedRecordPhpField } }
			, conversionNotes: { "checked-record": conversion }
			, limitations: [nestedCheckedRecordPhpLimit]
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
				state: "passed", evidence: [full[0].id], note: notes[stage]
			}]))
		});
	}
	return inventory;
};
