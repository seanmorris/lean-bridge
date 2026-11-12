/**
 * Keep the primitive-base hosted acceptance cohort on one exact sparse-history
 * checkout contract.
 *
 * @file
 */
import assert from "node:assert/strict";

export const nominalPrimitiveSubtypeHistoryEvidencePaths = Object.freeze([
	"docs/evidence/ci-contract-repair-source-history-20261017.json"
	, "docs/evidence/optional-parameter-dispatch-bridge-source-history-20261029.json"
	, "docs/evidence/optional-parameter-focused-ci-source-history-20261029.json"
	, "docs/evidence/optional-parameter-current-line-integration-source-history-20261029.json"
	, "docs/evidence/optional-parameter-source-history-20261028.json"
	, "docs/evidence/core-historical-evidence-reuse-live-pin-repair-source-history-20261027.json"
	, "docs/evidence/core-exact-head-hosted-static-repair-source-history-20261027.json"
	, "docs/evidence/core-exact-head-hosted-replay-repair-source-history-20261027.json"
	, "docs/evidence/core-inherited-record-type-surface-batch-source-history-20261027.json"
	, "docs/evidence/core-recursive-callable-evidence-pin-repair-source-history-20261027.json"
	, "docs/evidence/core-recursive-callable-replay-bound-source-history-20261027.json"
	, "docs/evidence/core-legacy-owned-evidence-replay-bound-source-history-20261027.json"
	, "docs/evidence/core-callback-evidence-replay-bound-source-history-20261027.json"
	, "docs/evidence/core-inherited-record-replay-bound-source-history-20261027.json"
	, "docs/evidence/core-replay-integration-endpoint-repair-source-history-20261027.json"
	, "docs/evidence/core-exact-head-replay-repair-source-history-20261027.json"
	, "docs/evidence/recurring-acceptance-documentation-source-history-20261027.json"
	, "docs/evidence/bounded-recurring-acceptance-sweep-source-history-20261027.json"
	, "docs/evidence/core-exact-head-validation-repair-source-history-20261027.json"
	, "docs/evidence/default-branch-ci-trigger-budget-source-history-20261027.json"
]);

export const nominalPrimitiveSubtypeHistoryCheckout
	= "        uses: actions/checkout@v6\n"
	+ "        with:\n"
	+ "          fetch-depth: 0\n"
	+ "          persist-credentials: false\n"
	+ "          # Retain every producer commit while materializing live source, the\n"
	+ "          # authenticated transition records, and two immutable acceptance archives.\n"
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
	+ nominalPrimitiveSubtypeHistoryEvidencePaths.map(path =>
		`            /${path}\n`).join("")
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
