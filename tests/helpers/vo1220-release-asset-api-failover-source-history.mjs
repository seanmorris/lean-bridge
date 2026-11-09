/**
 * Authenticate the pinned GitHub release-asset API failover.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ReleaseAssetApiFailoverHistoryPath
	= "docs/evidence/vo1220-release-asset-api-failover-source-history-20261109.json";
export const vo1220ReleaseAssetApiFailoverPredecessor
	= "b3aff46e311a306a52d1476b40f350c90c46f8fa";
export const vo1220ReleaseAssetApiFailoverImplementation
	= "37f46868613e15c0f45a343ad930741ed1c5eded";
export const vo1220ReleaseAssetApiFailoverImplementationPaths
	= Object.freeze([
		"nix/wasm-toolchain.nix"
		, "scripts/bootstrap-toolchains.sh"
		, "tests/performance-ci-report.test.mjs"
	]);
export const vo1220ReleaseAssetApiFailoverIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220ReleaseAssetApiFailoverNormalizationPaths
	= Object.freeze([
		...vo1220ReleaseAssetApiFailoverImplementationPaths
		, ...vo1220ReleaseAssetApiFailoverIntegrationPaths
	]);
export const vo1220ReleaseAssetApiFailoverHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-release-asset-api-failover-source-history.mjs"
		, "tests/helpers/vo1220-release-asset-api-failover-source-history-tests.mjs"
		, "tests/helpers/vo1220-release-asset-api-failover-source-history.mjs"
	]);
export const vo1220ReleaseAssetApiFailoverBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, packageSemanticChanges: 0, measurementSemanticChanges: 0
	, testContractChanges: 1, releaseAssets: 4
	, checksummedAssets: 4, uncheckedAssets: 0, acquisitionLayers: 2
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220ReleaseAssetApiFailoverHistoryPath, "utf8"
));

/**
 * Require the exact pinned API identities and unchanged digest gates.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220ReleaseAssetApiFailover = sources => {
	for(const path of vo1220ReleaseAssetApiFailoverImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const shell = sources["scripts/bootstrap-toolchains.sh"];
	const nix = sources["nix/wasm-toolchain.nix"];
	const test = sources["tests/performance-ci-report.test.mjs"];
	for(const [name, repository, asset] of [
		["ELAN", "leanprover/elan", 441516216]
		, ["LEAN_ARCHIVE", "leanprover/lean4", 492935897]
		, ["WASM_TOOLS", "bytecodealliance/wasm-tools", 355005589]
		, ["WABT", "WebAssembly/wabt", 414470153]
	]) {
		assert.match(shell, new RegExp(`^${name}_API_URL=https://api\\.github`
			+ `\\.com/repos/${repository}/releases/assets/${asset}$`, "mu"));
	}
	assert.match(shell, /if ! curl[\s\S]+Primary release URL failed; trying the pinned GitHub asset API route[\s\S]+--header 'Accept: application\/octet-stream'[\s\S]+"\$api_url" -o "\$partial"/u);
	assert.match(shell
		, /download_archive "\$LEAN_ARCHIVE_URL" "\$LEAN_ARCHIVE_API_URL" "\$archive"/u);
	assert.match(shell
		, /^ELAN_SHA256=df0b2b3a439961ffcbb3985214365ffe40f49bc871df04dff268c7d8e21ca8b2$/mu);
	assert.match(shell
		, /^LEAN_ARCHIVE_SHA256=5f2069e6f5db73780f374ccb49ce8ea649aa20a0cebf0116816744c999ce72aa$/mu);
	assert.match(nix
		, /urls = \[[\s\S]+leanprover\/lean4\/releases\/download\/v\$\{leanVersion\}[\s\S]+api\.github\.com\/repos\/leanprover\/lean4\/releases\/assets\/492935897[\s\S]+\];/u);
	assert.match(nix
		, /curlOptsList = \[ "-H" "Accept: application\/octet-stream" \];/u);
	assert.match(nix
		, /hash = "sha256-XyBp5vXbc3gPN0zLSc6OpkmqIKDOvwEWgWdEyZnOcqo=";/u);
	assert.match(test
		, /shell and Nix toolchain downloads retain a pinned GitHub API route/u);
	return { ...vo1220ReleaseAssetApiFailoverBehavior };
};

/**
 * Reverse one authenticated release-asset failover transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220ReleaseAssetApiFailoverUpdate = (
	source, update
) => {
	assert.ok(vo1220ReleaseAssetApiFailoverNormalizationPaths
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
 * Remove only this acquisition failover and its registration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ReleaseAssetApiFailoverSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ReleaseAssetApiFailoverNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220ReleaseAssetApiFailoverUpdate(current, update);
	}
	return current;
};
