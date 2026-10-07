/**
 * Audit installed Python refinement observations captured from the successful CI job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { pythonFinConsumer, pythonFinDispatchExpected, pythonFinDispatchProbe } from "./python-fin-consumers.mjs";
import { nativeFinDispatchColumns } from "./native-fin-consumers.mjs";
import { finContainerRefinements } from "./fin-container-install.mjs";
import { nativeSubtypeRefinements } from "./native-subtype-install.mjs";
import { nativeSpecializationSignatures } from "./native-specialization-install.mjs";

const directory = "docs/evidence/python-refinements-20261007";
const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
const cases = [
	["native-fin", 2032, null]
	, ["native-specializations", 2020, "specialization"]
	, ["native-fin-containers", 2029, "fin-container"]
	, ["native-subtype", 2017, "subtype"]
];

const audit = async (kind, record, checks, consumer) => {
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.reproducible, true);
	assert.equal(record.reports.length, kind === "native-fin" ? 2 : 1);
	const digest = consumer === null ? sha256(pythonFinConsumer())
		: sha256(await readFile(`tests/fixtures/${consumer}-consumers/python.py`));
	for(const report of record.reports)
	{
		assert.equal(report.profile, "python");
		assert.equal(report.path, "ordinary-source");
		assert.equal(report.checks, checks);
		assert.equal(report.consumerSha256, digest);
		for(const flag of ["compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation"])
			assert.equal(report[flag], true, flag);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"])
			assert.match(report[key], /^[0-9a-f]{64}$/u, key);
		assert.equal(report.packages.length, 1);
		const pkg = report.packages[0];
		assert.equal(pkg.ecosystem, "pypi");
		assert.equal(pkg.target, "pypi");
		assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(pkg.artifacts.length, 1);
		for(const artifact of pkg.artifacts)
		{
			assert.match(artifact.path, /manylinux_2_38_x86_64\.whl$/u);
			assert.equal(record.archives[artifact.path], artifact.sha256);
			assert.ok(artifact.bytes > 0);
		}
		if(kind === "native-fin")
		{
			for(const flag of ["relocatedInstallation", "repeatExecution", "installedFilesUnchanged"])
				assert.equal(report[flag], true, flag);
			assert.deepEqual(report.dispatch.columns, nativeFinDispatchColumns);
			assert.deepEqual(report.dispatch.observed, pythonFinDispatchExpected);
			assert.equal(report.dispatch.probeSha256, sha256(pythonFinDispatchProbe()));
			assert.ok(Object.keys(report.sharedNativeLibraries).includes("libnative_fin.so"));
			assert.equal(report.dispatch.interposer, "LD_PRELOAD");
		}
		else if(kind === "native-specializations")
			assert.deepEqual(report.exports.toSorted(), Object.keys(nativeSpecializationSignatures).toSorted());
		else
		{
			assert.deepEqual(report.refinements, kind === "native-fin-containers" ? finContainerRefinements : nativeSubtypeRefinements);
			assert.equal(report.dispatch.observed, false);
			assert.match(report.dispatch.reason, /counted in the C package/u);
		}
	}
	if(kind === "native-fin")
	{
		assert.deepEqual(record.reports.map(report => report.python), ["3.11", "3.12"]);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "sharedNativeLibraries"])
			assert.deepEqual(record.reports[0][key], record.reports[1][key], key);
	}
};

test("Python refinement reports retain the successful CI identity and exact source predecessors", async () => {
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.revision, "7f7bd65104050efddd328377389072f4c4272ac0");
	assert.equal(receipt.run.id, 37619743751);
	assert.equal(receipt.run.jobId, 112786699026);
	assert.equal(receipt.run.jobConclusion, "success");
	assert.equal(receipt.artifact.id, 11485363269);
	assert.equal(receipt.artifact.sha256, "dcbccde413c2dfc0fc4ab3c8bf68b67a59f2f6ef1be36a8f2b80fe9b444069f8");
	assert.deepEqual(Object.keys(receipt.reports), cases.map(([kind]) => kind));
	for(const [path, expected] of Object.entries(receipt.sources))
	{
		const source = await readFile(path, "utf8");
		assert.equal(sha256(beforeFinRefinementSource(path, source, expected)), expected, path);
		assert.notEqual(sha256(beforeFinRefinementSource(path, source + "\n// unknown edit\n", expected)), expected, path);
	}
});

for(const [kind, checks, consumer] of cases)
	test(`Python ${kind} report proves only its recorded installed checks`, async () => {
		const descriptor = receipt.reports[kind];
		assert.equal(descriptor.path, `${directory}/${kind}.json`);
		const source = await readFile(descriptor.path, "utf8");
		assert.equal(sha256(source), descriptor.sha256);
		const report = JSON.parse(source);
		assert.equal(source, canonicalJson(report));
		await audit(kind, report, checks, consumer);
		for(const mutate of [
			value => { value.reproducible = false; }
			, value => { value.reports[0].sourceRemovedBeforeInstallation = false; }
			, value => { value.reports[0].profile = "rust"; }
			, value => { value.reports[0].consumerSha256 = "0".repeat(64); }
			, value => { value.reports[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
		]) {
			const changed = structuredClone(report);
			mutate(changed);
			await assert.rejects(audit(kind, changed, checks, consumer));
		}
	});
