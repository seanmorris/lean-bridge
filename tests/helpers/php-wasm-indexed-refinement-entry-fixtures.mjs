/**
 * Closed compiler inputs for dependent, value-indexed and zero-payload
 * checked-record PHP-Wasm entry probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	dependentCheckedRecordFixture
} from "./dependent-checked-record-browser-fixture.mjs";
import {
	checkDependentCheckedRecordPhpWasmModel
	, dependentCheckedRecordPhpWasmSelection
	, dependentCheckedRecordPhpWasmSettings
} from "./dependent-checked-record-php-wasm-fixture.mjs";
import {
	checkedRecordValueIndexFixtureRoot, checkedRecordValueIndexModule
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkCheckedRecordValueIndexPhpWasmModel
	, checkedRecordValueIndexPhpWasmSelection
	, checkedRecordValueIndexPhpWasmSettings
} from "./checked-record-value-index-php-wasm-fixture.mjs";
import {
	zeroPayloadCheckedRecordFixture, zeroPayloadCheckedRecordModule
} from "./zero-payload-checked-record-fixture.mjs";
import {
	checkZeroPayloadPhpWasmModel, zeroPayloadPhpWasmSelection
	, zeroPayloadPhpWasmSettings
} from "./zero-payload-checked-record-php-wasm-fixture.mjs";

export const phpWasmIndexedRefinementEntryFamilies = Object.freeze([
	"dependent-full", "dependent-result-only"
	, "value-index-full", "value-index-result-only"
	, "zero-payload-full", "zero-payload-result-only"
]);
export const phpWasmIndexedRefinementEntryRoutes = Object.freeze([
	"ordinary", "reviewed"
]);

const definitions = Object.freeze({
	dependent: Object.freeze({
		root: dependentCheckedRecordFixture, module: "DependentRecords"
		, namespace: "LeanDependentrecords", probe: "dependent_result"
		, settings: dependentCheckedRecordPhpWasmSettings
		, select: dependentCheckedRecordPhpWasmSelection
		, verify: checkDependentCheckedRecordPhpWasmModel
	})
	, "value-index": Object.freeze({
		root: checkedRecordValueIndexFixtureRoot
		, module: checkedRecordValueIndexModule
		, namespace: "LeanCheckedrecordvalueindices", probe: "produce_empty_string"
		, settings: checkedRecordValueIndexPhpWasmSettings
		, select: checkedRecordValueIndexPhpWasmSelection
		, verify: checkCheckedRecordValueIndexPhpWasmModel
	})
	, "zero-payload": Object.freeze({
		root: zeroPayloadCheckedRecordFixture, module: zeroPayloadCheckedRecordModule
		, namespace: "LeanZeropayloadcheckedrecords", probe: "witnesses"
		, settings: zeroPayloadPhpWasmSettings
		, select: zeroPayloadPhpWasmSelection, verify: checkZeroPayloadPhpWasmModel
	})
});

/**
 * Split one closed entry family into its package family and export mode.
 *
 * @param family - One closed #1827 family.
 */
export const phpWasmIndexedRefinementEntryFamily = family => {
	assert.ok(phpWasmIndexedRefinementEntryFamilies.includes(family));
	const resultOnly = family.endsWith("-result-only");
	const name = family.slice(0, -`${resultOnly ? "result-only" : "full"}`.length - 1);
	assert.ok(Object.hasOwn(definitions, name));
	return { name, resultOnly };
};

/**
 * Return the exact existing package selection behind one measurement cell.
 *
 * @param family - Dependent, indexed or zero-payload family and export mode.
 * @param route - Ordinary Lean source or independently reviewed IR.
 */
export const phpWasmIndexedRefinementEntrySpec = (family, route) => {
	assert.ok(phpWasmIndexedRefinementEntryRoutes.includes(route));
	const { name, resultOnly } = phpWasmIndexedRefinementEntryFamily(family);
	const definition = definitions[name];
	const sourceRoute = `${resultOnly ? "result-only-" : ""}${route === "ordinary"
		? "ordinary-source" : "reviewed-ir"}`;
	const selected = definition.select(sourceRoute);
	return {
		family, name, resultOnly, route, sourceRoute
		, root: definition.root, module: definition.module
		, namespace: definition.namespace, probe: definition.probe
		, settings: definition.settings, configuration: selected.configuration
		, review: selected.expected
		, verify: model => definition.verify(model, sourceRoute)
	};
};
