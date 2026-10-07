/**
 * Exact archived runs eligible for reviewed scalar/container Fin promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";

export const reviewedFinNativeProfiles = Object.freeze(["python", "rust", "dotnet", "java", "kotlin", "php-native", "ruby", "wit-wasi", "perl"]);
export const reviewedFinNpmProfiles = Object.freeze(["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"]);
const groups = [
	["reviewed-fin-hosts", "containers", "reviewed-fin-host-evidence-tests.mjs"]
	, ["reviewed-scalar-hosts", "scalar", "reviewed-scalar-host-evidence-tests.mjs"]
	, ["reviewed-scalar-rollout", "scalar", "reviewed-scalar-rollout-evidence-tests.mjs"]
	, ["reviewed-perl-scalar", "scalar", "reviewed-perl-scalar-evidence-tests.mjs"]
	, ["reviewed-perl-containers", "containers", "reviewed-perl-container-evidence-tests.mjs"]
	, ["reviewed-fin-npm", "npm", "reviewed-fin-wasm-evidence-tests.mjs"]
];

/** Read original receipts and verify the original report bytes before describing their coverage. */
export const reviewedFinPromotionReferences = async () => {
	const references = [];
	for(const [group, kind, validator] of groups)
	{
		const receiptPath = `docs/evidence/${group}-20261007/receipt.json`;
		const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
		assert.equal(receipt.planNode, 1438);
		assert.equal(receipt.execution, "local");
		const runs = receipt.reports ?? receipt.runs ?? [{ report: receipt.report }];
		for(const run of runs)
		{
			const reference = run.report ?? run;
			const bytes = await readFile(reference.path);
			assert.equal(sha256(bytes), reference.sha256, reference.path);
			const report = JSON.parse(bytes);
			assert.equal(report.reproducible, true);
			const id = `${group}-${basename(reference.path, ".json").replaceAll(".", "-")}-installed`;
			const profiles = kind === "npm" ? [...reviewedFinNpmProfiles] : [...new Set(report.reports.map(item => item.profile))];
			const sourcePath = kind === "npm" ? report.path : "reviewed-ir";
			if(kind !== "npm") for(const item of report.reports)
			{
				assert.equal(item.path, sourcePath);
				assert.equal(item.sourceRemovedBeforeInstallation, true);
			}
			const artifacts = kind === "npm" ? [report.receipt.package, report.receipt.runtime].map(item => ({ path: item.archive, sha256: item.sha256 }))
				: Object.entries(report.archives).map(([path, sha256]) => ({ path, sha256 }));
			references.push({ id, kind: kind === "npm" ? report.selection : kind
				, npm: kind === "npm", profiles, sourcePath
				, revision: run.revision ?? receipt.revision
				, command: run.reproduceCommand ?? run.command ?? receipt.command
				, receiptPath, reportPath: reference.path, reportSha256: reference.sha256
				, validator: `tests/helpers/${validator}`, artifacts, report });
		}
	}
	return references;
};
