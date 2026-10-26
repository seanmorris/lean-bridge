/**
 * Register the WIT hosted archive replay partition.
 *
 * @file
 */
import { registerOwnedCheckedRecordHostedReplay } from "./helpers/owned-checked-record-hosted-replay-tests.mjs";
// core-evidence-prefix: owned-checked-record-wit-hosted-
registerOwnedCheckedRecordHostedReplay("wit"
	, "owned-checked-record-wit-hosted-");
