/**
 * Authenticate the retained-contract repairs exposed by the exact-head cohort.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ExactHeadRetainedContractRepairHistoryPath
	= "docs/evidence/vo1220-exact-head-retained-contract-repair-source-history-20261108.json";
export const vo1220ExactHeadRetainedContractRepairPredecessor
	= "54369ce867af22ab56849801875bc26323293a67";
export const vo1220ExactHeadRetainedContractRepairImplementation
	= "0022e5a14c6f6359d56ad163832a6ca488e19f75";
export const vo1220ExactHeadRetainedContractRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/component-nominal-subtype-tests.mjs"
		, "tests/helpers/nominal-subtype-entry-publication-source-history-tests.mjs"
		, "tests/helpers/nominal-subtype-php-wasm-promotion-tests.mjs"
		, "tests/helpers/python-refinement-evidence-tests.mjs"
	]);
export const vo1220ExactHeadRetainedContractRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220ExactHeadRetainedContractRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-exact-head-retained-contract-repair-source-history.mjs"
		, "tests/helpers/vo1220-exact-head-retained-contract-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-exact-head-retained-contract-repair-source-history.mjs"
	]);
export const vo1220ExactHeadRetainedContractRepairBehavior = Object.freeze({
	assertionFailures: 4, repairedCoreShards: 3
	, generatedPackageSnapshots: 4, retainedArchiveRoots: 2
	, producerEpochModels: 1, currentSourcePaths: 2, refreshedPins: 8
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL("../../"
	+ vo1220ExactHeadRetainedContractRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220ExactHeadRetainedContractRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220ExactHeadRetainedContractRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220ExactHeadRetainedContractRepairIntegrationPaths)
	])].sort());

/**
 * Require the four exact repairs without changing runtime or support claims.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220ExactHeadRetainedContractRepair = sources => {
	for(const path of
		vo1220ExactHeadRetainedContractRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const snapshots = sources[
		"tests/helpers/component-nominal-subtype-tests.mjs"];
	assert.match(snapshots, /Readonly<Record<PropertyKey, never>>/u);
	assert.match(snapshots, /assert\.deepEqual\(Object\.fromEntries/u);
	for(const digest of [
		"50f9e59d18dd50dd44aade6bb8d953b648478be9a02fe0fde27d8800c6433ee4"
		, "a11e94b4a279a83defe3c84b6f31e0c5de181e1f1204bcd7e69cbfd30c5563fa"
		, "338d745518e2c8840edbc7a89f8f0e41d20f472d8804212242a0498e8eba9adb"
		, "fd414c8e81ff94b971be53ccaf3ec5ac5a005b908b92e04b3e06d14b86fadb77"
	]) assert.ok(snapshots.includes(digest), digest);
	assert.doesNotMatch(snapshots, /for\(const \[fixture, expected\]/u);
	const publication = sources[
		"tests/helpers/nominal-subtype-entry-publication-source-history-tests.mjs"];
	for(const prefix of [
		"nominal-subtype-entry-native-hosted-"
		, "nominal-subtype-entry-browser-hosted-"
	]) assert.match(publication, new RegExp(
		`^// core-evidence-prefix: ${prefix}$`, "mu"), prefix);
	const promotion = sources[
		"tests/helpers/nominal-subtype-php-wasm-promotion-tests.mjs"];
	assert.match(promotion
		, /sourceBeforeFinHistoryRecord\(\s*nominalPrimitiveSubtypeNpmPromotionHistoryPath/u);
	assert.match(promotion, /sourceReaderAtEvidencePins\(document/u);
	assert.match(promotion
		, /promoteNominalSubtypePhpWasm\(original, references, readAtComparison\)/u);
	const python = sources[
		"tests/helpers/python-refinement-evidence-tests.mjs"];
	assert.doesNotMatch(python
		, /import \{ nativeSubtypeRefinements \} from/u);
	assert.match(python, /nativeSubtypeRefinementsAtReceipt/u);
	assert.match(python, /beforeFinRefinementSource\(/u);
	assert.match(python, /assert\.equal\(sha256\(source\), expected/u);
	assert.match(python, /data:text\/javascript;base64/u);
	return { ...vo1220ExactHeadRetainedContractRepairBehavior };
};

/**
 * Reverse one authenticated exact-head retained-contract transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220ExactHeadRetainedContractRepairUpdate = (
	source, update
) => {
	assert.ok(vo1220ExactHeadRetainedContractRepairNormalizationPaths
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
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this exact-head retained-contract repair and its integration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ExactHeadRetainedContractRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ExactHeadRetainedContractRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220ExactHeadRetainedContractRepairUpdate(
				current, update);
	}
	return current;
};
