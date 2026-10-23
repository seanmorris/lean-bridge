/**
 * Retain and verify the exact owned Subtype package sets installed by each
 * ordinary/reviewed acceptance route.
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

export const ownedSubtypeRetainedPackagesName = "retained-packages.json";
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
			assert.ok(information.isFile()
				, `Retained packages must be regular files: ${path}`);
			files.push(path);
		}
	}
	return files.toSorted();
};

/**
 * Remove stale retained artifacts before a selected lane runs.
 *
 * @param output - Absolute semantic report path.
 */
export const clearOwnedSubtypeRetainedPackages = async output => {
	await rm(join(dirname(output), "evidence"), { recursive: true, force: true });
	await rm(join(dirname(output), ownedSubtypeRetainedPackagesName)
		, { force: true });
};

/**
 * Retain one producer package set and derive the consumer handoff from it.
 *
 * @param root0 - Retention inputs.
 * @param root0.output - Absolute semantic report path.
 * @param root0.route - Ordinary or reviewed author route.
 * @param root0.source - Producer release root.
 * @param root0.handoff - Fresh consumer handoff path.
 */
export const retainOwnedSubtypeRoute = async ({
	output, route, source, handoff
}) => {
	assert.ok(routes.includes(route), route);
	const path = `evidence/${route}/handoff`;
	const retained = await retainPackageSetEvidence(source
		, join(dirname(output), path));
	const receipt = await copyPackageSetHandoff(join(dirname(output), path)
		, handoff);
	assert.deepEqual(receipt, retained.receipt);
	return { receipt
		, entry: {
			route, path, receiptSha256: retained.receiptSha256
			, archives: retained.archives, archiveBytes: retained.archiveBytes
			, files: retained.files
		}
	};
};

/**
 * Write the exact two-route retention inventory beside a lane report.
 *
 * @param output - Absolute semantic report path.
 * @param entries - Route retention records.
 */
export const writeOwnedSubtypeRetainedPackages = (output, entries) =>
	saveLakeFile(dirname(output), ownedSubtypeRetainedPackagesName
		, canonicalJson({ schemaVersion: 1
			, routes: entries.toSorted((left, right) =>
				left.route.localeCompare(right.route)) }));

const reportRoute = item => item.route
	?? (typeof item.reviewed === "boolean"
		? item.reviewed ? "reviewed" : "ordinary" : null);

/**
 * Authenticate every retained byte and bind it to the semantic report.
 *
 * @param outputRoot - Directory containing the report and retained evidence.
 * @param report - Parsed owned Subtype lane report.
 */
export const verifyOwnedSubtypeRetainedPackages = async (
	outputRoot, report
) => {
	const bytes = await readFile(join(outputRoot
		, ownedSubtypeRetainedPackagesName));
	const retained = JSON.parse(bytes);
	assert.equal(bytes.toString("utf8"), canonicalJson(retained)
		, "Retained package record must be canonical");
	assert.deepEqual(Object.keys(retained).toSorted()
		, ["routes", "schemaVersion"]);
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
			, `${entry.route}: retain exactly the receipt-named package set`);
		const archiveBytes = artifacts.reduce((total, artifact) =>
			total + artifact.bytes, 0);
		assert.deepEqual(entry, {
			route: entry.route, path: entry.path
			, receiptSha256: result.receiptSha256, archives: result.archives
			, archiveBytes, files
		}, `${entry.route}: retained package metadata`);
		const reports = report.reports.filter(item =>
			reportRoute(item) === entry.route);
		assert.ok(reports.length > 0, `${entry.route}: report covers the route`);
		for(const item of reports)
		{
			if(item.packageSetReceipt !== undefined)
				assert.deepEqual(item.packageSetReceipt, receipt
					, `${entry.route}: report contains the retained receipt`);
			else assert.equal(item.packageSetReceiptSha256
				, result.receiptSha256
				, `${entry.route}: report names the retained receipt`);
		}
		evidence.push(...files.map(file =>
			`${entry.route}/handoff/${file}`));
		summary.push({ route: entry.route
			, receiptSha256: result.receiptSha256
			, archives: result.archives, archiveBytes });
	}
	assert.deepEqual(await regularFiles(join(outputRoot, "evidence"))
		, evidence.toSorted()
		, "Retained evidence must contain only the two route package sets");
	return { schemaVersion: 1, routes: summary };
};
