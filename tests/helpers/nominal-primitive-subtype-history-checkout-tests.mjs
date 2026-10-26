/**
 * Reject checkout changes that lose producer history or rematerialize archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertNominalPrimitiveSubtypeHistoryCheckout
	, nominalPrimitiveSubtypeHistoryCheckout
} from "./nominal-primitive-subtype-history-checkout.mjs";

test("primitive-base acceptance retains history through one bounded sparse checkout", () => {
	assertNominalPrimitiveSubtypeHistoryCheckout(
		nominalPrimitiveSubtypeHistoryCheckout);
});

test("primitive-base sparse checkout rejects narrowed history and broadened evidence", async t => {
	const replacements = [
		["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ["sparse-checkout-cone-mode: false", "sparse-checkout-cone-mode: true"]
		, ["/docs/evidence/nominal-primitive-subtype-python-20261014/\n", ""]
		, ["/docs/evidence/nominal-primitive-subtype-npm-20261014/\n", ""]
		, ["            !/docs/evidence/*\n", ""]
		, ["          sparse-checkout: |\n", "          filter: blob:none\n          sparse-checkout: |\n"]
	];
	for(const [before, after] of replacements)
	{
		const changed = nominalPrimitiveSubtypeHistoryCheckout.replace(
			before, after);
		assert.notEqual(changed, nominalPrimitiveSubtypeHistoryCheckout);
		assert.throws(() =>
			assertNominalPrimitiveSubtypeHistoryCheckout(changed), undefined, before);
	}
	t.diagnostic(`${replacements.length} sparse-history bypasses refused`);
});
