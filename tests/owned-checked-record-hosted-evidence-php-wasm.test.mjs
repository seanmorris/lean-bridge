/**
 * Register the PHP-Wasm hosted archive replay partition.
 *
 * @file
 */
import { registerOwnedCheckedRecordHostedReplay } from "./helpers/owned-checked-record-hosted-replay-tests.mjs";
// core-evidence-prefix: owned-checked-record-php-wasm-hosted-
registerOwnedCheckedRecordHostedReplay("php-wasm"
	, "owned-checked-record-php-wasm-hosted-");
