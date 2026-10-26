/**
 * Reverse the authenticated generic-Subtype .NET/JVM/PHP/WIT transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeManagedWitHistoryPath
	= "docs/evidence/generic-subtype-managed-wit-source-history-20261021.json";
export const genericSubtypeManagedWitPredecessor
	= "ca31df407ada98a80446ce7facb97a9bee10d984";
export const genericSubtypeManagedWitImplementation
	= "71076147b95eb9e2f1a613c4f04a8bf2fd7694d5";
export const genericSubtypeManagedWitChangedPaths = Object.freeze([
	"tests/helpers/nominal-subtype-dotnet-installed-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-fixture.mjs"
	, "tests/helpers/nominal-subtype-jvm-installed-tests.mjs"
	, "tests/helpers/nominal-subtype-php-fixture.mjs"
	, "tests/helpers/nominal-subtype-php-installed-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-installed-tests.mjs"
]);
export const genericSubtypeManagedWitIntegrationPaths = Object.freeze([
	"tests/generic-subtype-managed-wit.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const genericSubtypeManagedWitImplementationAdditions = Object.freeze([
	".github/workflows/generic-subtype-managed-wit.yml"
	, "scripts/check-generic-subtype-managed-wit-ci.mjs"
	, "scripts/run-generic-subtype-dotnet-ci.sh"
	, "scripts/run-generic-subtype-jvm-ci.sh"
	, "scripts/run-generic-subtype-php-ci.sh"
	, "scripts/run-generic-subtype-wit-ci.sh"
	, "tests/fixtures/generic-subtype-consumers/dotnet.cs"
	, "tests/fixtures/generic-subtype-consumers/java.java"
	, "tests/fixtures/generic-subtype-consumers/kotlin.kt"
	, "tests/fixtures/generic-subtype-consumers/php-native.php"
	, "tests/fixtures/generic-subtype-consumers/wit-wasi.c"
	, "tests/generic-subtype-managed-wit.test.mjs"
	, "tests/helpers/generic-subtype-managed-wit-report.mjs"
	, "tests/helpers/generic-subtype-managed-wit-tests.mjs"
	, "tests/helpers/generic-subtype-managed-wit.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeManagedWitHistoryPath, "utf8"));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseGenericSubtypeManagedWitUpdate = (source, update) => {
	assert.ok([...genericSubtypeManagedWitChangedPaths
		, ...genericSubtypeManagedWitIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
};

/**
 * Remove only this exact generic-Subtype host transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeGenericSubtypeManagedWitSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| ![...genericSubtypeManagedWitChangedPaths
			, ...genericSubtypeManagedWitIntegrationPaths].includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseGenericSubtypeManagedWitUpdate(source, update) : source;
};
