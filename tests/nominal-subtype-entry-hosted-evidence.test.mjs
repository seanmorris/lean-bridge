/**
 * Replay both immutable hosted nominal Subtype entry measurements.
 *
 * @file
 */
import test from "node:test";
import {
	checkNominalSubtypeEntryHostedEvidence
} from "./helpers/nominal-subtype-entry-hosted-evidence.mjs";

const roots = Object.freeze({
	native: "docs/evidence/nominal-subtype-entry-native-hosted-20261024"
	, browser: "docs/evidence/nominal-subtype-entry-browser-hosted-20261024"
});

for(const [lane, root] of Object.entries(roots))
	test(`retained ${lane} nominal Subtype entry evidence replays`
		, { timeout: 120_000 }
		, async () => checkNominalSubtypeEntryHostedEvidence(lane, root));
