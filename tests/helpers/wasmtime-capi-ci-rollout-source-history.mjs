/**
 * Authenticate the WIT SDK CI rollout without rewriting original evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const wasmtimeCapiRolloutHistoryPath
	= "docs/evidence/wasmtime-capi-ci-rollout-source-history-20261025.json";
export const wasmtimeCapiRolloutPredecessor
	= "9b6cd8048433479b5f09eeb328afb301fa1ad9b2";
export const wasmtimeCapiRolloutImplementation
	= "04f347effd2bac2e357665157e69e61d8464136c";
export const wasmtimeCapiRolloutIntegrationBase
	= "04f347effd2bac2e357665157e69e61d8464136c";
export const wasmtimeCapiRolloutCommits = Object.freeze([
	"04f347effd2bac2e357665157e69e61d8464136c"
]);
export const wasmtimeCapiRolloutChangedPaths = Object.freeze([
	".github/workflows/callback-checked-record-remaining.yml"
	, ".github/workflows/callback-subtype-remaining.yml"
	, ".github/workflows/checked-record-value-index-wit.yml"
	, ".github/workflows/consumer-matrix.yml"
	, ".github/workflows/dependent-checked-record-wit.yml"
	, ".github/workflows/generic-subtype-managed-wit.yml"
	, ".github/workflows/inherited-checked-record-wit.yml"
	, ".github/workflows/nested-checked-record-wit.yml"
	, ".github/workflows/nominal-primitive-subtype-wit.yml"
	, ".github/workflows/owned-subtype-remaining.yml"
	, ".github/workflows/recursive-checked-record-wit.yml"
	, ".github/workflows/zero-payload-checked-record-wit.yml"
	, "docs/consume/wit-wasi.md"
	, "docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "tests/helpers/checked-record-value-index-wit-ci-workflow-tests.mjs"
	, "tests/helpers/checked-record-value-index-wit-ci-workflow.mjs"
	, "tests/helpers/dependent-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/dependent-checked-record-wit-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/inherited-checked-record-wit-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nested-checked-record-wit-ci-workflow.mjs"
	, "tests/helpers/nominal-primitive-subtype-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-wit-ci-workflow.mjs"
	, "tests/helpers/nominal-subtype-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-ci-workflow.mjs"
	, "tests/helpers/recursive-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/recursive-checked-record-wit-ci-workflow.mjs"
	, "tests/helpers/wasmtime-capi-bootstrap.mjs"
	, "tests/helpers/wit-owned-receiver-ci.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-ci-workflow.mjs"
]);
export const wasmtimeCapiRolloutImplementationAddedPaths = Object.freeze([
	"docs/evidence/wasmtime-capi-ci-rollout-20261025.json"
	, "tests/helpers/wasmtime-capi-rollout-tests.mjs"
]);
export const wasmtimeCapiRolloutImplementationPaths = Object.freeze([
	...wasmtimeCapiRolloutChangedPaths
	, ...wasmtimeCapiRolloutImplementationAddedPaths
]);
export const wasmtimeCapiRolloutIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const wasmtimeCapiRolloutNormalizationPaths = Object.freeze([
	...wasmtimeCapiRolloutChangedPaths
	, ...wasmtimeCapiRolloutIntegrationPaths
]);
export const wasmtimeCapiRolloutHistoryAddedPaths = Object.freeze([
	"scripts/update-wasmtime-capi-ci-rollout-source-history.mjs"
	, "tests/helpers/wasmtime-capi-ci-rollout-source-history-tests.mjs"
	, "tests/helpers/wasmtime-capi-ci-rollout-source-history.mjs"
]);
export const wasmtimeCapiRolloutAddedPaths = Object.freeze([
	...wasmtimeCapiRolloutImplementationAddedPaths
	, ...wasmtimeCapiRolloutHistoryAddedPaths
]);
export const wasmtimeCapiRolloutPins = Object.freeze([
	Object.freeze({
		path: ".github/workflows/callback-checked-record-remaining.yml"
		, count: 1
		, previousSha256: "d9108a83d08568b1f75bfba4a1a8dc836040effde22bdd0c78de5b759ba60a3c"
		, currentSha256: "88611860d7112eb29308347cfef9733b03478db803da1d6b57c9e7240915342f"
	})
	, Object.freeze({
		path: ".github/workflows/checked-record-value-index-wit.yml"
		, count: 4
		, previousSha256: "db21e5b567335e1d98dbff8d32e70c970338b10d87315678bfaff8eeca9ba98f"
		, currentSha256: "e2582db7a7b9db417ba5eead833f7f9517b8d2bbfb1db851681f7451921f5807"
	})
	, Object.freeze({
		path: ".github/workflows/consumer-matrix.yml"
		, count: 92
		, previousSha256: "0211aa8c975ea078125f11c6f060159986dc083bc4e63bb9e13b1342e4f565a1"
		, currentSha256: "7c3ea32b921f4fc19767f5f65e565814936b1c006bf8e412fb543ee3f18fa6e3"
	})
	, Object.freeze({
		path: ".github/workflows/inherited-checked-record-wit.yml"
		, count: 44
		, previousSha256: "dd3d6326a8aae650d0d7a13ff5a393302b4d8bbe9d5f03db19aa1865ca78e0be"
		, currentSha256: "cd1c2ced7175dc2a4b8bf2da3bc3639ed8a09f15f14074937e42701c1946aece"
	})
	, Object.freeze({
		path: ".github/workflows/nested-checked-record-wit.yml"
		, count: 4
		, previousSha256: "af39b57b8034cce69f7187d70a2ef8dd566701e0e55b476e87ec1373b844f124"
		, currentSha256: "315a2de3dccc79de79090ab084edda55a1a9f678c974bb5fdb7dce63e384b3ca"
	})
	, Object.freeze({
		path: ".github/workflows/nominal-primitive-subtype-wit.yml"
		, count: 4
		, previousSha256: "1c4f828f5329ee4941aaaf3ac4554d6403ce5d945a4f7a69ed0b037df85b39b2"
		, currentSha256: "783c18a05989136f5ffa30597d61b0b81683adc519b54e9a93d15edd022f2571"
	})
	, Object.freeze({
		path: ".github/workflows/recursive-checked-record-wit.yml"
		, count: 36
		, previousSha256: "0255681c06c4bbd899da390181ff63c64b5018106372ab92eddbaab057f9485a"
		, currentSha256: "712f77d6542fdf8e3e9f5e7898a103fc9e4fe32d6966b81c097d7a427ba84e84"
	})
	, Object.freeze({
		path: ".github/workflows/zero-payload-checked-record-wit.yml"
		, count: 4
		, previousSha256: "974ba24fbaed1f9fea2cd35259c044563ba39bf15e5625a3b1c98067bae03c7c"
		, currentSha256: "66ad4f3303e653eaaf692a3cd35d98055e36144053613e2eddc6a8e6d11a1dc2"
	})
	, Object.freeze({
		path: "docs/consume/wit-wasi.md"
		, count: 2
		, previousSha256: "602faa0bf52394d661fd21c5af1c403515dc93b387e08d0e7d4453a12481b20a"
		, currentSha256: "8289583edab34ef75320b8db5e936adef156c86f3d16c17b27b9329a4802d1aa"
	})
	, Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "35229bc22d131919b94a6a3922e0cb3a2e8c2cb7a7d0149dc4390106d0c80aa2"
		, currentSha256: "09ca6df5f173172191d89cd852be4345620a9409c05108bd52e696d62926fdbf"
	})
	, Object.freeze({
		path: "tests/helpers/nested-checked-record-wit-ci-workflow-tests.mjs"
		, count: 4
		, previousSha256: "b04cca4a408882ef58fa1b62de9d4a18513c50102303184f732c01f4d55f73b0"
		, currentSha256: "9aeb787753275479c4061c74ebb5b24858f1a74acdf5187a9c0528fffa3d963c"
	})
	, Object.freeze({
		path: "tests/helpers/nested-checked-record-wit-ci-workflow.mjs"
		, count: 4
		, previousSha256: "5a8b34a28fdca40fdf0e37121399c989a5f2d697f653fbae7c4087b18316394d"
		, currentSha256: "fe521ae08fae949a91d8baef36655066913bdf6fe22817e7ab554d98700d9d2f"
	})
	, Object.freeze({
		path: "tests/helpers/nominal-primitive-subtype-wit-ci-workflow.mjs"
		, count: 4
		, previousSha256: "411b7bde5ff11f485284d450f1faf157fce0cf5c41067b0a165276af67e540d2"
		, currentSha256: "7331d348ec928c3415751665869a0524b066d6eed533a2d70049de6f02cb1ce0"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	wasmtimeCapiRolloutHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseWasmtimeCapiRolloutUpdate = (
	source, update
) => {
	assert.ok(wasmtimeCapiRolloutNormalizationPaths
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact Wasmtime C API rollout.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeWasmtimeCapiRolloutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !wasmtimeCapiRolloutNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseWasmtimeCapiRolloutUpdate(current, update);
	}
	return current;
};
