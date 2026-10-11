/**
 * Preserve the complete PHP checked-record corpus across all Wasm author routes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { basename } from "node:path";
import { checkedRecordHostConsumer, checkedRecordHostSelection } from "./checked-record-native-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";

export const checkedRecordPhpWasmSettings = Object.freeze({
	npm: { name: "lean-bridge-checkedrecords-wasm", version: "1.0.0" }
	, composer: { name: "lean-bridge-checkedrecords/wasm", version: "1.0.0" }
});

/**
 * Keep the independent native author contract while selecting only Wasm packages.
 *
 * @param route - Ordinary or reviewed full or result-only selection.
 */
export const checkedRecordPhpWasmSelection = route => {
	const selected = checkedRecordHostSelection(route, ["php-native"]);
	return { ...selected, configuration: { ...selected.configuration
		, targets: { "php-wasm": checkedRecordPhpWasmSettings } } };
};

/**
 * Require the complete caller, snapshot and rejection counts on the pinned Wasm host.
 *
 * @param route - Ordinary or reviewed full or result-only selection.
 */
export const checkedRecordPhpWasmExpected = route => {
	const { resultOnly } = checkedRecordPhpWasmSelection(route);
	return { checks: resultOnly ? 2007 : 18048
		, public_calls: resultOnly ? 1004 : 9023
		, input_snapshots: resultOnly ? 1004 : 9023
		, constructor_rejections: resultOnly ? 0 : 4009
		, word_bits: 32, php: "8.4.1" };
};

/**
 * Compare fresh compiler payload mirrors and every selected constructor with the review.
 *
 * @param model - Actual compiled wasm32 model.
 * @param route - Ordinary or reviewed full or result-only selection.
 */
export const checkCheckedRecordPhpWasmModel = (model, route) => {
	const { expected, reviewed } = checkedRecordPhpWasmSelection(route);
	assert.equal(model.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32);
	assert.equal(model.schemaVersion, reviewed ? 3 : 2);
	assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
	assert.equal(model.exports.length, expected.declarations.length);
	const record = (site, constructor) => {
		const definition = expected.types.find(item => item.id === site.type.id);
		return definition ? { kind: "checked-record"
			, definition: definition.id.slice(5), constructor
			, fields: definition.fields.map(field => field.name) } : null;
	};
	for(const declaration of expected.declarations)
	{
		const actual = model.exports.find(item => item.name === declaration.source.declaration);
		assert.ok(actual, declaration.id);
		const trees = declaration.source.extensions["lean-lang.org/refinements"];
		assert.deepEqual(actual.refinements, {
			parameters: declaration.parameters.map((site, index) => record(site, trees?.parameters[index]?.constructor ?? null))
			, result: record(declaration.result, null)
		});
	}
};

const imports = "use function LeanCheckedrecords\\{width, span, total, first_of, smallest, scale, repeated, complement};\n";
const output = 'echo "checked-record-ok:$checks\\n";\n';
const monitor = String.raw`
$public_calls = 0;
$input_snapshots = 0;
$constructor_rejections = 0;
function caller_snapshot(mixed $value): array {
    if ($value instanceof BigInteger) return ['integer', get_class($value), (string)$value];
    if (is_array($value)) {
        $items = [];
        foreach ($value as $key => $item) $items[] = [get_debug_type($key), $key, caller_snapshot($item)];
        return ['array', $items];
    }
    if (is_object($value)) return ['object', get_class($value), caller_snapshot(get_object_vars($value))];
    return [get_debug_type($value), $value];
}
function observe_public_call(string $name, array $arguments): mixed {
    global $public_calls, $input_snapshots, $constructor_rejections;
    $before = caller_snapshot($arguments);
    $public_calls++;
    $function = '\\LeanCheckedrecords\\' . $name;
    try { return $function(...$arguments); }
    catch (LeanBridgeError $error) { $constructor_rejections++; throw $error; }
    finally {
        check(caller_snapshot($arguments) === $before);
        $input_snapshots++;
    }
}
`;

/**
 * Add observation wrappers without removing any assertion or validating Lean predicates in PHP.
 *
 * @param source - Complete native caller with authenticated diagnostic labels.
 * @param route - Ordinary or reviewed full or result-only selection.
 * @param mode - Weak or strict lexical caller mode.
 */
export const adaptCheckedRecordPhpWasm = (source, route, mode) => {
	const { resultOnly } = checkedRecordPhpWasmSelection(route);
	assert.ok(["weak", "strict"].includes(mode));
	assert.ok(source.startsWith("<?php\ndeclare(strict_types=0);\n"));
	for(const marker of ['require "vendor/autoload.php";\n', imports, "$checks = 0;\n", output])
		assert.ok(source.includes(marker) && source.indexOf(marker) === source.lastIndexOf(marker), marker);
	assert.ok(source.endsWith(output));
	const names = resultOnly ? ["repeated"] : ["width", "span", "total", "first_of", "smallest", "scale", "repeated", "complement"];
	const wrappers = names.map(name => `function ${name}(...$arguments): mixed { return observe_public_call('${name}', $arguments); }`).join("\n") + "\n";
	return source.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
		.replace('require "vendor/autoload.php";\n', "")
		.replace(imports, "")
		.replace("$checks = 0;\n", "$checks = 0;\n" + monitor + wrappers)
		.replace(output, String.raw`$low_bit = n(2)->power(80)->plus(n(1));
check(same_numbers((repeated($low_bit))->data, [$low_bit, $low_bit, $low_bit]));
echo json_encode(['checks' => $checks, 'public_calls' => $public_calls,
    'input_snapshots' => $input_snapshots, 'constructor_rejections' => $constructor_rejections,
    'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
`);
};

/**
 * Load the unchanged native corpus before adapting its Wasm entry and observations.
 *
 * @param route - Ordinary or reviewed full or result-only selection.
 * @param mode - Weak or strict lexical caller mode.
 */
export const checkedRecordPhpWasmCaller = async (route, mode) => adaptCheckedRecordPhpWasm(await checkedRecordHostConsumer("php-native", route), route, mode);

/**
 * Require a non-BigInteger or non-record probe to fail before lazy Lean loading.
 *
 * @param route - Ordinary or reviewed full or result-only selection.
 * @param arrangement - Embedded npm assets or installed Composer autoloading.
 */
export const checkedRecordPhpWasmRequest = (route, arrangement) => {
	const { resultOnly } = checkedRecordPhpWasmSelection(route);
	assert.ok(["embedded", "composer"].includes(arrangement));
	const autoload = arrangement === "composer" ? "vendor/autoload.php" : `vendor/${checkedRecordPhpWasmSettings.composer.name}/bootstrap.php`;
	return JSON.stringify({ module: "LeanCheckedrecords", operations: { probe: resultOnly ? "repeated" : "width" }, autoload }) + "\n";
};

/**
 * Require twelve original host contexts, exact counts and startup/lazy loading phases.
 *
 * @param evidence - Actual shared installer observation.
 * @param route - Ordinary or reviewed full or result-only selection.
 */
export const checkCheckedRecordPhpWasmExecutions = (evidence, route) => {
	assert.deepEqual(evidence.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	const libraries = [basename(evidence.component.library), basename(evidence.runtime.library)].sort();
	assert.equal(new Set(libraries).size, 2);
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, checkedRecordPhpWasmExpected(route));
		assert.deepEqual(execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() })),
			["ready", "autoload", "invalid", "complete"].map(stage => ({ stage, libraries: execution.loading === "startup" || stage === "complete" ? libraries : [] })));
	}
};
