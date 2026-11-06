/**
 * Preserve the native Subtype result-projection fixture repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nativeSubtypeResultProjectionRepairHistoryPath
	= "docs/evidence/native-subtype-result-projection-repair-source-history-20261106.json";
export const nativeSubtypeResultProjectionRepairPredecessor
	= "735c2f0464d772c67a60a9048b9a0c6e2c1fdf6c";
export const nativeSubtypeResultProjectionRepairImplementation
	= "b9a02c7691a1a89dad4157cb8613e0fa24e0c0ff";
export const nativeSubtypeResultProjectionRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/native-subtype-install.mjs"
		, "tests/helpers/php-wasm-subtype-fixture.mjs"
		, "tests/native-subtype.test.mjs"
	]);
export const nativeSubtypeResultProjectionRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const nativeSubtypeResultProjectionRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-native-subtype-result-projection-repair-source-history.mjs"
		, "tests/helpers/native-subtype-result-projection-repair-source-history-tests.mjs"
		, "tests/helpers/native-subtype-result-projection-repair-source-history.mjs"
	]);
export const nativeSubtypeResultProjectionRepairBehavior = Object.freeze({
	projectedResults: 3, historicalSelectionsPreserved: 3
	, livePinRefreshes: Object.freeze({
		"tests/helpers/native-subtype-install.mjs": 28
		, "tests/helpers/php-wasm-subtype-fixture.mjs": 2
		, "tests/native-subtype.test.mjs": 8
	})
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL(
	"../../" + nativeSubtypeResultProjectionRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const nativeSubtypeResultProjectionRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: nativeSubtypeResultProjectionRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...nativeSubtypeResultProjectionRepairImplementationPaths
	, ...nativeSubtypeResultProjectionRepairIntegrationPaths
].includes(path);

/**
 * Require current projected results and the explicit historical PHP-Wasm copy.
 *
 * @param {Record<string, string>} sources - Implementation sources by path.
 */
export const assertNativeSubtypeResultProjectionRepair = sources => {
	for(const path of nativeSubtypeResultProjectionRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const fixture = sources["tests/helpers/native-subtype-install.mjs"];
	for(const [name, constructor] of [
		["shout", "Subtypes.checkedWord"]
		, ["pad", "Subtypes.checkedEven"]
		, ["join", "Subtypes.checkedWord"]
	]) {
		const line = fixture.split("\n").find(value =>
			value.includes(`"Subtypes.${name}"`));
		assert.ok(line, name);
		assert.match(line, /result: projected/u, name);
		assert.doesNotMatch(line, new RegExp(
			`result: site\\("${constructor.replace(".", "\\.")}"\\)`), name);
	}
	assert.match(fixture
		, /result \? checked\(null\) : \{ kind: "fin", bound: "10" \}/u);
	const historical = sources["tests/helpers/php-wasm-subtype-fixture.mjs"];
	for(const [name, constructor] of [
		["Subtypes.shout", "Subtypes.checkedWord"]
		, ["Subtypes.pad", "Subtypes.checkedEven"]
		, ["Subtypes.join", "Subtypes.checkedWord"]
	]) assert.equal(historical.split(
		`"${name}": "${constructor}"`).length - 1, 1, name);
	assert.match(historical, /historicalContracts\[name\]\.result = site\(constructor\)/u);
	assert.match(historical, /historicalRefinements\[name\]\.result = checked\(constructor\)/u);
	const test = sources["tests/native-subtype.test.mjs"];
	assert.match(test, /constructor: null \} \}, 0, false, "result"\)/u);
	assert.match(test, /validateNativeType\(word, 0, false, "result"\)/u);
	assert.match(test, /result projects the Subtype base value/u);
	return {
		...nativeSubtypeResultProjectionRepairBehavior
		, livePinRefreshes: {
			...nativeSubtypeResultProjectionRepairBehavior.livePinRefreshes
		}
	};
};

/**
 * Reverse one authenticated result-projection repair transition.
 *
 * @param {string} source - Complete later source.
 * @param {{path:string,currentSha256:string,previousSha256:string,edits:Array}} update - Authenticated transition.
 */
export const reverseNativeSubtypeResultProjectionRepairUpdate = (
	source, update
) => {
	assert.ok(allowedPath(update.path), update.path);
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
 * Remove only authenticated native Subtype result-projection transitions.
 *
 * @param {string} path - Repository-relative path.
 * @param {string|Buffer} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforeNativeSubtypeResultProjectionRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nativeSubtypeResultProjectionRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseNativeSubtypeResultProjectionRepairUpdate(current, update);
	}
	return current;
};
