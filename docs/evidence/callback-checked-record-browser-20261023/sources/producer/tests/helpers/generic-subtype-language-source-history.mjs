/**
 * Reverse the authenticated generic-Subtype Python/Ruby/Rust transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeLanguageHistoryPath
	= "docs/evidence/generic-subtype-language-source-history-20261021.json";
export const genericSubtypeLanguagePredecessor
	= "79eebd15336fb9e8e102f45640964fa8a18bad3b";
export const genericSubtypeLanguageImplementation
	= "5cb50d70893d49171361eebbd946f542b7ceef11";
export const genericSubtypeLanguageChangedPaths = Object.freeze([
	"tests/helpers/nominal-subtype-python-install.mjs"
	, "tests/helpers/nominal-subtype-python-installed-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-installed-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-install.mjs"
	, "tests/helpers/nominal-subtype-rust-installed-tests.mjs"
]);
export const genericSubtypeLanguageIntegrationPaths = Object.freeze([
	"tests/generic-subtype-languages.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const genericSubtypeLanguageImplementationAdditions = Object.freeze([
	".github/workflows/generic-subtype-languages.yml"
	, "scripts/check-generic-subtype-language-ci.mjs"
	, "scripts/run-generic-subtype-python-ci.sh"
	, "scripts/run-generic-subtype-ruby-ci.sh"
	, "scripts/run-generic-subtype-rust-ci.sh"
	, "tests/fixtures/generic-subtype-consumers/python.py"
	, "tests/fixtures/generic-subtype-consumers/ruby.rb"
	, "tests/fixtures/generic-subtype-consumers/rust.rs"
	, "tests/generic-subtype-languages.test.mjs"
	, "tests/helpers/generic-subtype-language-report.mjs"
	, "tests/helpers/generic-subtype-language-tests.mjs"
	, "tests/helpers/generic-subtype-languages.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeLanguageHistoryPath, "utf8"));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseGenericSubtypeLanguageUpdate = (source, update) => {
	assert.ok([...genericSubtypeLanguageChangedPaths
		, ...genericSubtypeLanguageIntegrationPaths].includes(update.path));
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
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this exact generic-Subtype language transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeGenericSubtypeLanguageSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| ![...genericSubtypeLanguageChangedPaths
			, ...genericSubtypeLanguageIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseGenericSubtypeLanguageUpdate(source, update) : source;
};
