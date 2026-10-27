/**
 * Audit immutable archive files referenced by the public type inventory.
 * Archive bytes are authoritative only when their own retained index records
 * the same digest; this helper never infers an archive pin from a live source.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const archivePattern = /^(docs\/evidence\/[^/]+)\/(.+)$/u;
const shaPattern = /^[a-f0-9]{64}$/u;

const collectIndexPins = (value, pins = new Map()) => {
	if(Array.isArray(value))
	{
		for(const item of value) collectIndexPins(item, pins);
		return pins;
	}
	if(value === null || typeof value !== "object") return pins;
	if(typeof value.path === "string" && shaPattern.test(value.sha256 ?? ""))
	{
		const values = pins.get(value.path) ?? new Set();
		values.add(value.sha256);
		pins.set(value.path, values);
	}
	for(const item of Object.values(value)) collectIndexPins(item, pins);
	return pins;
};

/**
 * Find inventory pins that disagree with retained archive bytes.
 *
 * @param {object} inventory - Parsed type-surface inventory.
 * @param {object} options - Audit location.
 * @param {string} options.repository - Repository root.
 * @param {string[]} [options.paths] - Optional exact archive subset.
 * @param {Map<string, string>} [options.authenticatedFiles] - Exact live
 * path/digest pairs from a completed type-surface byte or receipt pass.
 * @returns {Promise<object[]>} Unique mismatched archive paths.
 */
export const auditTypeSurfaceArchivePins = async (
	inventory, {
		repository = process.cwd(), paths = null, authenticatedFiles = null
	} = {}
) => {
	assert.ok(authenticatedFiles === null
		|| authenticatedFiles instanceof Map);
	const selected = paths === null ? null : new Set(paths);
	const references = new Map();
	for(const evidence of inventory.evidence)
		for(const file of evidence.files)
		{
			const match = archivePattern.exec(file.path);
			if(match === null || (selected !== null
				&& !selected.has(file.path))) continue;
			const entry = references.get(file.path) ?? {
				path: file.path, archiveRoot: match[1], archivePath: match[2]
				, expectedSha256: new Set(), evidenceIds: new Set()
			};
			entry.expectedSha256.add(file.sha256);
			entry.evidenceIds.add(evidence.id);
			references.set(file.path, entry);
		}
	if(selected !== null) assert.deepEqual(
		[...references.keys()].sort(), [...selected].sort()
		, "Every selected archive path must be inventory-pinned");
	const indexes = new Map(), mismatches = [];
	let next = 0;
	const entries = [...references.values()];
	const worker = async () => {
		while(next < entries.length)
		{
			const entry = entries[next++];
			const actualSha256 = authenticatedFiles?.get(entry.path)
				?? digest(await readFile(path.join(repository, entry.path)));
			if(entry.expectedSha256.size === 1
				&& entry.expectedSha256.has(actualSha256)) continue;
			let pins = indexes.get(entry.archiveRoot);
			if(pins === undefined)
			{
				const index = JSON.parse(await readFile(path.join(repository
					, entry.archiveRoot, "index.json"), "utf8"));
				pins = collectIndexPins(index);
				indexes.set(entry.archiveRoot, pins);
			}
			mismatches.push({
				path: entry.path, archiveRoot: entry.archiveRoot
				, archivePath: entry.archivePath
				, expectedSha256: [...entry.expectedSha256].sort()
				, actualSha256
				, evidenceIds: [...entry.evidenceIds].sort()
				, authenticatedByIndex:
					pins.get(entry.archivePath)?.has(actualSha256) === true
			});
		}
	};
	await Promise.all(Array.from({ length: 32 }, worker));
	return mismatches.sort((left, right) =>
		left.path.localeCompare(right.path));
};

/**
 * Reconcile only archive mismatches authenticated by their retained indices.
 *
 * @param {object} original - Parsed type-surface inventory.
 * @param {object[]} mismatches - Result of auditTypeSurfaceArchivePins.
 */
export const reconcileTypeSurfaceArchivePins = (original, mismatches) => {
	assert.ok(Array.isArray(mismatches) && mismatches.length > 0);
	assert.ok(mismatches.every(item => item.authenticatedByIndex)
		, "Every archive repair must be authenticated by its retained index");
	const repairs = new Map(mismatches.map(item =>
		[item.path, item.actualSha256]));
	assert.equal(repairs.size, mismatches.length
		, "Archive repair paths must be unique");
	const inventory = structuredClone(original);
	let repairedReferences = 0;
	for(const evidence of inventory.evidence)
		for(const file of evidence.files)
		{
			const sha256 = repairs.get(file.path);
			if(sha256 === undefined || file.sha256 === sha256) continue;
			file.sha256 = sha256;
			repairedReferences++;
		}
	assert.ok(repairedReferences >= repairs.size);
	return {
		inventory, repairedPaths: repairs.size, repairedReferences
	};
};
