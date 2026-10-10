/**
 * Keep checked-record Python acceptance tied to all original executions and independent checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertCheckedRecordHostRecords } from "./checked-record-native-records.mjs";
import { readCheckedRecordPythonArchive, checkedRecordPythonRoot } from "./checked-record-python-archive.mjs";

test("checked-record Python archive authenticates all four routes on both installed interpreter floors", async () => {
	const { index, reports, files } = await readCheckedRecordPythonArchive();
	assert.deepEqual(reports.map(report => report.reports[0].checks), [9024, 9024, 1002, 1002, 9024, 9024, 1002, 1002]);
	assert.deepEqual(reports.map(report => report.reports[0].pythonEnvironment.python), [...Array(4).fill("3.11.16"), ...Array(4).fill("3.12.14")]);
	assert.equal(files.size, 168); assert.equal(index.sources.length, 21);
	for(const report of reports)
	{
		assert.equal(report.reports[0].dispatch.observed, false);
		assert.equal(report.reports[0].relocatedInstallation, true);
	}
});

test("checked-record Python archive rejects changed original bytes and a changed index", async () => {
	const { files } = await readCheckedRecordPythonArchive();
	const originals = new Map([...files].map(([path, bytes]) => [`${checkedRecordPythonRoot}/${path}`, bytes]));
	originals.set(`${checkedRecordPythonRoot}/index.json`, await readFile(`${checkedRecordPythonRoot}/index.json`));
	for(const [path, bytes] of originals)
	{
		const sameSize = Buffer.from(bytes); assert.ok(sameSize.length); sameSize[0] ^= 1;
		for(const changed of [Buffer.concat([bytes, Buffer.from("\n")]), sameSize])
			await assert.rejects(() => readCheckedRecordPythonArchive(candidate => candidate === path ? changed : originals.get(candidate)), undefined, path);
	}
});

test("checked-record reports reject altered scopes, APIs, isolation, package identities and caller bytes", async () => {
	const { files, index } = await readCheckedRecordPythonArchive();
	for(const run of index.runs)
	{
		const prefix = run.archive + "/";
		const base = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
		const original = JSON.parse(base.get("report.json"));
		const validate = records => assertCheckedRecordHostRecords({ profiles: ["python"], route: run.route, python: run.floor, read: path => records.get(path) });
		const refuse = async (label, mutate) => {
			const changed = new Map(base), report = structuredClone(original);
			mutate(report, changed);
			changed.set("report.json", Buffer.from(canonicalJson(report)));
			if(report.reports.length) changed.set("python.json", Buffer.from(canonicalJson(report.reports[0])));
			await assert.rejects(() => validate(changed), undefined, `${run.archive}/${label}`);
		};
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "compilerFreeReplay", "sourceUnchangedAfterReplay"])
			await refuse(key, report => { report.reports[0][key] = false; });
		for(const [label, mutate] of [
			["schema", report => { report.schemaVersion++; }]
			, ["extra field", report => { report.unrecorded = true; }]
			, ["reproduction", report => { report.builds.pop(); }]
			, ["different root", report => { report.builds[1].modelSha256 = "0".repeat(64); }]
			, ["missing reports", report => { report.reports = []; }]
			, ["duplicate reports", report => { report.reports.push(report.reports[0]); }]
			, ["route", report => { report.route = "unknown"; }]
			, ["reproducible", report => { report.reproducible = false; }]
			, ["profile", report => { report.profiles = ["ruby"]; }]
			, ["checks", report => { report.reports[0].checks--; }]
			, ["reviewed", report => { report.reports[0].reviewed = !report.reports[0].reviewed; }]
			, ["result-only", report => { report.reports[0].resultOnly = !report.reports[0].resultOnly; }]
			, ["dispatch", report => { report.reports[0].dispatch.observed = true; }]
			, ["replay", report => { report.reports[0].repeatedRuns = 0; }]
			, ["independent IR", report => { report.reports[0].expectedBindingIrSha256 = "0".repeat(64); }]
			, ["consumer", report => { report.reports[0].consumerSha256 = "0".repeat(64); }]
			, ["package", report => { report.reports[0].packages[0].target = "unknown"; }]
			, ["Python floor", report => { report.reports[0].pythonEnvironment.python = "3.10.0"; }]
			, ["Python baseline", report => { report.reports[0].pythonEnvironment.baselineSha256 = report.reports[0].pythonEnvironment.expectedSha256; }]
			, ["Python environment", report => { report.reports[0].pythonEnvironment.expectedSha256 = "0".repeat(64); }]
			, ["Python receipt", report => { report.reports[0].pythonEnvironment.receiptSha256 = "0".repeat(64); }]
		]) await refuse(label, mutate);
		for(const attempt of [0, 1])
		{
			await refuse(`author ${attempt}`, (_, changed) => {
				const path = `build-${attempt}/CheckedRecords.lean`;
				changed.set(path, Buffer.concat([base.get(path), Buffer.from("\n-- changed\n")]));
			});
			await refuse(`independent API ${attempt}`, (_, changed) => {
				const path = `build-${attempt}/expected.json`, expected = JSON.parse(base.get(path));
				expected.declarations.pop(); changed.set(path, Buffer.from(canonicalJson(expected)));
			});
		}
		for(const mutate of [model => { model.exports.find(item => item.name === "CheckedRecords.repeated").refinements.result.fields = ["fabricated"]; }
			, model => { model.sourceIdentity.request.exports = []; }
			, model => { model.sourceIdentity.request.contracts = {}; }
			, model => { model.sourceIdentity.request.modules = ["Other"]; }
			, model => { model.sourceIdentity.request.resources = ["fabricated"]; }])
			await refuse("coordinated model and identities", (report, changed) => {
				for(const attempt of [0, 1])
				{
					const path = `build-${attempt}/model.json`, model = JSON.parse(base.get(path));
					mutate(model); const bytes = Buffer.from(canonicalJson(model));
					changed.set(path, bytes); report.builds[attempt].modelSha256 = sha256(bytes);
				}
				report.reports[0].modelSha256 = report.builds[0].modelSha256;
			});
		await refuse("caller bytes", (_, changed) => changed.set("consumers/python.py", Buffer.concat([base.get("consumers/python.py"), Buffer.from("\n")])));
		const noncanonical = new Map(base);
		noncanonical.set("report.json", Buffer.from(JSON.stringify(original, null, 2)));
		await assert.rejects(() => validate(noncanonical));
		await assert.rejects(() => assertCheckedRecordHostRecords({ profiles: ["python"], route: run.route, python: run.floor === "3.11" ? "3.12" : "3.11", read: path => base.get(path) }));
	}
	for(const profiles of [[], ["unknown"], ["python", "python"], ["ruby", "python"]])
		await assert.rejects(() => assertCheckedRecordHostRecords({ profiles, route: "ordinary-source", read: () => assert.fail("Invalid selection must not read records") }));
	await assert.rejects(() => assertCheckedRecordHostRecords({ profiles: ["python"], route: "unknown", read: () => assert.fail("Invalid route must not read records") }));
});
