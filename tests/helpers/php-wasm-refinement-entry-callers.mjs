/**
 * Closed compact callers and requests for installed #1824 probe packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	phpWasmIndexedRefinementEntryFamilies, phpWasmIndexedRefinementEntrySpec
} from "./php-wasm-indexed-refinement-entry-fixtures.mjs";
import {
	nominalPrimitiveSubtypePhpWasmSettings
} from "./nominal-primitive-subtype-php-wasm-fixture.mjs";
import {
	recursiveCheckedRecordPhpWasmPackage
} from "./recursive-checked-record-php-wasm-fixture.mjs";
import { recursiveSubtypeConfiguration } from "./recursive-subtype-fixture.mjs";

const families = Object.freeze({
	"nominal-full": Object.freeze({
		module: "LeanNominalprimitivesubtypes", probe: "echo_a"
		, settings: nominalPrimitiveSubtypePhpWasmSettings
	})
	, "nominal-result-only": Object.freeze({
		module: "LeanNominalprimitivesubtypes", probe: "produce"
		, settings: nominalPrimitiveSubtypePhpWasmSettings
	})
	, "recursive-subtype": Object.freeze({
		module: "LeanRecursivesubtypes", probe: "first"
		, settings: recursiveSubtypeConfiguration("ordinary").targets["php-wasm"]
	})
	, "recursive-checked-record": Object.freeze({
		module: recursiveCheckedRecordPhpWasmPackage("recursive").namespace
		, probe: "first"
		, settings: recursiveCheckedRecordPhpWasmPackage("recursive").settings
	})
	, ...Object.fromEntries(phpWasmIndexedRefinementEntryFamilies.map(family => {
		const spec = phpWasmIndexedRefinementEntrySpec(family, "ordinary");
		return [
			family
			, Object.freeze({
			module: spec.namespace, probe: spec.probe, settings: spec.settings
			})
		];
	}))
});

/**
 * Return exact package coordinates and public preload operation for one family.
 *
 * @param family - Closed graph family.
 */
export const phpWasmRefinementEntryCallerSpec = family => {
	assert.ok(Object.hasOwn(families, family)); return families[family];
};

/**
 * Read one tracked compact caller and change only lexical strictness.
 *
 * @param family - Closed graph family.
 * @param strictness - Weak or strict PHP mode.
 */
export const phpWasmRefinementEntryCaller = async (family, strictness) => {
	assert.ok(Object.hasOwn(families, family)); assert.ok(["weak", "strict"].includes(strictness));
	const source = await readFile(`tests/fixtures/php-wasm-refinement-entry/${family}.php`, "utf8");
	const declaration = "declare(strict_types=0);"; assert.equal(source.split(declaration).length - 1, 1);
	return source.replace(declaration, `declare(strict_types=${strictness === "strict" ? 1 : 0});`);
};

/**
 * Bind the independently authored call plan to one installed arrangement.
 *
 * @param family - Closed graph family.
 * @param arrangement - Embedded or Composer package installation.
 * @param entryProbe - Compiler-derived identities plus independent call plan.
 */
export const phpWasmRefinementEntryRequest = (family, arrangement, entryProbe) => {
	assert.ok(Object.hasOwn(families, family)); assert.ok(["embedded", "composer"].includes(arrangement));
	assert.equal(entryProbe.family, family); assert.equal(entryProbe.scope, "separate-instrumented-probe");
	const value = families[family];
	return canonicalJson({
		module: value.module, operations: { probe: value.probe }
		, autoload: arrangement === "composer" ? "vendor/autoload.php"
			: `vendor/${value.settings.composer.name}/bootstrap.php`
		, entryProbe
	});
};

/**
 * Exact compact observation, independent of marker counts.
 *
 * @param family - Closed graph family.
 * @param cases - Independently authored calls executed by the caller.
 */
export const phpWasmRefinementEntryExpected = (family, cases) => {
	assert.ok(Object.hasOwn(families, family)); assert.ok(Array.isArray(cases) && cases.length > 0);
	return { checks: cases.length, family, word_bits: 32, php: "8.4.1" };
};
