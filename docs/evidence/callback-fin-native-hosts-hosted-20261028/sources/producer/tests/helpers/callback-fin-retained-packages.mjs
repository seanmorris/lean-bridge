/**
 * Retain the exact ordinary and reviewed package sets installed by callback
 * Fin consumers before their author trees are removed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { rm } from "node:fs/promises";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import {
	copyPackageSetHandoff, retainPackageSetEvidence
} from "./package-set.mjs";
import {
	verifyCallbackCheckedRecordRetainedPackages
} from "./callback-checked-record-retained-packages.mjs";

export const callbackFinRetainedPackagesName = "retained-packages.json";
const routes = Object.freeze(["ordinary", "reviewed"]);

/**
 * Remove stale retained bytes before a producer lane starts.
 *
 * @param output - Absolute report path.
 */
export const clearCallbackFinRetainedPackages = async output => {
	await rm(join(dirname(output), "evidence"), { recursive: true, force: true });
	await rm(join(dirname(output), callbackFinRetainedPackagesName), { force: true });
};

/**
 * Retain one receipt-closed package set and copy its installation handoff.
 *
 * @param root0 - Retention inputs.
 * @param root0.output - Absolute report path.
 * @param root0.route - Ordinary or reviewed route.
 * @param root0.source - Producer release root.
 * @param root0.handoff - New consumer handoff root.
 */
export const retainCallbackFinRoute = async ({ output, route, source, handoff }) => {
	assert.ok(routes.includes(route), route);
	const path = `evidence/${route}/handoff`;
	const retained = await retainPackageSetEvidence(source, join(dirname(output), path));
	const receipt = await copyPackageSetHandoff(join(dirname(output), path), handoff);
	assert.deepEqual(receipt, retained.receipt);
	return {
		receipt
		, entry: {
			route, path, receiptSha256: retained.receiptSha256
			, archives: retained.archives, archiveBytes: retained.archiveBytes
			, files: retained.files
		}
	};
};

/**
 * Bind both retained route receipts to the lane output.
 *
 * @param output - Absolute report path.
 * @param entries - Retained route records.
 */
export const writeCallbackFinRetainedPackages = (output, entries) =>
	saveLakeFile(dirname(output), callbackFinRetainedPackagesName, canonicalJson({
		schemaVersion: 1
		, routes: entries.toSorted((left, right) => left.route.localeCompare(right.route))
	}));

/**
 * Verify every receipt-named retained byte and bind it to the route reports.
 * The retention schema is shared with the directional checked-record lanes.
 *
 * @param outputRoot - Directory containing the report and retained evidence.
 * @param report - Parsed callback Fin language report.
 */
export const verifyCallbackFinRetainedPackages = (outputRoot, report) =>
	verifyCallbackCheckedRecordRetainedPackages(outputRoot, report);
