/**
 * Preserve the immutable native Subtype archive-pin restoration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nativeSubtypeArchivePinRestorationHistoryPath
	= "docs/evidence/native-subtype-archive-pin-restoration-source-history-20261106.json";
export const nativeSubtypeArchivePinRestorationPredecessor
	= "f956b91f096316363ae627823c9f30bf1f100eb5";
export const nativeSubtypeArchivePinRestorationImplementation
	= "1ac4e6c2cb06d08927bf476696e4d46e2de64f78";
export const nativeSubtypeArchivePinRestorationImplementationPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const nativeSubtypeArchivePinRestorationIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const nativeSubtypeArchivePinRestorationHistoryAdditions
	= Object.freeze([
		"scripts/update-native-subtype-archive-pin-restoration-source-history.mjs"
		, "tests/helpers/native-subtype-archive-pin-restoration-source-history-tests.mjs"
		, "tests/helpers/native-subtype-archive-pin-restoration-source-history.mjs"
	]);
export const nativeSubtypeArchivePinRestorationLivePath
	= "tests/helpers/native-subtype-install.mjs";
export const nativeSubtypeArchivePinRestorationDigests = Object.freeze({
	archive: "2e76844b8fd44c1e7c872379af297695fc3419fb885c459dbad7ce51f02821e8"
	, live: "04e1a083402e6e3a07dbb240198c76966f95353d31654d867acf22e007a74226"
});
export const nativeSubtypeArchivePinRestorations = Object.freeze({
	"docs/evidence/perl-relocated-hosted-20261009/source/tests/helpers/native-subtype-install.mjs.source": 4
	, "docs/evidence/php-wasm-subtype-installed-20261010/sources/tests/helpers/native-subtype-install.mjs": 2
	, "docs/evidence/reviewed-subtype-python-hosts-20261010/sources/tests/helpers/native-subtype-install.mjs.txt": 2
	, "docs/evidence/reviewed-subtype-remaining-hosts-20261010/sources/033dc35/tests/helpers/native-subtype-install.mjs.txt": 3
	, "docs/evidence/reviewed-subtype-remaining-hosts-20261010/sources/135617a/tests/helpers/native-subtype-install.mjs.txt": 4
	, "docs/evidence/reviewed-subtype-remaining-hosts-20261010/sources/a0f0ca4/tests/helpers/native-subtype-install.mjs.txt": 1
	, "docs/evidence/reviewed-subtype-ruby-jvm-hosts-20261010/sources/tests/helpers/native-subtype-install.mjs.txt": 2
});
export const nativeSubtypeArchivePinRestorationBehavior = Object.freeze({
	archivePaths: 7, restoredArchiveOccurrences: 18
	, retainedLiveOccurrences: 10, priorLiveDigestOccurrences: 28
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL(
	"../../" + nativeSubtypeArchivePinRestorationHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const nativeSubtypeArchivePinRestorationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: nativeSubtypeArchivePinRestorationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...nativeSubtypeArchivePinRestorationImplementationPaths
	, ...nativeSubtypeArchivePinRestorationIntegrationPaths
].includes(path);
const count = (source, needle) => {
	let total = 0;
	let index = source.indexOf(needle);
	while(index !== -1)
	{
		total += 1;
		index = source.indexOf(needle, index + needle.length);
	}
	return total;
};
const escape = text => text.replace(/[.*+?^${}()|[\]\\/]/gu, "\\$&");
const pinPattern = path => new RegExp(
	`("path": "${escape(path)}",\\n\\s*"sha256": ")([0-9a-f]{64})"`, "gu");
const pins = (source, path) => [...source.matchAll(pinPattern(path))]
	.map(match => match[2]);

/**
 * Bind the seven archive paths, all 18 restored pins and every other byte.
 *
 * @param previous - Complete predecessor inventory.
 * @param current - Complete restored inventory.
 */
export const assertNativeSubtypeArchivePinRestoration = (previous, current) => {
	const { archive, live } = nativeSubtypeArchivePinRestorationDigests;
	const behavior = nativeSubtypeArchivePinRestorationBehavior;
	assert.equal(typeof previous, "string");
	assert.equal(typeof current, "string");
	assert.equal(count(previous, live), behavior.priorLiveDigestOccurrences);
	assert.equal(count(current, live), behavior.retainedLiveOccurrences);
	assert.deepEqual(pins(current, nativeSubtypeArchivePinRestorationLivePath)
		, Array(behavior.retainedLiveOccurrences).fill(live));
	const paths = Object.keys(nativeSubtypeArchivePinRestorations);
	assert.equal(paths.length, behavior.archivePaths);
	let restored = 0;
	for(const path of paths)
	{
		const occurrences = nativeSubtypeArchivePinRestorations[path];
		assert.deepEqual(pins(previous, path), Array(occurrences).fill(live)
			, path);
		assert.deepEqual(pins(current, path), Array(occurrences).fill(archive)
			, path);
		restored += occurrences;
	}
	assert.equal(restored, behavior.restoredArchiveOccurrences);
	assert.equal(count(current, archive) - count(previous, archive), restored);
	const anyArchivePin = new RegExp(`("path": "(?:${paths.map(escape)
		.join("|")})",\\n\\s*"sha256": ")${archive}"`, "gu");
	let reverted = 0;
	assert.equal(current.replace(anyArchivePin, (_, prefix) => {
		reverted += 1;
		return `${prefix}${live}"`;
	}) === previous, true, "only the archive pins changed");
	assert.equal(reverted, restored);
	return {
		...behavior, restorations: { ...nativeSubtypeArchivePinRestorations }
	};
};

/**
 * Reverse one authenticated restoration transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseNativeSubtypeArchivePinRestorationUpdate = (
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
 * Remove only authenticated archive-pin restoration transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeNativeSubtypeArchivePinRestorationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nativeSubtypeArchivePinRestorationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseNativeSubtypeArchivePinRestorationUpdate(
				current, update);
	}
	return current;
};
