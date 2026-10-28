/**
 * One ordinary-source and independently reviewed contract for checked Fin
 * values crossing synchronous callbacks and returned Lean closures.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	reviewedCallbackFinArities, reviewedCallbackFinExports
	, reviewedCallbackFinReview
} from "./reviewed-callback-fin-fixture.mjs";

export const callbackFinFixture = "tests/fixtures/onboarding/reviewed-callback-fin";
export const callbackFinModule = "ReviewedCallbacks";
export const callbackFinName = "reviewedcallbacks";

/**
 * Select exports from source, or let the independently authored review supply
 * the same closed identities and Fin bounds.
 *
 * @param route - Ordinary source or reviewed IR.
 */
export const callbackFinConfiguration = route => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	const base = { schemaVersion: 1, modules: [callbackFinModule] };
	return route === "reviewed" ? base : {
		...base, exports: [...reviewedCallbackFinExports]
		, arities: { ...reviewedCallbackFinArities }
	};
};

/** The review never derives its bounds from the ordinary build under test. */
export const callbackFinReviewedIr = () => reviewedCallbackFinReview();
