/**
 * Replay each immutable callback Subtype archive once it has been retained.
 *
 * The named tests exist before capture so every archive records the same
 * verifier path. Missing pre-capture evidence is a gate, not a support claim;
 * the promotion command requires all eight archives and cannot skip them.
 *
 * @file
 */
import { existsSync } from "node:fs";
import test from "node:test";
import {
	callbackSubtypeHostedEvidenceRoots, callbackSubtypeHostedLanes
} from "./helpers/callback-subtype-hosted-evidence-sources.mjs";
import {
	checkCallbackSubtypeHostedEvidence
} from "./helpers/callback-subtype-hosted-evidence.mjs";

for(const lane of callbackSubtypeHostedLanes)
{
	const root = callbackSubtypeHostedEvidenceRoots[lane];
	test(`retained ${lane} callback Subtype evidence replays`, {
		skip: !existsSync(`${root}/index.json`), timeout: 120_000
	}, async () => {
		await checkCallbackSubtypeHostedEvidence(lane, root);
	});
}
