/**
 * Register the native hosted archive replay partition.
 *
 * @file
 */
import { registerOwnedCheckedRecordHostedReplay } from "./helpers/owned-checked-record-hosted-replay-tests.mjs";
// core-evidence-prefix: owned-checked-record-native-hosted-
registerOwnedCheckedRecordHostedReplay("native"
	, "owned-checked-record-native-hosted-");
