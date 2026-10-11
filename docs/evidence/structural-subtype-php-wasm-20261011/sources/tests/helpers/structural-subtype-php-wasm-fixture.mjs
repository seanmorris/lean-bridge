/**
 * Preserve the complete structural PHP corpus while adapting only its Wasm entry point.
 *
 * @file
 */
import assert from "node:assert/strict";
import { basename } from "node:path";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypePhpCaller, structuralSubtypePhpCounts } from "./structural-subtype-php-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

export const structuralSubtypePhpWasmSettings = Object.freeze({
	npm: { name: "lean-bridge-structuralsubtypes-wasm", version: "1.0.0" }
	, composer: { name: "lean-bridge-structuralsubtypes/wasm", version: "1.0.0" }
});
export const structuralSubtypePhpWasmExpected = Object.freeze({ ...structuralSubtypePhpCounts, word_bits: 32, php: "8.4.1" });
const nativeEntry = "if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {\n    require 'vendor/autoload.php';\n";
const nativeOutput = '    echo json_encode(check_structural_subtypes($api), JSON_THROW_ON_ERROR) . "\\n";\n';

/**
 * Select Wasm packages without changing either author's contracts.
 *
 * @param route - Ordinary or independently reviewed author route.
 */
export const structuralSubtypePhpWasmConfiguration = route => ({
	...structuralSubtypeConfiguration(route, ["c"])
	, targets: { "php-wasm": structuralSubtypePhpWasmSettings }
});

/**
 * The driver supplies the autoloader and requires this file in each fresh PHP host.
 * Every assertion and generated public function name remains unchanged.
 *
 * @param source - Complete native PHP caller, with the selected diagnostic labels.
 * @param mode - Explicit lexical caller strictness.
 */
export const adaptStructuralSubtypePhpWasm = (source, mode) => {
	assert.ok(["weak", "strict"].includes(mode));
	assert.ok(source.startsWith("<?php\ndeclare(strict_types=0);\n"));
	for(const marker of [nativeEntry, nativeOutput])
		assert.ok(source.includes(marker) && source.indexOf(marker) === source.lastIndexOf(marker));
	assert.ok(source.endsWith(nativeOutput + "}\n"));
	return source.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
		.replace(nativeEntry, "{\n")
		.replace(nativeOutput, '    echo json_encode(check_structural_subtypes($api) + [\'word_bits\' => PHP_INT_SIZE * 8, \'php\' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\\n";\n');
};

/**
 * Load the ordinary or independently reviewed caller without changing its corpus.
 *
 * @param route - Ordinary or independently reviewed author route.
 * @param mode - Weak or strict lexical caller.
 */
export const structuralSubtypePhpWasmCaller = async (route, mode) => adaptStructuralSubtypePhpWasm(await structuralSubtypePhpCaller(route), mode);

/**
 * The scalar-int probe must fail the generated array signature before loading Lean.
 *
 * @param arrangement - Embedded npm assets or installed Composer autoloading.
 */
export const structuralSubtypePhpWasmRequest = arrangement => {
	assert.ok(["embedded", "composer"].includes(arrangement));
	const autoload = arrangement === "composer" ? "vendor/autoload.php" : `vendor/${structuralSubtypePhpWasmSettings.composer.name}/bootstrap.php`;
	return JSON.stringify({ module: "LeanStructuralsubtypes", operations: { probe: "arrays" }, autoload }) + "\n";
};

/**
 * Require all twelve genuine driver contexts, exact corpus counts and lazy/startup phases.
 *
 * @param evidence - Original shared installer result, not a source-only observation.
 */
export const checkStructuralSubtypePhpWasmExecutions = evidence => {
	assert.deepEqual(evidence.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	const libraries = [basename(evidence.component.library), basename(evidence.runtime.library)].sort();
	assert.equal(new Set(libraries).size, 2);
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, structuralSubtypePhpWasmExpected);
		assert.deepEqual(execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() })),
			["ready", "autoload", "invalid", "complete"].map(stage => ({ stage, libraries: execution.loading === "startup" || stage === "complete" ? libraries : [] })));
	}
};
