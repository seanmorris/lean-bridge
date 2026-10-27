/**
 * Reuse the authenticated live type-surface pass while checking historical
 * inventories. Immutable files whose historical digest still equals the live
 * digest need no second read; changed files are reconstructed from their
 * current bytes by the caller's exact source-history reader.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface } from "../../src/adoption/type-surface.mjs";
import {
	typeSurfaceEvidenceFiles
} from "../../src/adoption/type-surface-evidence-receipt.mjs";

let authenticated;

/** Return exact live path/digest pairs after the normal byte or receipt pass. */
export const authenticatedTypeSurfaceEvidence = async () => {
	authenticated ??= readTypeSurface().then(({ document }) => new Map(
		typeSurfaceEvidenceFiles(document).map(file => [file.path, file.sha256])
	));
	return authenticated;
};

/**
 * Authenticate every file cited by one historical inventory.
 *
 * @param document - Historical type-surface inventory.
 * @param historicalBytes - Exact source-history decoder.
 */
export const assertHistoricalTypeSurfaceEvidence = async (
	document, historicalBytes
) => {
	assert.equal(typeof historicalBytes, "function");
	const live = await authenticatedTypeSurfaceEvidence();
	const checked = new Map();
	for(const file of typeSurfaceEvidenceFiles(document))
	{
		const key = `${file.path}:${file.sha256}`;
		let actual = checked.get(key);
		if(actual === undefined)
		{
			actual = live.get(file.path) === file.sha256 ? file.sha256
				: sha256(await historicalBytes(
					file.path, await readFile(file.path), file.sha256
				));
			checked.set(key, actual);
		}
		assert.equal(actual, file.sha256, file.path);
	}
	return checked.size;
};
