/**
 * Independently replay one complete hosted owned-Subtype artifact tree.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	ownedSubtypeHostedVerification
} from "./owned-subtype-hosted-ci.mjs";
import {
	ownedSubtypeHostedContracts, ownedSubtypeHostedLaneNames
} from "./owned-subtype-hosted-contracts.mjs";
import {
	ownedSubtypeRetainedPackagesName, verifyOwnedSubtypeRetainedPackages
} from "./owned-subtype-retained-packages.mjs";
import { replayOwnedSubtypeJavaScriptHostedOutput } from "./owned-subtype-javascript-hosted-output.mjs";

const regularFiles = async (root, prefix = "") => {
	const files = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		const information = await lstat(join(root, path));
		if(information.isDirectory()) files.push(...await regularFiles(root, path));
		else
		{
			assert.ok(information.isFile(), `Hosted output must be regular: ${path}`);
			files.push(path);
		}
	}
	return files.toSorted();
};

/**
 * Replay a hosted output without trusting its in-job verification receipt.
 *
 * @param lane - Closed hosted lane name.
 * @param root - Extracted artifact root.
 * @param producer - Exact producer commit.
 */
export const replayOwnedSubtypeHostedOutput = async (
	lane, root, producer
) => {
	assert.ok(ownedSubtypeHostedLaneNames.includes(lane), lane);
	assert.match(producer, /^[a-f0-9]{40}$/u);
	if(lane === "javascript")
		return replayOwnedSubtypeJavaScriptHostedOutput(root, producer);
	const contract = ownedSubtypeHostedContracts[lane];
	const reportPath = `${contract.packaging}/${contract.report}`;
	const reportBytes = await readFile(join(root, reportPath));
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString("utf8"), canonicalJson(report)
		, "Owned Subtype report must be canonical");
	const tap = await readFile(join(root, contract.tap), "utf8");
	const retained = await verifyOwnedSubtypeRetainedPackages(
		join(root, contract.packaging), report);
	const accepted = {
		...ownedSubtypeHostedVerification(lane, producer, tap, report)
		, retainedPackages: retained
	};
	const verificationPath = `${contract.packaging}/verification.json`;
	const verificationBytes = await readFile(join(root, verificationPath));
	const verification = JSON.parse(verificationBytes);
	assert.equal(verificationBytes.toString("utf8"), canonicalJson(verification)
		, "Hosted verification receipt must be canonical");
	assert.deepEqual(verification, accepted
		, "Hosted verification receipt must equal independent replay");
	const retainedRecord = JSON.parse(await readFile(join(root
		, contract.packaging, ownedSubtypeRetainedPackagesName), "utf8"));
	const members = [contract.tap, contract.toolchain, reportPath
		, verificationPath
		, `${contract.packaging}/${ownedSubtypeRetainedPackagesName}`];
	for(const entry of retainedRecord.routes)
		members.push(...entry.files.map(file =>
			`${contract.packaging}/${entry.path}/${file}`));
	assert.deepEqual(await regularFiles(root), members.toSorted()
		, "Hosted artifact must contain only logs, reports and retained packages");
	return {
		schemaVersion: 1, kind: "owned-subtype-hosted-replay", lane
		, profiles: contract.profiles, producerCommit: producer
		, reportSha256: sha256(reportBytes)
		, acceptanceLogSha256: sha256(Buffer.from(tap))
		, accepted
	};
};
