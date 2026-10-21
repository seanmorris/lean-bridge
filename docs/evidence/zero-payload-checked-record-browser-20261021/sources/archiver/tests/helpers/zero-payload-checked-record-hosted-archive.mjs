/**
 * Authenticate and unpack one original hosted zero-payload browser artifact.
 *
 * The byte-level GitHub artifact rules are shared with the value-index browser
 * lane.  Exporting names local to this lane keeps callers explicit while the
 * common implementation continues to receive its existing destructive tests.
 *
 * @file
 */
export {
	checkedRecordValueIndexHostedDigest as zeroPayloadHostedDigest
	, checkedRecordValueIndexHostedSafeZipPath as zeroPayloadHostedSafeZipPath
	, extractCheckedRecordValueIndexHostedArtifact as extractZeroPayloadHostedArtifact
	, inspectCheckedRecordValueIndexHostedArtifact as inspectZeroPayloadHostedArtifact
	, parseCheckedRecordValueIndexHostedArchiveArgs as parseZeroPayloadHostedArchiveArgs
	, splitCheckedRecordValueIndexHostedArtifact as splitZeroPayloadHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
