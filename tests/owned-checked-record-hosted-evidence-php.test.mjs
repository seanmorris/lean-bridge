/**
 * Register the PHP hosted archive replay partition.
 *
 * @file
 */
import { registerOwnedCheckedRecordHostedReplay } from "./helpers/owned-checked-record-hosted-replay-tests.mjs";
// core-evidence-prefix: owned-checked-record-php-hosted-
registerOwnedCheckedRecordHostedReplay("php"
	, "owned-checked-record-php-hosted-");
