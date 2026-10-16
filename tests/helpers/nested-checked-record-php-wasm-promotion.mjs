/**
 * Promote only nested checked-record positions authenticated by PHP-Wasm.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordPhpWasmConversion
	, checkedRecordPhpWasmLimit
} from "./checked-record-php-wasm-promotion.mjs";
import {
	checkNestedCheckedRecordPhpWasmEvidence
	, nestedCheckedRecordPhpWasmEvidence
	, nestedCheckedRecordPhpWasmEvidenceSha256
} from "./nested-checked-record-php-wasm-evidence.mjs";
import {
	nestedCheckedRecordPhpWasmProducer
	, nestedCheckedRecordPhpWasmSelections
} from "./nested-checked-record-php-wasm-provenance.mjs";

export const nestedCheckedRecordPhpWasmProfiles = Object.freeze(["php-wasm"]);
export const nestedCheckedRecordPhpWasmConversion = "The tested PHP-Wasm Packet carries a Fin 10 digit and a checked Nat Subtype word as Brick\\Math\\BigInteger values. Holder nests Packet, and ChoicePacket carries it in the active Choice branch. Generated PHP-Wasm adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, Array, List, Option, Product, Except, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections.";
export const nestedCheckedRecordPhpWasmLimit = "Checked-record PHP-Wasm acceptance covers the established top-level Interval, Sized 3 and Bounded 0 101 forms plus the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copied positions. Generic, recursive and inherited checked records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete Composer API, npm component and npm shared-runtime archives from two author roots, remove author and build roots, install offline, physically relocate each installation, and run unchanged weak and strict callers in eight Node and four Chromium contexts. The runs use wasm32 PHP 8.4.1, Node 22.23.2 and Chromium 152.0.7977.75 on Linux x64 with 32-bit machine words and a recorded 20.0 host-load admission ceiling. The archive retains complete packages, receipts, deployment callers, execution records and both producer and verifier source closures. Consumer PHP source remains required at runtime. The prepared PHP-Wasm runtime and browser remain trusted inputs; hosted acceptance remains assigned to the dedicated workflow. Constructor dispatch and peak memory are unmeasured.";
export const nestedCheckedRecordPhpWasmField = "Generated PHP-Wasm Packet with Brick\\Math\\BigInteger digit and word fields nested inside Holder and ChoicePacket; no proof field";

const validators = Object.freeze([
	"tests/helpers/nested-checked-record-php-wasm-report.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-controls.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-evidence.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-evidence-tests.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-provenance.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-promotion.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-promotion-history.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-ci-report.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-ci-tests.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-ci-workflow-tests.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-ci-shell-tests.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-directory.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-fixture.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-installed-tests.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-selections.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-sources.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-tests.mjs"
	, "scripts/archive-nested-checked-record-php-wasm-evidence.mjs"
	, "scripts/check-nested-checked-record-php-wasm-ci.mjs"
	, "scripts/run-nested-checked-record-php-wasm-ci.sh"
	, "scripts/update-nested-checked-record-php-wasm-promotion-history.mjs"
	, ".github/workflows/nested-checked-record-php-wasm.yml"
]);

const command = () => {
	const environment = {
		CMAKE_BUILD_PARALLEL_LEVEL: "1"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_WASM_MAX_LOAD: "20"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_WASM_MODES: "full,result-only"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_WASM_OUTPUT:
			"build/vo1507-nested-record-php-wasm/records"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_WASM_ROUTES: "ordinary,reviewed"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_WASM_TEST: "1"
		, LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME:
			"build/nested-checked-record-php-wasm-input/php-wasm-runtime"
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
	};
	const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
	return "source 'scripts/env.sh' && "
		+ [...Object.entries(environment).map(([key, value]) =>
			`${key}=${quote(value)}`)
		, "node", "--test", "--test-concurrency=1", "--test-reporter=tap"
		, "tests/helpers/nested-checked-record-php-wasm-installed-tests.mjs"
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
export const nestedCheckedRecordPhpWasmReferences = async (read = readFile) => {
	const checked = await checkNestedCheckedRecordPhpWasmEvidence(read, {
		controls: "none"
	});
	const indexPath = `${nestedCheckedRecordPhpWasmEvidence}/index.json`;
	const index = await readJson(read, indexPath);
	assert.equal(index.producerCommit, checked.producerCommit);
	assert.equal(index.producerCommit, nestedCheckedRecordPhpWasmProducer);
	assert.deepEqual(index.runs.map(item => [item.route, item.mode])
		, nestedCheckedRecordPhpWasmSelections);
	return Promise.all(index.runs.map(async (run, position) => {
		const verified = checked.selections[position], label = run.label;
		assert.equal(verified.route, run.route);
		assert.equal(verified.mode, run.mode);
		const receipt = await readJson(read, `${nestedCheckedRecordPhpWasmEvidence}`
			+ `/${label}/records/handoff/package-set-receipt.json`);
		assert.deepEqual(receipt.packages.map(item => [item.target, item.role])
			, [["php-wasm", "api"], ["php-wasm", "runtime"]
				, ["php-wasm", "component"]]);
		assert.ok(receipt.packages.every(item => item.artifacts.length === 1));
		const artifacts = receipt.packages.flatMap(item => item.artifacts);
		const full = run.mode === "full";
		const paths = index.files.filter(file => file.path.startsWith(label + "/")
			|| file.path.startsWith("sources/"));
		return {
			id: `nested-checked-record-php-wasm-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary"
				? "ordinary-source" : "reviewed-ir"
			, profiles: [...nestedCheckedRecordPhpWasmProfiles]
			, positions: full ? ["parameter", "result", "field"] : ["result"]
			, revision: index.producerCommit
			, counts: {
				...verified.counts, executions: verified.executions
				, records: run.records, loadCeiling: run.loadCeiling
			}
			, command: command()
			, scope: `Two independent author builds reproduce the complete Composer API, npm component and npm shared-runtime archives. Author and build roots are removed before offline installation and physical relocation; unchanged weak and strict callers run in eight Node embedded/Composer and four Chromium bundled startup/lazy contexts, giving twelve executions per selection. ${full ? "The full API checks direct and repeated parameters, Array, List, Option, Product, both Except branches, Holder.packet and the active ChoicePacket.value field, including exact per-site constructors, normalization, complete rejected-input snapshots and recovery." : "The standalone result-only API projects checked-record payloads through Array and Option results without checked-input metadata."} ${nestedCheckedRecordPhpWasmLimit}`
			, files: [
				{ path: indexPath, sha256: nestedCheckedRecordPhpWasmEvidenceSha256 }
				, ...paths.map(file => ({
					path: `${nestedCheckedRecordPhpWasmEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: artifacts.map(({ path, sha256: digest }) => ({
				path, sha256: digest
			}))
		};
	}));
};

const updateText = (source, addition) => source.split(checkedRecordPhpWasmLimit)
	.join("").trimEnd() + " " + addition;

/**
 * Supplement four parameter/result cells, add two fields, and preserve all else.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNestedCheckedRecordPhpWasm = async (original, references) => {
	assert.deepEqual(references, await nestedCheckedRecordPhpWasmReferences());
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
				item.profiles.includes("php-wasm") && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes(position));
			assert.equal(observations.length, 1
				, `Missing or overlapping nested PHP-Wasm cell: ${path}/${position}`);
			const observation = observations[0];
			const ids = matched.map(item => item.id);
			const scope = matched.map(item => item.scope).join(" ");
			assert.ok(observation.scope.includes(checkedRecordPhpWasmLimit));
			observation.scope = updateText(observation.scope
				, "Additional nested PHP-Wasm acceptance: " + scope);
			assert.equal(observation.conversionNotes["checked-record"]
				, checkedRecordPhpWasmConversion);
			observation.conversionNotes["checked-record"] += " "
				+ nestedCheckedRecordPhpWasmConversion;
			assert.deepEqual(observation.limitations, [checkedRecordPhpWasmLimit]);
			observation.limitations = [nestedCheckedRecordPhpWasmLimit];
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				assert.equal(new Set(stage.evidence).size, stage.evidence.length);
				stage.note = updateText(stage.note
					, "Additional nested PHP-Wasm acceptance: " + scope);
			}
		}
		const overlap = inventory.observations.filter(item =>
			item.profiles.includes("php-wasm") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("field"));
		assert.equal(overlap.length, 0
			, `Overlapping nested PHP-Wasm checked-record field: ${path}`);
		const conversion = inventory.observations.find(item =>
			item.profiles.includes("php-wasm") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("parameter"))
			.conversionNotes["checked-record"];
		const scope = full[0].scope, notes = {
			analysis: "Fresh Lean and independently reviewed IR agree on Packet's erased proof, nested Fin 10 and Subtype fields, and every exact constructor choice."
			, generation: "Generated PHP-Wasm adapters recurse through supported copied containers, Holder.packet and active ChoicePacket.value while retaining proof-free final readonly PHP classes."
			, compilation: "Compiled Lean constructs Fin 10, the Word Subtype and Packet in dependency order at each selected public site."
			, packaging: "Two author roots reproduce complete Composer API, npm component and npm shared-runtime archives before author and build removal, offline installation and physical installed-tree relocation."
			, installedExecution: scope
		};
		assert.deepEqual(Object.keys(notes), inventory.stages);
		inventory.observations.push({
			id: `nested-checked-record-php-wasm-${path}-field`
			, profiles: ["php-wasm"], shapes: ["checked-record"]
			, positions: ["field"], path, scope
			, hostTypes: { "checked-record": { field: nestedCheckedRecordPhpWasmField } }
			, conversionNotes: { "checked-record": conversion }
			, limitations: [nestedCheckedRecordPhpWasmLimit]
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
				state: "passed", evidence: [full[0].id], note: notes[stage]
			}]))
		});
	}
	return inventory;
};
