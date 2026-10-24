/**
 * Authenticate the structured history endpoint and source-integrity repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreStructuredHistoryRepairHistoryPath
	= "docs/evidence/core-structured-history-repair-source-history-20261024.json";
export const coreStructuredHistoryRepairPredecessor
	= "399cdc48765cad3482ef260addd6a8145c07ff60";
export const coreStructuredHistoryRepairImplementation
	= "869ce1b3d829bd7a29eae79e5be2def7f54f62c0";
export const coreStructuredHistoryRepairIntegrationBase
	= "869ce1b3d829bd7a29eae79e5be2def7f54f62c0";
export const coreStructuredHistoryRepairCommits = Object.freeze([
	"869ce1b3d829bd7a29eae79e5be2def7f54f62c0"
]);
export const coreStructuredHistoryRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/c-structured-callable-source-history.mjs"
	, "tests/helpers/cpp-structured-callable-source-history.mjs"
	, "tests/helpers/rust-structured-callable-source-history.mjs"
	, "tests/helpers/python-structured-callable-source-history.mjs"
	, "tests/helpers/ruby-structured-callable-source-history.mjs"
	, "tests/helpers/dotnet-structured-callable-source-history.mjs"
	, "tests/helpers/jvm-structured-callable-source-history.mjs"
	, "tests/rust-structured-callable-evidence.test.mjs"
	, "tests/python-structured-callable-evidence.test.mjs"
	, "tests/dotnet-structured-callable-evidence.test.mjs"
	, "tests/perl-structured-callable-evidence.test.mjs"
]);
export const coreStructuredHistoryRepairImplementationAddedPaths = Object.freeze([
	"tests/helpers/core-structured-history-endpoint-tests.mjs"
]);
export const coreStructuredHistoryRepairImplementationPaths = Object.freeze([
	...coreStructuredHistoryRepairChangedPaths
	, ...coreStructuredHistoryRepairImplementationAddedPaths
]);
export const coreStructuredHistoryRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const coreStructuredHistoryRepairNormalizationPaths = Object.freeze([
	...coreStructuredHistoryRepairChangedPaths
	, ...coreStructuredHistoryRepairIntegrationPaths
]);
export const coreStructuredHistoryRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-core-structured-history-repair-source-history.mjs"
	, "tests/helpers/core-structured-history-repair-source-history-tests.mjs"
	, "tests/helpers/core-structured-history-repair-source-history.mjs"
]);
export const coreStructuredHistoryRepairAddedPaths = Object.freeze([
	...coreStructuredHistoryRepairImplementationAddedPaths
	, ...coreStructuredHistoryRepairHistoryAddedPaths
]);
export const coreStructuredHistoryRepairPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/c-structured-callable-source-history.mjs"
		, count: 2
		, previousSha256: "5aa086b13b14c9a8f913a8abaee3493f83614447760b07edd2b657c154415434"
		, currentSha256: "73810e936e9a2a2d00dd649ba4cfb47ac076be13322c0458be6c82703b5b5c5e"
	})
	, Object.freeze({
		path: "tests/helpers/cpp-structured-callable-source-history.mjs"
		, count: 3
		, previousSha256: "6481e917f517d8ed19c0d6e3c2e4b8098282bf9d7dff97c489fbec5924999323"
		, currentSha256: "45c5de727ddf74beb7c5a7def6c0591bde2a03f0bccc402e58cf04f5aadb1f08"
	})
	, Object.freeze({
		path: "tests/helpers/rust-structured-callable-source-history.mjs"
		, count: 4
		, previousSha256: "0e6c734e48d9e6c8ba16af4c8bb0450fbb5d266d3b866744141062201bd1b48c"
		, currentSha256: "7e97cd12d80e97cfa4d47e94f65debf84c77df5748c7c822a617cf1210c7cf78"
	})
	, Object.freeze({
		path: "tests/helpers/python-structured-callable-source-history.mjs"
		, count: 4
		, previousSha256: "8e6c37008124386b48a89558676c1e3917d361018890b645eeda14accc358951"
		, currentSha256: "155e53a8f39615ec9d75e48fd39a2353595b26dc4e51c7bdea091df73dd82c3d"
	})
	, Object.freeze({
		path: "tests/helpers/ruby-structured-callable-source-history.mjs"
		, count: 4
		, previousSha256: "f4f83cecc9386f9c143dfb4caf7219669705a0abaf1aca198aef52869c8dc914"
		, currentSha256: "d9f53a35b1706a4b5b34ca2c304efa262d7d14ab833304b8731f917c1a6294df"
	})
	, Object.freeze({
		path: "tests/helpers/dotnet-structured-callable-source-history.mjs"
		, count: 4
		, previousSha256: "42f5299f12d08b9d0cba843ff1862f34d198651a318c4a8a22062d4bfb172f01"
		, currentSha256: "cdc4ab13184ed984087d013cd311e9fbd24facaa489a0b044caa7143d786b30d"
	})
	, Object.freeze({
		path: "tests/helpers/jvm-structured-callable-source-history.mjs"
		, count: 4
		, previousSha256: "b1dee59328b15fdd8d0cd01e324d168223a49d46fa1ef67ddc91087703a94d45"
		, currentSha256: "df3bd795625b9d2a85dc9770caa32d1e5e09ca2466c47fb4c550b59c18900eb0"
	})
	, Object.freeze({
		path: "tests/rust-structured-callable-evidence.test.mjs"
		, count: 4
		, previousSha256: "f30598b0c2ea842aadc212908c88e165c16e32ee3105a9d68638ee7136720a2b"
		, currentSha256: "e133b82999727edabe745fdc8136cd3e8c188b3384a9dcc010f11d829ffb53f3"
	})
	, Object.freeze({
		path: "tests/python-structured-callable-evidence.test.mjs"
		, count: 4
		, previousSha256: "090721b8e6c6dfcc612e2d41e744b757f7281c5eea8a1f13957ad05cb220de1b"
		, currentSha256: "d4606c7087e32c8d44b75faa7cf290de7c66d091f0d72dd2367e138802aa4192"
	})
	, Object.freeze({
		path: "tests/dotnet-structured-callable-evidence.test.mjs"
		, count: 4
		, previousSha256: "8490f69cc0c0a4fd581edd0f902d9cf064b5c95074f57aee078944d652522474"
		, currentSha256: "e1150ac10ff796c4b31bbb11ca283735f524c08e4b6b905a418cb18238d5b052"
	})
	, Object.freeze({
		path: "tests/perl-structured-callable-evidence.test.mjs"
		, count: 3
		, previousSha256: "febf6e1e50728662066119ecf98037b980b9c6c27704d206418d830ed8d44fff"
		, currentSha256: "f420c8a7c55bbc001df1c8eb92f012378621e99d151eded5cc4dc202ef3c933d"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreStructuredHistoryRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreStructuredHistoryRepairUpdate = (
	source, update
) => {
	assert.ok(coreStructuredHistoryRepairNormalizationPaths
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
 * Remove only the exact Core structured history repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreStructuredHistoryRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreStructuredHistoryRepairNormalizationPaths.includes(path))
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
		current = reverseCoreStructuredHistoryRepairUpdate(current, update);
	}
	return current;
};
