/**
 * Report every stale, missing or conflicting current-source pin of the type
 * inventory in one pass, before a publication audit stops at its first cell.
 * Immutable archives under docs/evidence keep their own verifiers; this
 * preflight never writes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "./dependent-checked-record-promotion.mjs";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const short = value => value === null ? "absent" : value.slice(0, 12);

/**
 * Select every pinned current source: live repository paths the inventory
 * cites that are not immutable archives.
 *
 * @param inventory - Parsed type-surface inventory.
 */
export const currentSourcePinCohort = inventory =>
	dependentCheckedRecordPromotionCurrentSourcePaths(inventory
		, inventory.evidence.flatMap(evidence => evidence.files.map(file => file.path))).sort();

/**
 * Audit the complete cohort, or an exact subset of it, against live bytes.
 * Every finding is collected; nothing stops at the first mismatch.
 *
 * @param inventory - Parsed type-surface inventory.
 * @param options - Audit location.
 * @param options.repository - Repository root holding the live sources.
 * @param options.paths - Optional exact subset of cohort paths.
 * @returns {Promise<object>} Cohort size, pin occurrences and sorted findings,
 * each naming its kind (stale, missing or conflicting), pin count, expected
 * and live digests and the evidence records that cite it.
 */
export const auditCurrentSourcePins = async (inventory, { repository = process.cwd(), paths = null } = {}) => {
	const cohort = currentSourcePinCohort(inventory);
	const selected = paths === null ? cohort : [...new Set(paths)].sort();
	assert.deepEqual(selected.filter(item => !cohort.includes(item)), []
		, "Every selected path must be a pinned current source");
	const references = new Map(selected.map(item =>
		[item, { path: item, pins: 0, expectedSha256: new Set(), evidenceIds: new Set() }]));
	for(const evidence of inventory.evidence)
		for(const file of evidence.files)
		{
			const entry = references.get(file.path);
			if(entry === undefined) continue;
			entry.pins++;
			entry.expectedSha256.add(file.sha256);
			entry.evidenceIds.add(evidence.id);
		}
	const entries = [...references.values()], findings = [];
	let next = 0;
	const worker = async () => {
		while(next < entries.length)
		{
			const entry = entries[next++];
			let actualSha256 = null;
			try
			{
				actualSha256 = digest(await readFile(path.join(repository, entry.path)));
			}
			catch(error)
			{
				if(error.code !== "ENOENT") throw error;
			}
			const expectedSha256 = [...entry.expectedSha256].sort();
			const kind = actualSha256 === null ? "missing"
				: expectedSha256.length > 1 ? "conflicting"
					: expectedSha256[0] === actualSha256 ? null : "stale";
			if(kind === null) continue;
			findings.push({
				path: entry.path, kind, pins: entry.pins
				, expectedSha256, actualSha256
				, evidenceIds: [...entry.evidenceIds].sort()
			});
		}
	};
	await Promise.all(Array.from({ length: 32 }, worker));
	findings.sort((left, right) => left.path.localeCompare(right.path));
	return {
		cohort: selected.length
		, occurrences: entries.reduce((sum, entry) => sum + entry.pins, 0)
		, findings
	};
};

/**
 * Count what a current-source refresh of the findings would rewrite, through
 * the same reconciliation the refresh scripts use, without writing anything.
 * Missing sources have no live digest and are never counted.
 *
 * @param inventory - Parsed type-surface inventory.
 * @param report - Result of auditCurrentSourcePins.
 */
export const previewCurrentSourcePinRefresh = (inventory, report) => {
	const digests = new Map(report.findings
		.filter(finding => finding.actualSha256 !== null)
		.map(finding => [finding.path, finding.actualSha256]));
	if(digests.size === 0) return { paths: 0, refreshed: 0 };
	const { refreshed } = reconcileDependentCheckedRecordSourcePins(inventory, digests);
	return { paths: digests.size, refreshed };
};

/**
 * Render one line per finding and one summary line.
 *
 * @param report - Result of auditCurrentSourcePins.
 * @param preview - Result of previewCurrentSourcePinRefresh.
 */
export const formatCurrentSourcePinPreflight = (report, preview) => {
	const lines = report.findings.map(finding => {
		const ids = finding.evidenceIds.slice(0, 3).join(", ")
			+ (finding.evidenceIds.length > 3 ? ` (+${finding.evidenceIds.length - 3})` : "");
		return `${finding.kind} ${finding.path}: ${finding.pins} pin(s) in ${finding.evidenceIds.length} record(s);`
			+ ` expected ${finding.expectedSha256.map(short).join("|")}, live ${short(finding.actualSha256)}; ${ids}`;
	});
	const count = kind => report.findings.filter(finding => finding.kind === kind).length;
	lines.push(`Current-source pin preflight: ${report.cohort} cohort path(s), ${report.occurrences} pin occurrence(s),`
		+ ` ${report.findings.length} finding(s) (${count("stale")} stale, ${count("missing")} missing,`
		+ ` ${count("conflicting")} conflicting); a refresh would rewrite ${preview.refreshed} pin(s) across ${preview.paths} path(s).`);
	return lines.join("\n");
};
