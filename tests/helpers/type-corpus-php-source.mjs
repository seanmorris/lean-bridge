/**
 * Independent PHP caller inputs, declarations and error expectations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { corpusCases, corpusHostCase, corpusSignatures } from "../fixtures/type-corpus/cases.mjs";

const fixture = await readFile(new URL("../fixtures/type-corpus/consumers/php.php", import.meta.url), "utf8");

/**
 * Put every public call in the selected PHP lexical caller mode.
 *
 * @param mode - Weak or strict caller typing.
 */
export const corpusPhpSource = mode => {
	assert.ok(["weak", "strict"].includes(mode));
	return fixture.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`).replace('const MODE = "weak";', `const MODE = "${mode}";`);
};

export const phpRuntimeCases = Object.freeze({
	"null-string": "TypeError", "null-bytes": "TypeError"
	, "null-array": "TypeError", "null-record": "TypeError"
	, "null-nat": "TypeError", "null-bool": "TypeError"
	, "numeric-string": "TypeError", "float-as-int": "TypeError"
	, "wrong-nat-wrapper": "TypeError", "wrong-u64-wrapper": "TypeError"
	, "raw-bytes": "TypeError", "negative-u64": "ValueError"
	, "non-list": "TypeError", "nested-non-list": "TypeError"
	, "malformed-utf8": "ValueError", "record-utf8": "ValueError"
	, "forged-record": "TypeError", "forged-nat": "ValueError"
	, "bytes-limit": "ValueError", "string-limit": "ValueError"
	, "array-limit": "ValueError", "output-limit": "LeanBridgeError"
});

/**
 * Give callers independent declarations and inputs, never oracle answers.
 *
 * @param library - Renamed shared corpus library.
 */
export const corpusPhpRequest = library => ({
	module: library.phpModule
	, operations: Object.fromEntries(library.operations.map((name, i) => [name, library.snakeOperations[i]]))
	, signatures: corpusSignatures(library)
	, cases: corpusCases(library).map(entry => corpusHostCase(entry, "php-native"))
	, runtimeCases: phpRuntimeCases
});

/**
 * Preserve declaration field order for reflection and named constructor calls.
 *
 * @param library - Renamed corpus library.
 */
export const corpusPhpRequestJson = library => JSON.stringify(corpusPhpRequest(library), null, 2) + "\n";
