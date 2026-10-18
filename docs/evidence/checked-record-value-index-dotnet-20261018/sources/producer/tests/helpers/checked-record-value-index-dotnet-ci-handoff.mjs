/**
 * Authenticate original value-index NuGet bytes rather than reported digests.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexDotnetAssembly
} from "./checked-record-value-index-dotnet-package.mjs";
import {
	inspectFinContainerEdgeDotnetArchive
} from "./fin-container-edge-dotnet-closure.mjs";

export const checkedRecordValueIndexDotnetArchivePath
	= "archives/Checkedrecordvalueindices.Api.1.0.0.nupkg";
export const checkedRecordValueIndexDotnetHandoffRecords = Object.freeze([
	"handoff/package-set-receipt.json"
	, "handoff/package-set-receipt.json.sha256"
	, `handoff/${checkedRecordValueIndexDotnetArchivePath}`
]);

/**
 * Authenticate every original archive member and retained managed binary.
 *
 * @param read - Selection-relative original record reader.
 */
export const inspectCheckedRecordValueIndexDotnetCiHandoff = async read => {
	const report = JSON.parse(await read("report.json"));
	const receiptBytes = await read("handoff/package-set-receipt.json");
	const receipt = JSON.parse(receiptBytes);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt)
		, "Canonical package-set receipt");
	assert.deepEqual(receipt, report.receipt
		, "Handoff receipt matches the installed report");
	assert.equal((await read(
		"handoff/package-set-receipt.json.sha256"
	)).toString(), `${sha256(receiptBytes)}  package-set-receipt.json\n`
	, "Package-set receipt sidecar");
	assert.equal(receipt.packages.length, 1, "Exactly one NuGet package");
	const pkg = receipt.packages[0];
	assert.equal(pkg.target, "nuget", "NuGet package target");
	assert.equal(pkg.artifacts.length, 1, "Exactly one NuGet archive");
	const artifact = pkg.artifacts[0];
	assert.equal(artifact.path, checkedRecordValueIndexDotnetArchivePath
		, "Exact value-index NuGet archive path");
	const bytes = await read("handoff/" + artifact.path);
	assert.equal(bytes.length, artifact.bytes, "NuGet archive byte length");
	assert.equal(sha256(bytes), artifact.sha256, "NuGet archive SHA-256");
	const original = inspectFinContainerEdgeDotnetArchive(
		bytes, artifact.sha256
	);
	const nuget = JSON.parse(await read("nuget.json"));
	assert.deepEqual(nuget.archive, artifact
		, "NuGet record binds the package-set artifact");
	const archivedFiles = Object.fromEntries([...original.members].map(
		([path, value]) => [path, {
			bytes: value.length, sha256: sha256(value)
		}]
	));
	assert.deepEqual(nuget.files, archivedFiles
		, "NuGet archive member identities");
	for(const path of nuget.retained)
		assert.deepEqual(await read(`package/${path}`)
			, original.members.get(path), `Retained NuGet member ${path}`);
	const assembly = `${checkedRecordValueIndexDotnetAssembly}.dll`;
	assert.deepEqual(await read(`api-probe/inputs/library/${assembly}`)
		, original.members.get(`lib/net8.0/${assembly}`)
		, "API probe assembly is the archived managed assembly");
	return {
		archiveSha512: createHash("sha512").update(bytes).digest("base64")
		, archiveSha256: sha256(bytes), members: original.members
	};
};
