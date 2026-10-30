/**
 * Preserve the complete current-source pin closure exposed by final Core.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreCurrentSourceClosureRepairHistoryPath
	= "docs/evidence/core-current-source-closure-repair-source-history-20261030.json";
export const coreCurrentSourceClosureRepairPredecessor
	= "629dc7ac706ba2699f1a57ddeac2755aa84a84f2";
export const coreCurrentSourceClosureRepairImplementation
	= "f136f8adf6ffe16da0d3d035795701846dc5e0b2";
export const coreCurrentSourceClosureRepairRefreshedPins = 1135;
export const coreCurrentSourceClosureRepairPinTransitions = Object.freeze([
	Object.freeze({
		path: "src/backends/wit/copied-host.mjs", count: 8
		, previousSha256: "c28accb9b81d88963d2a60e146a2e7160a3832b0d9325405c77f0160728b4c03"
		, currentSha256: "122c54ffd441911fbc9977971a7034c6b3b656dadfaabf7bb04e60bde3af2e19"
	})
	, Object.freeze({
		path: "src/build/compile-jvm-sources.mjs", count: 492
		, previousSha256: "3006f6fd85211daf7c21e5e79b6373d46b2952f1b7d9d0fea04e98e533da6402"
		, currentSha256: "46bd3f9240c302814c20299155252eab6e486977150f6013b446f29a04ad16a3"
	})
	, Object.freeze({
		path: "tests/dependent-signature-complete-promotion.test.mjs", count: 1
		, previousSha256: "96d08bafdbb67b49dacecb2e0c29203bb35494e45f66aa25c874aa0835c21bda"
		, currentSha256: "1102336034cbc0cc35edb3aedd5f69d3921e09e75e69abd81eec0561607a3e1a"
	})
	, Object.freeze({
		path: "tests/helpers/copied-fixture-php-wasm.mjs", count: 622
		, previousSha256: "eb2a38bc4ed3acab22277d871d036fa25a8e32986f29f87b2ad4f6c13cd1e579"
		, currentSha256: "9afc409736a716196eb988b4389f7bebc9db18a2528ad598b86313cad0640e85"
	})
	, Object.freeze({
		path: "tests/helpers/dependent-signature-complete-documentation-tests.mjs"
		, count: 1
		, previousSha256: "ce9a1bf02762a282ad310555390e63c1aa07a036663d51f67dd0f5dadc333f30"
		, currentSha256: "6502fe8d42cc5af553cdb5d6674b74333a384e6f4e522f37d0874a0f0635f849"
	})
	, Object.freeze({
		path: "tests/helpers/dependent-signature-complete-promotion-tests.mjs"
		, count: 1
		, previousSha256: "b72280abe0684ac2204caa2ac55caab8999852bf79f9e6420960bb2f0902e0d9"
		, currentSha256: "46ffa655644c49691a1274945af9ea47adf9040a971bd410bc8f5eb8c278fb80"
	})
	, Object.freeze({
		path: "tests/helpers/optional-parameter-complete-documentation-tests.mjs"
		, count: 1
		, previousSha256: "cc338c35989698066be819bc0d392c502266564eec4b6bf11fb48797a0622ad2"
		, currentSha256: "21b6bb7d9f0b9e06331cf6b6f6507918d0733b9f24236f7315ac58db0c72dc38"
	})
	, Object.freeze({
		path: "tests/helpers/optional-parameter-complete-promotion-tests.mjs"
		, count: 1
		, previousSha256: "4d62c6a56ff7e1aedcf933b3aec05428eb30cbf32ec163d461f7b80a38fc0bcc"
		, currentSha256: "b42246870ba5a380ffa95c8dc732fe124368475717e99ada3869c55bd909d022"
	})
	, Object.freeze({
		path: "tests/jvm-kotlin-contract.test.mjs", count: 8
		, previousSha256: "4e9292f1580fe86f1224102e185bdf58ae41adc147097d77bfb2c67730ab7ed2"
		, currentSha256: "780cebc5f26543035c8600626faf7fcfce2dd20f96000ad44f9cfd38c9b52dc5"
	})
]);
export const coreCurrentSourceClosureRepairImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const coreCurrentSourceClosureRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreCurrentSourceClosureRepairHistoryAdditions = Object.freeze([
	"scripts/update-core-current-source-closure-repair-source-history.mjs"
	, "tests/helpers/core-current-source-closure-repair-source-history-tests.mjs"
	, "tests/helpers/core-current-source-closure-repair-source-history.mjs"
]);

const historyUrl = new URL(`../../${coreCurrentSourceClosureRepairHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const coreCurrentSourceClosureRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: coreCurrentSourceClosureRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => coreCurrentSourceClosureRepairImplementationPaths
	.includes(path) || coreCurrentSourceClosureRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact current-source closure transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseCoreCurrentSourceClosureRepairUpdate = (source, update) => {
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
 * Remove only the authenticated current-source closure repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreCurrentSourceClosureRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreCurrentSourceClosureRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreCurrentSourceClosureRepairUpdate(current, update);
	}
	return current;
};
