/**
 * Register the Rust hosted archive replay partition.
 *
 * @file
 */
import { registerOwnedCheckedRecordHostedReplay } from "./helpers/owned-checked-record-hosted-replay-tests.mjs";
// core-evidence-prefix: owned-checked-record-rust-hosted-
registerOwnedCheckedRecordHostedReplay("rust"
	, "owned-checked-record-rust-hosted-");
