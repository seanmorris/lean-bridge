/**
 * Shared hosted-artifact primitives for dependent checked-record evidence.
 * The byte-level ZIP and GitHub API contract is independent of the fixture.
 *
 * @file
 */
export {
	checkedRecordValueIndexHostedDigest as dependentCheckedRecordHostedDigest
	, checkedRecordValueIndexHostedSafeZipPath as dependentCheckedRecordHostedSafeZipPath
	, extractCheckedRecordValueIndexHostedArtifact as extractDependentCheckedRecordHostedArtifact
	, inspectCheckedRecordValueIndexHostedArtifact as inspectDependentCheckedRecordHostedArtifact
	, parseCheckedRecordValueIndexHostedArchiveArgs as parseDependentCheckedRecordHostedArchiveArgs
	, splitCheckedRecordValueIndexHostedArtifact as splitDependentCheckedRecordHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
