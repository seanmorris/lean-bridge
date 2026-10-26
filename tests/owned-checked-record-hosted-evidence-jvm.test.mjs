/**
 * Register the JVM hosted archive replay partition.
 *
 * @file
 */
import { registerOwnedCheckedRecordHostedReplay } from "./helpers/owned-checked-record-hosted-replay-tests.mjs";
// core-evidence-prefix: owned-checked-record-jvm-hosted-
registerOwnedCheckedRecordHostedReplay("jvm"
	, "owned-checked-record-jvm-hosted-");
