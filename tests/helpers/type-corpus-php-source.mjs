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
 * @param profile - Native or wasm32 PHP transport.
 * @param sourcePath - Source contract whose exact argument names must survive.
 */
export const corpusPhpSource = (mode, profile = "php-native", sourcePath = "ordinary-source") => {
	assert.ok(["weak", "strict"].includes(mode));
	assert.ok(["php-native", "php-wasm"].includes(profile));
	assert.ok(["ordinary-source", "reviewed-ir"].includes(sourcePath));
	assert.ok(sourcePath !== "reviewed-ir" || profile === "php-native");
	const source = fixture.replace('const PROFILE = "php-native";', 'const PROFILE = "' + profile + '";');
	return source.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`).replace('const MODE = "weak";', `const MODE = "${mode}";`)
		.replace('const PARAMETER_PREFIX = "arg";', `const PARAMETER_PREFIX = "${sourcePath === "reviewed-ir" ? "value" : "arg"}";`);
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

export const phpWasmRuntimeCases = Object.freeze({ ...phpRuntimeCases
	, "wrong-u32-wrapper": "TypeError", "wrong-i64-wrapper": "TypeError" });

/**
 * Independent coordinates for the two matching PHP-Wasm package ecosystems.
 *
 * @param library - Renamed corpus library.
 */
export const corpusPhpWasmSettings = library => ({
	npm: { name: library.id + "-php-wasm-corpus", version: "1.0.0" }
	, composer: { name: "lean-bridge-corpus/" + library.id + "-php-wasm", version: "1.0.0" }
});

/**
 * Give callers independent declarations and inputs, never oracle answers.
 *
 * @param library - Renamed shared corpus library.
 * @param profile - Native or wasm32 PHP transport.
 * @param arrangement - Composer installation or descriptor-mounted PHP sources.
 */
export const corpusPhpRequest = (library, profile = "php-native", arrangement = "composer") => ({
	module: library.phpModule, profile
	, autoload: arrangement === "composer" ? "vendor/autoload.php" : "vendor/" + corpusPhpWasmSettings(library).composer.name + "/src/Api.php"
	, operations: Object.fromEntries(library.operations.map((name, i) => [name, library.snakeOperations[i]]))
	, signatures: corpusSignatures(library)
	, cases: corpusCases(library).map(entry => corpusHostCase(entry, profile))
	, runtimeCases: profile === "php-native" ? phpRuntimeCases : phpWasmRuntimeCases
});

/**
 * Preserve declaration field order for reflection and named constructor calls.
 *
 * @param library - Renamed corpus library.
 * @param profile - Native or wasm32 PHP transport.
 * @param arrangement - Composer or descriptor-mounted API.
 */
export const corpusPhpRequestJson = (library, profile = "php-native", arrangement = "composer") => JSON.stringify(corpusPhpRequest(library, profile, arrangement), null, 2) + "\n";
