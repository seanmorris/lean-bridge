/** @file A real Lean call with two callbacks, UTF-8 text and a scalar per input. */
import {readFile} from "node:fs/promises";
import {compileOwnedAggregateFixture} from "./owned-aggregate-native.mjs";

/**
 * Compile the same two-record workload for each native downstream client.
 *
 * @param t - Test context owning the temporary build.
 * @param evidenceName - Diagnostic evidence filename for this client.
 */
export const compileMixedQuote = async (t,evidenceName) => {
	const source = new URL("../fixtures/onboarding/leased-closure-fields/lean-bridge.exports.json",import.meta.url);
	const configuration = JSON.parse(await readFile(source));
	configuration.exports.push("Owned.compareCards");
	configuration.ownedAggregates.closureFields.push("Owned.PriceCard.quote","Owned.PriceCard.rebate");
	const sourceSuffix = "\n"+await readFile(new URL("../fixtures/structured-types/price-card.lean",import.meta.url),"utf8");
	return compileOwnedAggregateFixture(t,{fixture: "leased-closure-fields"
		, configuration,sourceSuffix,witness: "import Owned\n",hostCallbacks: true
		, stepTimeoutMs: 600000,evidenceName});
};
