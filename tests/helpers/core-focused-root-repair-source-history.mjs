/**
 * Preserve three focused roots found by the broad b88e1eb Core campaign.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreFocusedRootRepairHistoryPath
	= "docs/evidence/core-focused-root-repair-source-history-20261106.json";
export const coreFocusedRootRepairPredecessor
	= "593ec8dbe0ed03eb4f3836c5a59dec465e4347a7";
export const coreFocusedRootRepairImplementation
	= "ea100413aaa4b1ccc50b94b97eff52130bd468ba";
export const coreFocusedRootRepairImplementationPaths = Object.freeze([
	"docs/consume/cpp.md"
	, "docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/wit-owned-package-evidence.mjs"
	, "tests/reviewed-fin-wasm-entry-controls.test.mjs"
	, "tests/type-surface-docs.test.mjs"
	, "tests/wit-owned-package-evidence.test.mjs"
]);
export const coreFocusedRootRepairIntegrationPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreFocusedRootRepairHistoryAdditions = Object.freeze([
	"scripts/update-core-focused-root-repair-source-history.mjs"
	, "tests/helpers/core-focused-root-repair-source-history-tests.mjs"
	, "tests/helpers/core-focused-root-repair-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${coreFocusedRootRepairHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const coreFocusedRootRepairNormalizationPaths = Object.freeze([
	...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: coreFocusedRootRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: coreFocusedRootRepairIntegrationPaths)
	])
].sort());
const allowedPath = path => coreFocusedRootRepairImplementationPaths
	.includes(path) || coreFocusedRootRepairIntegrationPaths.includes(path);

/**
 * Require the documentation, ABI-control and WIT dependency repairs together.
 *
 * @param sources - Implementation paths mapped to complete source text.
 */
export const assertCoreFocusedRootRepair = sources => {
	for(const path of coreFocusedRootRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const generator = sources["scripts/generate-type-docs.mjs"];
	assert.match(generator, /export const markdownRawHtml =/u);
	assert.match(generator, /A CommonMark inline HTML tag/u);
	assert.match(generator, /export const renderTypeNote =/u);
	assert.match(generator
		, /conversion notes must render type syntax as code, not raw HTML/u);
	const notes = new Map([
		["cpp", "std::optional<T>; source HostNull and Option remain separate nested layers"]
		, ["dotnet", "nullable T; Option<T> remains explicit None/Some"]
		, ["java", "boxed @Nullable T; Option<T> remains explicit None/Some"]
		, ["kotlin", "T?; Option<T> remains explicit None/Some"]
		, ["rust", "Option<T>; source HostNull and Option remain separate nested layers"]
		, ["wit-wasi", "WIT option<T>; source HostNull and Option remain separate nested layers"]
	]);
	for(const [profile, note] of notes)
		assert.ok(sources[`docs/consume/${profile}.md`].includes(`| \`${note}\`.`)
			, profile);
	assert.match(sources["tests/type-surface-docs.test.mjs"]
		, /conversion notes render markup-like host types as code/u);
	const fin = sources["tests/reviewed-fin-wasm-entry-controls.test.mjs"];
	assert.match(fin, /probe control with a no-op refinement/u);
	assert.match(fin, /Invalid declaration refinement metadata/u);
	assert.match(fin, /descriptor carrying the no-op refinement beside a valid ABI/u);
	const wit = sources["tests/helpers/wit-owned-package-evidence.mjs"];
	assert.match(wit
		, /for\(const aggregate of \["optional-parameter-matrix", "support-summary"\]\)/u);
	assert.match(wit, /needs wasi-consumer/u);
	const witTests = sources["tests/wit-owned-package-evidence.test.mjs"];
	assert.match(witTests, /support-summary needs wasi-consumer/u);
	assert.match(witTests, /optional-parameter-matrix needs wasi-consumer/u);
	return { generatedGuides: 6, compilerPagesChecked: 8
		, repairedControls: 3, changedSupportCells: 0
		, runtimeSemanticChanges: 0 };
};

/**
 * Reverse one authenticated focused-root repair transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseCoreFocusedRootRepairUpdate = (source, update) => {
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
 * Remove only authenticated focused-root repair transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeCoreFocusedRootRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !coreFocusedRootRepairNormalizationPaths.includes(path)
		|| !existsSync(historyUrl)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreFocusedRootRepairUpdate(current, update);
	}
	return current;
};
