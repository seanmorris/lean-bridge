/**
 * Shared hosted-artifact primitives for callback checked-record evidence.
 * The byte-level ZIP and GitHub API contract is intentionally shared with
 * the existing checked-record archives.
 *
 * @file
 */
export {
	checkedRecordValueIndexHostedDigest as callbackCheckedRecordHostedDigest
	, checkedRecordValueIndexHostedSafeZipPath as callbackCheckedRecordHostedSafeZipPath
	, extractCheckedRecordValueIndexHostedArtifact as extractCallbackCheckedRecordHostedArtifact
	, inspectCheckedRecordValueIndexHostedArtifact as inspectCallbackCheckedRecordHostedArtifact
	, parseCheckedRecordValueIndexHostedArchiveArgs as parseCallbackCheckedRecordHostedArchiveArgs
	, splitCheckedRecordValueIndexHostedArtifact as splitCallbackCheckedRecordHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
