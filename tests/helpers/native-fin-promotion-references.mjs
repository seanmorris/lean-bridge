/**
 * Keep product and nominal Fin promotions tied to their original C/C++ runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";

const groups = [
	["native-fin-products", "products", "fin-product-evidence-tests.mjs"]
	, ["native-fin-product-arrays", "arrays", "fin-product-array-evidence-tests.mjs"]
	, ["native-fin-product-array-dispatch", "array-dispatch", "fin-product-array-dispatch-evidence-tests.mjs"]
	, ["native-fin-records", "fields", "fin-record-evidence-tests.mjs"]
];

/** Read original reports without treating a later fixture rename as another execution. */
export const nativeFinPromotionReferences = async () => {
	const references = [];
	for(const [group, kind, validator] of groups)
	{
		const receiptPath = `docs/evidence/${group}-20261007/receipt.json`;
		const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
		assert.equal(receipt.execution, "local");
		assert.equal(receipt.planNode, kind === "fields" ? 1442 : 1441);
		for(const run of receipt.reports ?? receipt.runs)
		{
			const reference = run.report ?? run;
			const bytes = await readFile(reference.path);
			assert.equal(sha256(bytes), reference.sha256, reference.path);
			const report = JSON.parse(bytes);
			assert.equal(report.reproducible, true);
			assert.deepEqual(report.reports.map(item => item.profile), ["c", "cpp"]);
			for(const item of report.reports)
			{
				assert.equal(item.path, run.sourcePath);
				for(const flag of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"])
					assert.equal(item[flag], true, flag);
			}
			references.push({ id: `${group}-${run.id}-installed`, kind
				, sourcePath: run.sourcePath
				, revision: run.revision ?? receipt.revision
				, command: run.reproduceCommand ?? run.command
				, receiptPath, reportPath: reference.path, reportSha256: reference.sha256
				, validator: `tests/helpers/${validator}`
				, artifacts: Object.entries(report.archives).map(([path, sha256]) => ({ path, sha256 })) });
		}
	}
	return references;
};
