/**
 * Compact installed callers and requests for the callback entry matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	callbackCheckedRecordPhpWasmConfiguration, callbackCheckedRecordPhpWasmSettings
	, checkCallbackCheckedRecordPhpWasmModel
} from "./callback-checked-record-php-wasm-fixture.mjs";
import { callbackCheckedRecordReviewedIr } from "./callback-checked-record-fixture.mjs";
import {
	callbackFinPhpWasmConfiguration, callbackFinPhpWasmReview
	, callbackFinPhpWasmSettings, checkCallbackFinPhpWasmModel
} from "./callback-fin-php-wasm-fixture.mjs";
import { phpWasmCallbackEntryFamilies } from "./php-wasm-callback-entry-source-fixtures.mjs";

const specifications = Object.freeze({
	"callback-fin": Object.freeze({
		root: "tests/fixtures/onboarding/reviewed-callback-fin"
		, leanModule: "ReviewedCallbacks"
		, caller: "tests/fixtures/php-wasm-callback-entry/callback-fin.php"
		, settings: callbackFinPhpWasmSettings
		, module: "LeanReviewedcallbacks"
		, probe: "visit"
	})
	, "callback-checked-record": Object.freeze({
		root: "tests/fixtures/onboarding/callback-checked-records"
		, leanModule: "CallbackCheckedRecords"
		, caller: "tests/fixtures/php-wasm-callback-entry/callback-checked-record.php"
		, settings: callbackCheckedRecordPhpWasmSettings
		, module: "LeanCallbackcheckedrecords", probe: "call_host"
	})
});

/**
 * Return one exact author route, review and model verifier.
 *
 * @param family - Callback family under test.
 * @param route - Ordinary or reviewed author route.
 * @param ordinaryIr - Ordinary checked-record IR used to derive the review.
 */
export const phpWasmCallbackEntryFixture = (family, route, ordinaryIr = null) => {
	assert.ok(phpWasmCallbackEntryFamilies.includes(family));
	assert.ok(["ordinary", "reviewed"].includes(route));
	const spec = structuredClone(specifications[family]);
	if(family === "callback-fin")
	{
		const review = callbackFinPhpWasmReview();
		return {
			...spec, configuration: callbackFinPhpWasmConfiguration(route)
			, review
			, verify: model => checkCallbackFinPhpWasmModel(model, review, route) };
	}
	const review = ordinaryIr === null ? null : callbackCheckedRecordReviewedIr(ordinaryIr);
	return {
		...spec, configuration: callbackCheckedRecordPhpWasmConfiguration(route)
		, review
		, verify: model => {
			const selected = route === "ordinary" ? callbackCheckedRecordReviewedIr(model.bindingIr) : review;
			checkCallbackCheckedRecordPhpWasmModel(model, selected, route);
		}
	};
};

/**
 * Return the committed PHP caller path for one callback family.
 *
 * @param family - Callback family under test.
 */
export const phpWasmCallbackEntryCallerPath = family => {
	assert.ok(phpWasmCallbackEntryFamilies.includes(family));
	return specifications[family].caller;
};

/**
 * Bind only lexical PHP strictness.
 *
 * @param family - Callback family under test.
 * @param mode - Weak or strict caller mode.
 * @param originalSource - Optional immutable caller bytes from a producer revision.
 */
export const phpWasmCallbackEntryCaller = async (family, mode, originalSource = null) => {
	assert.ok(phpWasmCallbackEntryFamilies.includes(family));
	assert.ok(["weak", "strict"].includes(mode));
	const source = originalSource === null
		? await readFile(specifications[family].caller, "utf8") : originalSource.toString();
	assert.equal(typeof source, "string");
	assert.equal(source.split("declare(strict_types=0);").length, 2);
	return source.replace("declare(strict_types=0);"
		, `declare(strict_types=${mode === "strict" ? 1 : 0});`);
};

/**
 * Bind a closed installed request and independently authored call plan.
 *
 * @param family - Callback family under test.
 * @param arrangement - Embedded or Composer package arrangement.
 * @param entryProbe - Closed compiler-derived identities and independent plan.
 */
export const phpWasmCallbackEntryRequest = (family, arrangement, entryProbe) => {
	assert.ok(phpWasmCallbackEntryFamilies.includes(family));
	assert.ok(["embedded", "composer"].includes(arrangement));
	const spec = specifications[family];
	const autoload = arrangement === "composer" ? "vendor/autoload.php"
		: `vendor/${spec.settings.composer.name}/bootstrap.php`;
	return JSON.stringify({ module: spec.module, operations: { probe: spec.probe }
		, autoload, entryProbe }) + "\n";
};

/**
 * Summarize expected accepted and refused control counts.
 *
 * @param cases - Independently planned callback controls.
 */
export const phpWasmCallbackEntryExpected = cases => ({
	controls: cases.length
	, accepted: cases.filter(item => item.outcome === "accepted").length
	, refused: cases.filter(item => item.outcome === "refused").length
});
