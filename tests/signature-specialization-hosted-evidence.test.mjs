/**
 * Replay every retained hosted signature-specialization lane.
 *
 * @file
 */
import test from "node:test";
import {
	checkSignatureSpecializationHostedEvidence
} from "./helpers/signature-specialization-hosted-evidence.mjs";

test("ten hosted signature-specialization lanes replay independently", async () => {
	await checkSignatureSpecializationHostedEvidence();
});
