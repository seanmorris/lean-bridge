/**
 * Preserve independently authored reviewed Fin installed observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";

const directory = "docs/evidence/reviewed-fin-20261007";
test("reviewed Fin receipts retain scalar and container C/C++ installed controls", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.planNode, 1438);
	assert.equal(receipt.execution, "local"); assert.equal(receipt.glibcMinimumVersion, "2.36");
	assert.equal(receipt.sourcePath, "reviewed-ir"); assert.deepEqual(receipt.profiles, ["c", "cpp"]);
	assert.deepEqual(receipt.reports.map(item => item.path), [`${directory}/scalar.json`, `${directory}/containers.json`]);
	const expected = [
		["e332ce1a1e440a728adf6f0ba2626a3c809b8f3c", "85419c0f332780561984e68751b6e499eaabf296c76f129ba291275d615c366b", [2029, 2020], 10]
		, ["a82e4c55bbf94585e0edf733ffe561b055c360bb", "fddb0bd654ad4db463eff22425560f6bf179b26b4b39dd321a099020b97d8cd2", [2041, 2039], 9]];
	for(const [index, reference] of receipt.reports.entries())
	{
		assert.equal(reference.revision, expected[index][0]);
		assert.equal(reference.sha256, expected[index][1]);
		assert.match(reference.command, /LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.36/u);
		const bytes = await readFile(reference.path); assert.equal(sha256(bytes), reference.sha256);
		const report = JSON.parse(bytes);
		assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
		assert.deepEqual(report.reports.map(item => item.profile), ["c", "cpp"]);
		assert.deepEqual(report.reports.map(item => item.checks), expected[index][2]);
		for(const execution of report.reports)
		{
			assert.equal(execution.path, "reviewed-ir");
			for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(execution[key], true);
			for(const key of ["bindingIrSha256", "modelSha256", "sourceTreeSha256", "receiptSha256", "reviewedSourceSha256"]) assert.match(execution[key], /^[a-f0-9]{64}$/u);
			for(const pkg of execution.packages) for(const artifact of pkg.artifacts)
				assert.equal(report.archives[artifact.path], artifact.sha256);
			if(index === 0) for(const key of ["relocatedInstallation", "repeatExecution", "installedFilesUnchanged"]) assert.equal(execution[key], true);
		}
		assert.equal(report.reports[0].reviewedSourceSha256, report.reports[1].reviewedSourceSha256);
		const dispatch = report.reports[0].dispatch;
		assert.equal(dispatch.interposer, "LD_PRELOAD"); assert.equal(dispatch.observed.length, expected[index][3]);
		assert.ok(dispatch.observed.some(([step]) => step === "public-invalid-mirror"));
		assert.ok(dispatch.observed.some(([step]) => step === "raw-invalid-mirror"));
		assert.ok(dispatch.observed.some(([step]) => step === "raw-valid-mirror"));
		assert.ok(dispatch.observed.at(-1)[2][0] > 0, "Valid source-dispatch positive control");
		if(index === 0) assert.equal(dispatch.runtimeTableChecks, 1544);
		else assert.equal(report.reports[1].dispatch.observed, false);
	}
});
