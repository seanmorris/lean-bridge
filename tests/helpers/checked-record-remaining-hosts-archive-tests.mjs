/**
 * Reject missing originals and weakened installed checked-record host observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertCheckedRecordRemainingHostRecords } from "./checked-record-remaining-host-report.mjs";
import { checkedRecordRemainingHostsRoot, readCheckedRecordRemainingHostsArchive } from "./checked-record-remaining-hosts-archive.mjs";

test("checked-record remaining native archives retain sixteen completed selections and the failed PHP setup", async () => {
	const { reports, files, index } = await readCheckedRecordRemainingHostsArchive();
	assert.equal(files.size, 152); assert.equal(index.sources.length, 37);
	assert.deepEqual(reports.map(report => report.reports.map(item => [item.profile, item.checks])),
		[9024, 9024, 1002, 1002].map(checks => ["dotnet", "php-native", "rust", "wit-wasi"].map(profile => [profile, checks])));
	for(const report of reports) for(const item of report.reports)
	{
		assert.equal(item.dispatch.observed, false);
		assert.equal(item.relocatedInstallation, true);
		assert.equal(item.repeatedRuns, item.profile === "php-native" ? 2 : 1);
	}
	assert.equal(index.failedAttempts.length, 1);
	assert.equal(JSON.parse(files.get("failed-php-tool/run.end.json")).code, 1);
});

test("checked-record remaining native archives refuse missing files and byte corruption throughout", async t => {
	const { files } = await readCheckedRecordRemainingHostsArchive();
	const originals = new Map([...files].map(([path, bytes]) => [`${checkedRecordRemainingHostsRoot}/${path}`, bytes]));
	originals.set(`${checkedRecordRemainingHostsRoot}/index.json`, await readFile(`${checkedRecordRemainingHostsRoot}/index.json`));
	let rejected = 0;
	for(const [path, bytes] of originals)
	{
		await assert.rejects(readCheckedRecordRemainingHostsArchive(async candidate => {
			if(candidate === path) throw Object.assign(new Error(`Missing ${path}`), { code: "ENOENT" });
			return originals.get(candidate);
		}), { code: "ENOENT" });
		rejected++;
		assert.ok(bytes.length); const sameSize = Buffer.from(bytes); sameSize[0] ^= 1;
		for(const changed of [Buffer.concat([bytes, Buffer.from("\n")]), sameSize])
		{
			await assert.rejects(() => readCheckedRecordRemainingHostsArchive(candidate => candidate === path ? changed : originals.get(candidate)), undefined, path);
			rejected++;
		}
	}
	assert.equal(rejected, 459);
	t.diagnostic(`${rejected} missing/corrupted original controls rejected`);
});

test("checked-record remaining native reports reject altered callers, package environments and coordinated models", async t => {
	const { files, index } = await readCheckedRecordRemainingHostsArchive();
	const profiles = ["dotnet", "php-native", "rust", "wit-wasi"];
	let controls = 0;
	for(const run of index.runs)
	{
		const prefix = run.archive + "/";
		const base = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
		const original = JSON.parse(base.get("report.json"));
		const validate = records => assertCheckedRecordRemainingHostRecords({ profiles, route: run.route, read: path => records.get(path) });
		for(const [position, profile] of profiles.entries())
		{
			const mutations = [
				item => { item.checks--; }
				, item => { item.dispatch = { observed: true }; }
				, item => { item.repeatedRuns = 0; }
				, item => { item.consumerSha256 = "0".repeat(64); }
				, item => { item.packages[0].artifacts[0].sha256 = "0".repeat(64); }
			];
			for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "compilerFreeReplay", "sourceUnchangedAfterReplay"])
				mutations.push(item => { item[key] = false; });
			if(profile === "dotnet" || profile === "php-native")
			{
				const env = item => profile === "dotnet" ? item.dotnetEnvironment : item.phpEnvironment;
				const receipt = (item, change) => {
					const value = JSON.parse(env(item).receiptBytes); change(value);
					env(item).receiptBytes = canonicalJson(value);
				};
				mutations.push(
					item => { receipt(item, value => { value.bindingIrSha256 = "0".repeat(64); }); }
					, item => { receipt(item, value => { value.runtimeIdentity = "0".repeat(64); }); }
					, item => { receipt(item, value => { value.sourceIdentity.sourceTreeSha256 = "0".repeat(64); }); }
					, item => { receipt(item, value => { value.glibcMinimumVersion = "2.38"; }); }
					, item => { env(item).packageFileSetSha256 = "0".repeat(64); }
					, item => { env(item).inputs[profile === "dotnet" ? "consumer.cs" : "consumer.php"].sha256 = "0".repeat(64); }
				);
				if(profile === "dotnet") mutations.push(
					item => { receipt(item, value => { value.assembly = "Different"; }); }
					, item => { env(item).archiveName = "Different.nupkg"; }
					, item => { env(item).packageDirectory = "other/1.0.0"; }
					, item => { delete env(item).cacheFiles[Object.keys(env(item).cacheFiles)[0]]; }
					, item => { delete env(item).buildInputs[Object.keys(env(item).buildInputs)[0]]; }
					, item => { env(item).outputs["unrecorded.dll"] = { bytes: 1, sha256: "0".repeat(64) }; }
				);
				else mutations.push(
					item => { env(item).name = "example/different"; }
					, item => { env(item).feedFiles["component.zip"].sha256 = "0".repeat(64); }
					, item => { env(item).inputs["strict.php"].sha256 = "0".repeat(64); }
					, item => { delete env(item).dependencyFiles[Object.keys(env(item).dependencyFiles)[0]]; }
					, item => { delete env(item).generatedFiles[Object.keys(env(item).generatedFiles)[0]]; }
					, item => { delete env(item).vendorFiles[Object.keys(env(item).vendorFiles)[0]]; }
					, item => { delete env(item).tools[env(item).command]; }
					, item => { env(item).runtimeFlags = ["-n", "-d", "ffi.enable=0"]; }
					, item => { env(item).runtimeFlags = ["-n", "-d", "extension=/unrecorded/ffi.so", "-d", "ffi.enable=1"]; }
					, item => { env(item).runtimeFlags = ["-n", "-d", "ffi.enable=1", "-r", "echo 'fake';"]; }
				);
			}
			for(const mutate of mutations)
			{
				const report = structuredClone(original); mutate(report.reports[position]);
				const changed = new Map(base);
				changed.set("report.json", Buffer.from(canonicalJson(report)));
				changed.set(profile + ".json", Buffer.from(canonicalJson(report.reports[position])));
				await assert.rejects(() => validate(changed), undefined, `${profile} control ${controls}`); controls++;
			}
		}
		for(const mutate of [
			model => { model.exports.find(item => item.name === "CheckedRecords.repeated").refinements.result.fields = ["fabricated"]; }
			, model => { model.exports.find(item => item.name === "CheckedRecords.repeated").refinements.result.constructor = "fabricated"; }
			, model => { model.sourceIdentity.request.exports = []; }
			, model => { model.sourceIdentity.request.contracts = {}; }
			, model => { model.sourceIdentity.request.modules = ["Other"]; }
		]) {
			const changed = new Map(base), report = structuredClone(original);
			for(const attempt of [0, 1])
			{
				const path = `build-${attempt}/model.json`, model = JSON.parse(base.get(path)); mutate(model);
				const bytes = Buffer.from(canonicalJson(model)); changed.set(path, bytes);
				report.builds[attempt].modelSha256 = sha256(bytes);
			}
			for(const item of report.reports)
			{
				item.modelSha256 = report.builds[0].modelSha256;
				changed.set(item.profile + ".json", Buffer.from(canonicalJson(item)));
			}
			changed.set("report.json", Buffer.from(canonicalJson(report)));
			await assert.rejects(() => validate(changed)); controls++;
		}
	}
	assert.equal(controls, 324);
	t.diagnostic(`${controls} semantic controls rejected`);
});
