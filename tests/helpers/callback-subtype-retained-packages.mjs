/**
 * Retain the exact receipt-named callback Subtype packages that installed
 * consumers execute, and verify them beside the lane report.
 *
 * Each route's package set is retained under `evidence/<route>/handoff` next
 * to the report before any consumer installs it, and the installation
 * handoff is copied from that retained set. `retained-packages.json` records
 * the retained receipt identity per route; it is evidence bookkeeping and is
 * kept out of the semantic report.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	packageSetReceiptName, readVerifiedPackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import {
	copyPackageSetHandoff, retainPackageSetEvidence
} from "./package-set.mjs";

export const callbackSubtypeRetainedPackagesName = "retained-packages.json";
const routes = Object.freeze(["ordinary", "reviewed"]);

const regularFiles = async (root, prefix = "") => {
	const files = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		const information = await lstat(join(root, path));
		if(information.isDirectory())
		{
			const nested = await regularFiles(root, path);
			assert.ok(nested.length > 0
				, `Retained packages must not contain empty directories: ${path}`);
			files.push(...nested);
		}
		else
		{
			assert.ok(information.isFile(), `Retained packages must be regular: ${path}`);
			files.push(path);
		}
	}
	return files.toSorted();
};

/**
 * Remove stale retained packages before a lane writes its report.
 *
 * @param output - Absolute report path; evidence lives beside it.
 */
export const clearCallbackSubtypeRetainedPackages = async output => {
	await rm(join(dirname(output), "evidence"), { recursive: true, force: true });
	await rm(join(dirname(output), callbackSubtypeRetainedPackagesName)
		, { force: true });
};

/**
 * Retain one route's package set, then derive its installation handoff.
 *
 * @param options - Retention inputs.
 * @param options.output - Absolute report path; evidence lives beside it.
 * @param options.route - Author route.
 * @param options.source - Producer release root containing the receipt.
 * @param options.handoff - New installation handoff directory.
 */
export const retainCallbackSubtypeRoute = async ({
	output, route, source, handoff
}) => {
	assert.ok(routes.includes(route), route);
	const path = `evidence/${route}/handoff`;
	const retained = await retainPackageSetEvidence(source
		, join(dirname(output), path));
	const receipt = await copyPackageSetHandoff(join(dirname(output), path)
		, handoff);
	assert.deepEqual(receipt, retained.receipt);
	const entry = { route, path, receiptSha256: retained.receiptSha256
		, archives: retained.archives, archiveBytes: retained.archiveBytes
		, files: retained.files };
	return { receipt, entry };
};

/**
 * Record the retained receipt identity for every route beside the report.
 *
 * @param output - Absolute report path.
 * @param entries - Retained route entries.
 */
export const writeCallbackSubtypeRetainedPackages = (output, entries) =>
	saveLakeFile(dirname(output), callbackSubtypeRetainedPackagesName
		, canonicalJson({ schemaVersion: 1
			, routes: entries.toSorted((left, right) =>
				left.route.localeCompare(right.route)) }));

/**
 * Verify every retained package byte and bind it to the lane report.
 *
 * @param outputRoot - Directory containing the report and its evidence.
 * @param report - Parsed canonical lane report.
 */
export const verifyCallbackSubtypeRetainedPackages = async (
	outputRoot, report
) => {
	const bytes = await readFile(join(outputRoot
		, callbackSubtypeRetainedPackagesName));
	const retained = JSON.parse(bytes);
	assert.equal(bytes.toString("utf8"), canonicalJson(retained)
		, "Retained package record must be canonical");
	assert.deepEqual(Object.keys(retained).toSorted(), ["routes", "schemaVersion"]);
	assert.equal(retained.schemaVersion, 1);
	assert.deepEqual(retained.routes.map(entry => entry.route), routes);
	const evidence = [], summary = [];
	for(const entry of retained.routes)
	{
		assert.deepEqual(Object.keys(entry).toSorted(), ["archiveBytes", "archives"
			, "files", "path", "receiptSha256", "route"]);
		assert.equal(entry.path, `evidence/${entry.route}/handoff`);
		const root = join(outputRoot, entry.path);
		const { receipt, result } = await readVerifiedPackageSetReceipt({
			receiptPath: join(root, packageSetReceiptName) });
		const artifacts = receipt.packages.flatMap(pkg => pkg.artifacts);
		const files = [packageSetReceiptName, `${packageSetReceiptName}.sha256`
			, ...artifacts.map(artifact => artifact.path)].toSorted();
		assert.deepEqual(await regularFiles(root), files
			, `${entry.route}: retained packages must be exactly the receipt-named set`);
		const archiveBytes = artifacts.reduce((total, artifact) =>
			total + artifact.bytes, 0);
		assert.deepEqual(entry, { route: entry.route, path: entry.path
			, receiptSha256: result.receiptSha256, archives: result.archives
			, archiveBytes, files }, `${entry.route}: retained package metadata`);
		const items = report.reports.filter(item => item.route === entry.route);
		assert.ok(items.length > 0, `${entry.route}: report covers the route`);
		for(const item of items)
		{
			if(Object.hasOwn(item, "packages"))
				assert.deepEqual(item.packages, receipt.packages
					, `${entry.route}: reported packages are the retained set`);
			else assert.equal(item.receiptSha256, result.receiptSha256
				, `${entry.route}: reported receipt is the retained receipt`);
		}
		evidence.push(...files.map(file => `${entry.route}/handoff/${file}`));
		summary.push({ route: entry.route, receiptSha256: result.receiptSha256
			, archives: result.archives, archiveBytes });
	}
	assert.deepEqual(await regularFiles(join(outputRoot, "evidence"))
		, evidence.toSorted(), "Retained evidence must contain only route package sets");
	return { schemaVersion: 1, routes: summary };
};
