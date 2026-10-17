/**
 * Read original NuGet bytes, not a self-reported archive checksum supplement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { inspectFinContainerEdgeDotnetArchive } from "./fin-container-edge-dotnet-closure.mjs";
import { inheritedCheckedRecordDotnetAssembly } from "./inherited-checked-record-dotnet-package.mjs";

/**
 * Authenticate every original archive member and match retained managed bytes.
 *
 * @param read - Selection-relative original record and handoff reader.
 */
export const inspectInheritedCheckedRecordDotnetCiHandoff = async read => {
	const report = JSON.parse(await read("report.json"));
	const receiptBytes = await read("handoff/package-set-receipt.json"), receipt = JSON.parse(receiptBytes);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.deepEqual(receipt, report.receipt);
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString(), `${sha256(receiptBytes)}  package-set-receipt.json\n`);
	assert.equal(receipt.packages.length, 1); const pkg = receipt.packages[0];
	assert.equal(pkg.target, "nuget"); assert.equal(pkg.artifacts.length, 1);
	const artifact = pkg.artifacts[0];
	assert.equal(artifact.path, "archives/Inheritedcheckedrecords.Api.1.0.0.nupkg");
	const bytes = await read("handoff/" + artifact.path);
	assert.equal(bytes.length, artifact.bytes);
	const original = inspectFinContainerEdgeDotnetArchive(bytes, artifact.sha256);
	const nuget = JSON.parse(await read("nuget.json"));
	assert.deepEqual(nuget.archive, artifact);
	assert.deepEqual(nuget.files, Object.fromEntries([...original.members]
		.map(([path, value]) => [path, { bytes: value.length, sha256: sha256(value) }])));
	for(const path of nuget.retained)
		assert.deepEqual(await read("package/" + path), original.members.get(path), path);
	const assembly = `${inheritedCheckedRecordDotnetAssembly}.dll`;
	assert.deepEqual(await read(`api-probe/inputs/library/${assembly}`), original.members.get(`lib/net8.0/${assembly}`));
	return { archiveSha512: createHash("sha512").update(bytes).digest("base64")
		, archiveSha256: sha256(bytes), members: original.members };
};
