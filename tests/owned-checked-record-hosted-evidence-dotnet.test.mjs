/**
 * Register the .NET hosted archive replay partition.
 *
 * @file
 */
import { registerOwnedCheckedRecordHostedReplay } from "./helpers/owned-checked-record-hosted-replay-tests.mjs";
// core-evidence-prefix: owned-checked-record-dotnet-hosted-
registerOwnedCheckedRecordHostedReplay("dotnet"
	, "owned-checked-record-dotnet-hosted-");
