/**
 * Keep the primitive-base hosted acceptance cohort on one exact sparse-history
 * checkout contract.
 *
 * @file
 */
import assert from "node:assert/strict";

export const nominalPrimitiveSubtypeHistoryCheckout
	= "        uses: actions/checkout@v6\n"
	+ "        with:\n"
	+ "          fetch-depth: 0\n"
	+ "          persist-credentials: false\n"
	+ "          # Retain every producer commit while materializing only live source\n"
	+ "          # and the two immutable archives read by this acceptance cohort.\n"
	+ "          sparse-checkout: |\n"
	+ "            /*\n"
	+ "            !/*/\n"
	+ "            /.github/\n"
	+ "            /acceptance/\n"
	+ "            /config/\n"
	+ "            /containers/\n"
	+ "            /demos/\n"
	+ "            /nix/\n"
	+ "            /notices/\n"
	+ "            /patches/\n"
	+ "            /poc/\n"
	+ "            /schema/\n"
	+ "            /scripts/\n"
	+ "            /site/\n"
	+ "            /src/\n"
	+ "            /tests/\n"
	+ "            /docs/\n"
	+ "            !/docs/*\n"
	+ "            /docs/type-surface.v1.json\n"
	+ "            /docs/consumer-support.v1.json\n"
	+ "            /docs/evidence/\n"
	+ "            !/docs/evidence/*\n"
	+ "            /docs/evidence/nominal-primitive-subtype-python-20261014/\n"
	+ "            /docs/evidence/nominal-primitive-subtype-npm-20261014/\n"
	+ "          sparse-checkout-cone-mode: false\n";

/**
 * Require full producer history without materializing the 44 GB evidence tree.
 *
 * @param step - Exact checkout step body.
 */
export const assertNominalPrimitiveSubtypeHistoryCheckout = step => {
	assert.equal(step, nominalPrimitiveSubtypeHistoryCheckout);
	assert.doesNotMatch(step, /^\s+filter:/gmu);
};
