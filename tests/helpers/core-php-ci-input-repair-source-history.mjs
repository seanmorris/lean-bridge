/**
 * Preserve the Core aggregate and native-PHP history-input repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const corePhpCiInputRepairHistoryPath
	= "docs/evidence/core-php-ci-input-repair-source-history-20261031.json";
export const corePhpCiInputRepairPredecessor
	= "1c7469c527f719aa68670f40a141e4d02d11d81c";
export const corePhpCiInputRepairImplementation
	= "9f99399e4ee60be12091245e933b1cf1cfdec334";
export const corePhpCiInputRepairImplementationPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/quality.yml"
]);
export const corePhpCiInputRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const corePhpCiInputRepairHistoryAdditions = Object.freeze([
	"scripts/update-core-php-ci-input-repair-source-history.mjs"
	, "tests/helpers/core-php-ci-input-repair-source-history-tests.mjs"
	, "tests/helpers/core-php-ci-input-repair-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + corePhpCiInputRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const corePhpCiInputRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: corePhpCiInputRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => corePhpCiInputRepairImplementationPaths
	.includes(path) || corePhpCiInputRepairIntegrationPaths.includes(path);

const jobSource = (source, id) => {
	const marker = `  ${id}:\n`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, id);
	const rest = source.slice(start + marker.length);
	const next = rest.search(/^ {2}[a-z][a-z0-9-]*:\n/mu);
	return marker + (next === -1 ? rest : rest.slice(0, next));
};

/**
 * Authenticate the two workflow inputs without executing either workflow.
 *
 * @param consumer - Complete consumer workflow source.
 * @param quality - Complete Core workflow source.
 */
export const authenticateCorePhpCiInputs = (consumer, quality) => {
	const php = jobSource(consumer, "owned-php-callback-results");
	assert.equal(php.split("uses: actions/checkout@v6").length - 1, 1);
	assert.equal(php.split("fetch-depth: 0").length - 1, 1);
	assert.equal(php.includes("fetch-depth: 1"), false);
	assert.ok(php.indexOf("fetch-depth: 0")
		< php.indexOf("Verify frozen native PHP callback acceptance"));

	const contract = jobSource(quality, "contract");
	assert.match(contract
		, /path: \|\n\s+build\/core-shards\/core-shard-\$\{\{ matrix\.shard \}\}\.json\n\s+build\/core-evidence\/core-shard-\$\{\{ matrix\.shard \}\}-evidence\.json/u);
	const aggregate = jobSource(quality, "quality");
	assert.match(aggregate
		, /pattern: core-shard-\*-\$\{\{ github\.sha \}\}\n\s+path: build\n\s+merge-multiple: true/u);
	assert.match(aggregate
		, /run: node scripts\/check-core-contract-shards\.mjs build\/core-shards/u);
	return {
		phpHistoryDepth: 0
		, coreArtifactCommonRoot: "build"
		, coreDownloadTarget: "build"
		, coreCheckerTarget: "build/core-shards"
	};
};

/**
 * Reverse one exact Core/PHP CI-input transition.
 *
 * @param source - Current source text.
 * @param update - Authenticated reversible transition.
 */
export const reverseCorePhpCiInputRepairUpdate = (source, update) => {
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
 * Remove only the authenticated Core/PHP CI-input repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Current source text.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeCorePhpCiInputRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !corePhpCiInputRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCorePhpCiInputRepairUpdate(current, update);
	}
	return current;
};
