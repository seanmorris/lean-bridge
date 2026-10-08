/**
 * Exact installed Subtype and finite-specialization reports eligible for promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";

const groups = [
	{ name: "reviewed-subtype"
		, kind: "subtype", gate: "SUBTYPE", test: "reviewed-subtype-installed"
		, validator: "reviewed-subtype-evidence-tests"
		, receipt: "9c14cc972f8404ec417ec499f4fe5450b13d5368100aeff8f8f7842817b4a146"
		, counts: [2033, 2026, 2036], rejections: 2024 }
	, { name: "reviewed-specializations"
		, kind: "finite-specializations", gate: "SPECIALIZATION"
		, test: "reviewed-specializations"
		, validator: "reviewed-specialization-evidence-tests"
		, receipt: "ef9f5dfa718558abfc3080b8c518b12f740daf04acb1590d717d9459443be84e"
		, counts: [2016, 2011, 6], rejections: 3 }
];

/** Read and authenticate only the four archived native and Node report sets. */
export const reviewedApiPromotionReferences = async () => {
	const references = [];
	for(const group of groups)
	{
		const root = `docs/evidence/${group.name}-20261008`;
		const receiptPath = `${root}/receipt.json`, bytes = await readFile(receiptPath);
		assert.equal(sha256(bytes), group.receipt, receiptPath);
		const receipt = JSON.parse(bytes);
		assert.equal(receipt.execution, "local");
		assert.equal(receipt.scope.sourcePath, "reviewed-source");
		assert.equal(receipt.scope.dispatch, "not measured");
		assert.equal(receipt.scope.browserExecution, false);
		assert.equal(receipt.scope.otherNativeHosts, false);
		assert.deepEqual(receipt.scope.profiles, ["c", "cpp", "npm"]);
		for(const npm of [false, true])
		{
			const reportPath = `${root}/${npm ? "npm" : "c-cpp"}.json`;
			const artifact = receipt.artifacts.find(item => item.path === reportPath);
			assert.ok(artifact);
			const source = await readFile(reportPath);
			assert.equal(sha256(source), artifact.sha256, reportPath);
			const report = JSON.parse(source);
			assert.equal(report.reproducible, true);
			const rows = npm ? [report] : report.reports;
			assert.deepEqual(rows.map(row => row.profile), npm ? ["npm"] : ["c", "cpp"]);
			assert.deepEqual(rows.map(row => row.checks), npm ? [group.counts[2]] : group.counts.slice(0, 2));
			for(const row of rows)
			{
				assert.equal(row.path, "reviewed-source");
				for(const flag of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"])
					assert.equal(row[flag], true, flag);
			}
			if(npm)
			{
				assert.equal(report.rejections, group.rejections);
				assert.equal(report.independentBuilds, 2);
				assert.equal(report.typescript.strict, true);
				assert.equal(report.typescript.skipLibCheck, false);
			}
			const profiles = npm ? ["node-javascript", "node-typescript"] : ["c", "cpp"];
			const artifacts = npm ? [report.receipt.package, report.receipt.runtime].map(item => ({ path: item.archive, sha256: item.sha256 }))
				: Object.entries(report.archives).map(([path, sha256]) => ({ path, sha256 }));
			const gate = `LEAN_BRIDGE_REVIEWED_${group.gate}_${npm ? "NPM_TEST=1" : "PROFILES=c,cpp"}`;
			const environment = npm ? "LEAN_BRIDGE_LAKE_RUNTIME_ROOT=/absolute/path/to/pinned-runtime" : "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36";
			references.push({ id: `reviewed-${group.kind}-${npm ? "npm" : "c-cpp"}-installed`
				, kind: group.kind, npm, profiles, sourcePath: "reviewed-ir"
				, revision: receipt.revision, receiptPath, reportPath
				, reportSha256: artifact.sha256
				, validator: `tests/helpers/${group.validator}.mjs`, artifacts
				, command: `${environment} ${gate} node --test --test-concurrency=1 tests/${group.test}.test.mjs`
				, receipt, report });
		}
	}
	return references;
};
