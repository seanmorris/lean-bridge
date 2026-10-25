/**
 * Replay original hosted owned-Subtype npm packages and their installed TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { parseOwnedCheckedRecordTap } from "./owned-checked-record-hosted-output.mjs";
import { ownedSubtypeHostedContracts } from "./owned-subtype-hosted-contracts.mjs";
import { verifyOwnedSubtypeJavaScriptEvidence } from "./owned-subtype-javascript-evidence.mjs";
import { ownedSubtypeRetainedPackagesName } from "./owned-subtype-retained-packages.mjs";

export const ownedSubtypeJavaScriptInstalledTests = Object.freeze([
	"JavaScript compiler inputs reproduce, relocate and retain empty target headers"
	, "JavaScript header bundles reject changed pins, headers, inventories and links"
	, "ordinary owned npm dispatch preserves explicit tools and cache choices"
	, "reviewed owned npm dispatch preserves explicit tools and cache choices"
	, "installed CLI builds ordinary and reviewed owned npm packages from bundled headers"
	, "owned JavaScript ordinary compilation executes checked source in the production heap"
	, "owned JavaScript reviewed compilation executes checked source in the production heap"
	, "the owned JavaScript compiled profile binds typed carriers to the exact wasm32 control ABI"
	, "owned JavaScript receipts reconstruct every private adapter without linking a second broker"
	, "owned JavaScript generation rejects altered widths, capabilities, metadata and carriers"
	, "installed ordinary owned Subtypes execute from source-free npm archives"
	, "installed reviewed owned Subtypes execute from source-free npm archives"
]);

const regularFiles = async (root, prefix = "") => {
	const files = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		const info = await lstat(join(root, path));
		if(info.isDirectory()) files.push(...await regularFiles(root, path));
		else
		{
			assert.ok(info.isFile(), `Hosted npm evidence must be regular: ${path}`);
			files.push(path);
		}
	}
	return files.toSorted();
};

/**
 * Verify the source-free installed report without trusting its CI summary.
 *
 * @param root - Extracted original artifact or retained output root.
 * @param producer - Exact authenticated producer revision.
 */
export const replayOwnedSubtypeJavaScriptHostedOutput = async (root, producer) => {
	assert.match(producer, /^[a-f0-9]{40}$/u);
	const contract = ownedSubtypeHostedContracts.javascript;
	const packaging = join(root, contract.packaging);
	const reportPath = join(packaging, contract.report);
	const accepted = await verifyOwnedSubtypeJavaScriptEvidence(reportPath);
	const tapBytes = await readFile(join(root, contract.tap));
	const tap = parseOwnedCheckedRecordTap(tapBytes.toString("utf8"));
	assert.deepEqual(tap.tests, ownedSubtypeJavaScriptInstalledTests
		, "Hosted npm TAP must contain all twelve installed tests in order");
	const verificationBytes = await readFile(join(packaging, "verification.json"));
	assert.equal(verificationBytes.toString("utf8"), canonicalJson(accepted)
		, "Hosted npm verification must equal independent package replay");
	const retained = JSON.parse(await readFile(join(packaging, ownedSubtypeRetainedPackagesName)));
	const members = [contract.report, "verification.json", ownedSubtypeRetainedPackagesName];
	for(const route of retained.routes)
		members.push(...route.files.map(file => `${route.path}/${file}`));
	assert.deepEqual(await regularFiles(packaging), members.toSorted()
		, "Hosted npm evidence must contain exactly its retained package set");
	return {
		schemaVersion: 1, kind: "owned-subtype-hosted-replay", lane: "javascript"
		, profiles: contract.profiles, producerCommit: producer
		, reportSha256: accepted.reportSha256
		, acceptanceLogSha256: sha256(tapBytes), tests: tap.tests.length, accepted
	};
};
