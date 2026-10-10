/**
 * Authenticate both installed Python floors and refuse weakened or corrupted reviewed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertReviewedSubtypeHostRecords } from "./reviewed-subtype-host-report.mjs";
import { readReviewedSubtypePythonArchive, reviewedSubtypePythonRoot } from "./reviewed-subtype-python-archive.mjs";

test("reviewed Subtype Python archive authenticates both reproduced, isolated and relocated installed floors", async () => {
	const { reports, files } = await readReviewedSubtypePythonArchive();
	assert.deepEqual(reports.map(report => report.reports[0].checks), [2025, 2025]);
	assert.deepEqual(reports.map(report => report.reports[0].pythonEnvironment.python), ["3.11.16", "3.12.14"]);
	assert.equal(files.size, 53);
	const failed = JSON.parse(files.get("failed-overload/api.binding-ir.json"));
	const byte = failed.declarations.find(item => item.name === "byteValue");
	assert.equal(byte.overloadKey, "Subtypes.byte");
	const accepted = JSON.parse(files.get("3.11/build-0/review.json"));
	assert.equal(accepted.declarations.find(item => item.name === "byteValue").overloadKey, "Subtypes.byteValue");
});

test("reviewed Python archive refuses every changed original record and an altered index", async () => {
	const { files } = await readReviewedSubtypePythonArchive();
	const originals = new Map([...files].map(([path, bytes]) => [`${reviewedSubtypePythonRoot}/${path}`, bytes]));
	originals.set(`${reviewedSubtypePythonRoot}/index.json`, await readFile(`${reviewedSubtypePythonRoot}/index.json`));
	for(const [path, bytes] of originals)
	{
		const sameSize = Buffer.from(bytes); sameSize[0] ^= 1;
		for(const changed of [Buffer.concat([bytes, Buffer.from("\n")]), sameSize])
			await assert.rejects(() => readReviewedSubtypePythonArchive(candidate => candidate === path ? changed : originals.get(candidate)), undefined, path);
	}
});

test("reviewed Python report semantics refuse changed APIs, missing executions and invented isolation or dispatch", async () => {
	const { files } = await readReviewedSubtypePythonArchive();
	for(const floor of ["3.11", "3.12"])
	{
		const base = new Map([...files].filter(([path]) => path.startsWith(floor + "/")).map(([path, bytes]) => [path.slice(floor.length + 1), bytes]));
		const original = JSON.parse(base.get("report.json"));
		const mutations = [
			r => { r.schemaVersion++; }
			, r => { r.reproducible = false; }
			, r => { r.profiles = ["ruby"]; }
			, r => { r.reports = []; }
			, r => { r.builds.pop(); }
			, r => { r.builds[1].modelSha256 = "0".repeat(64); }
			, r => { r.reports[0].checks--; }
			, r => { r.reports[0].path = "ordinary-source"; }
			, r => { r.reports[0].consumerSha256 = "0".repeat(64); }
			, r => { r.reports[0].reviewedBindingIrSha256 = "0".repeat(64); }
			, r => { r.reports[0].dispatch = { observed: true }; }
			, r => { r.reports[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
			, r => { r.reports[0].repeatedRuns = 0; }
			, r => { r.reports[0].pythonEnvironment.python = "3.10.0"; }
			, r => { r.reports[0].pythonEnvironment.baselineSha256 = r.reports[0].pythonEnvironment.expectedSha256; }
			, r => { r.reports[0].pythonEnvironment.expectedSha256 = "0".repeat(64); }
			, r => { r.reports[0].pythonEnvironment.receiptSha256 = "0".repeat(64); }
		];
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "compilerFreeReplay", "sourceUnchangedAfterReplay"])
			mutations.push(r => { r.reports[0][key] = false; });
		for(const mutate of mutations)
		{
			const report = structuredClone(original); mutate(report);
			const changed = new Map(base);
			changed.set("report.json", Buffer.from(canonicalJson(report)));
			if(report.reports.length) changed.set("python.json", Buffer.from(canonicalJson(report.reports[0])));
			await assert.rejects(() => assertReviewedSubtypeHostRecords({ profiles: ["python"], python: floor, read: path => changed.get(path) }));
		}
		// Updating the report hashes as well must not disguise a different checked constructor.
		const changed = new Map(base), report = structuredClone(original);
		for(const attempt of [0, 1])
		{
			const path = `build-${attempt}/model.json`, model = JSON.parse(base.get(path));
			model.sourceIdentity.request.contracts["Subtypes.firstEven"].parameters[0].refinement.constructor = "Subtypes.normalizedEven";
			changed.set(path, Buffer.from(canonicalJson(model)));
			report.builds[attempt].modelSha256 = sha256(canonicalJson(model));
		}
		report.reports[0].modelSha256 = report.builds[0].modelSha256;
		changed.set("report.json", Buffer.from(canonicalJson(report)));
		changed.set("python.json", Buffer.from(canonicalJson(report.reports[0])));
		await assert.rejects(() => assertReviewedSubtypeHostRecords({ profiles: ["python"], python: floor, read: path => changed.get(path) }));
		await assert.rejects(() => assertReviewedSubtypeHostRecords({ profiles: ["python"], python: floor === "3.11" ? "3.12" : "3.11", read: path => base.get(path) }));
	}
	for(const profiles of [[], ["unknown"], ["python", "python"], ["ruby", "python"]])
		await assert.rejects(() => assertReviewedSubtypeHostRecords({ profiles, read: () => assert.fail("Invalid selection must not read records") }));
});
