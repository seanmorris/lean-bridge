/**
 * Register the Python hosted archive replay partition.
 *
 * @file
 */
import { registerOwnedCheckedRecordHostedReplay } from "./helpers/owned-checked-record-hosted-replay-tests.mjs";
// core-evidence-prefix: owned-checked-record-python-hosted-
registerOwnedCheckedRecordHostedReplay("python"
	, "owned-checked-record-python-hosted-");
