/**
 * Check the live WIT report contract against authenticated original installed observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { readFinLateWitArchive } from "./fin-container-late-archives.mjs";
import { assertFinLateWitRecords, assertFinLateWitTap } from "./fin-container-late-wit-report.mjs";
import "./fin-container-late-wit-ci-tests.mjs";

test("live WIT late-input checker accepts the archived original and refuses changed requirements", async () => {
	const archive = await readFinLateWitArchive();
	const read = async path => {
		const value = archive.files.get(`r2/records/${path}`); assert.ok(value, path); return value;
	};
	const { report, files } = await assertFinLateWitRecords(read, "2.36");
	assert.equal(files.size, 14); assert.equal(report.checks, 7065);
	const tap = archive.files.get("r2/run.tap").toString(); assertFinLateWitTap(tap);
	await assert.rejects(assertFinLateWitRecords(read, "2.38"));
	for(const path of files.keys())
	{
		await assert.rejects(assertFinLateWitRecords(async name => {
			if(name === path) throw Object.assign(new Error("Missing original"), { code: "ENOENT" });
			return read(name);
		}, "2.36"));
		await assert.rejects(assertFinLateWitRecords(async name => name === path ? Buffer.from("corrupt") : read(name), "2.36"));
	}
	for(const field of ["checks", "snapshotNegativeControls", "callerSha256", "executableSha256", "receiptSha256", "packageFileSetSha256", "authorRoots", "reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath", "relocatedInstallation", "installedFilesUnchanged", "callerUnchanged", "repeatExecution", "rejectionsPerExecution", "recoveriesPerExecution", "boundRejectionsPerExecution", "structuralRejectionsPerExecution"])
	{
		const changed = structuredClone(report); delete changed[field];
		await assert.rejects(assertFinLateWitRecords(async path => path === "report.json" ? Buffer.from(canonicalJson(changed)) : read(path), "2.36"));
	}
	for(const mutate of [value => { value.inputTreesCompared.pop(); }
		, value => { value.dispatch.observed = true; }
		, value => { value.builds[1].modelSha256 = "0".repeat(64); }
		, value => { value.packages[0].runtimeIdentity = "0".repeat(64); }
		, value => { value.runtimeSearchPath = "/old/installation"; }]) {
		const changed = structuredClone(report); mutate(changed);
		await assert.rejects(assertFinLateWitRecords(async path => path === "report.json" ? Buffer.from(canonicalJson(changed)) : read(path), "2.36"));
		}
	for(const changed of [tap.replace("# skipped 0", "# skipped 1")
		, tap.replace("# fail 0", "# fail 1"), tap + "# pass 1\n"
		, tap.replace("ok 1 - installed WIT", "ok 1 - source-only WIT")])
		assert.throws(() => assertFinLateWitTap(changed));
});
