/**
 * Reject changed original bytes and weakened Ruby/JVM checked-record execution claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertCheckedRecordRubyJvmRecords } from "./checked-record-ruby-jvm-report.mjs";
import { checkedRecordRubyJvmRoot, readCheckedRecordRubyJvmArchive } from "./checked-record-ruby-jvm-archive.mjs";

test("checked-record Ruby and JVM archives retain all twelve installed route/profile selections", async () => {
	const { reports, files, index } = await readCheckedRecordRubyJvmArchive();
	assert.equal(files.size, 120); assert.equal(index.sources.length, 29);
	assert.deepEqual(reports.map(report => report.reports.map(item => [item.profile, item.checks])),
		[9024, 9024, 1002, 1002].map(checks => ["java", "kotlin", "ruby"].map(profile => [profile, checks])));
	for(const report of reports) for(const item of report.reports)
	{
		assert.equal(item.dispatch.observed, false);
		assert.equal(item.relocatedInstallation, true);
		assert.equal(item.repeatedRuns, 1);
	}
});

test("checked-record Ruby and JVM archives refuse byte corruption in every artifact and index", async () => {
	const { files } = await readCheckedRecordRubyJvmArchive();
	const originals = new Map([...files].map(([path, bytes]) => [`${checkedRecordRubyJvmRoot}/${path}`, bytes]));
	originals.set(`${checkedRecordRubyJvmRoot}/index.json`, await readFile(`${checkedRecordRubyJvmRoot}/index.json`));
	for(const [path, bytes] of originals)
	{
		assert.ok(bytes.length); const sameSize = Buffer.from(bytes); sameSize[0] ^= 1;
		for(const changed of [Buffer.concat([bytes, Buffer.from("\n")]), sameSize])
			await assert.rejects(() => readCheckedRecordRubyJvmArchive(candidate => candidate === path ? changed : originals.get(candidate)), undefined, path);
	}
});

test("checked-record Ruby and JVM reports refuse altered receipts, executable inputs and coordinated models", async () => {
	const { files, index } = await readCheckedRecordRubyJvmArchive();
	const profiles = ["java", "kotlin", "ruby"];
	let controls = 0;
	for(const run of index.runs)
	{
		const prefix = run.archive + "/";
		const base = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
		const original = JSON.parse(base.get("report.json"));
		const validate = records => assertCheckedRecordRubyJvmRecords({ profiles, route: run.route, read: path => records.get(path) });
		for(const [index, profile] of profiles.entries())
		{
			const env = item => profile === "ruby" ? item.rubyEnvironment : item.jvmEnvironment;
			const receipt = (item, mutate) => {
				const value = JSON.parse(env(item).receiptBytes); mutate(value);
				env(item).receiptBytes = canonicalJson(value);
			};
			const mutations = [
				item => { item.checks--; }
				, item => { item.dispatch = { observed: true }; }
				, item => { item.repeatedRuns = 0; }
				, item => { item.consumerSha256 = "0".repeat(64); }
				, item => { receipt(item, value => { value.bindingIrSha256 = "0".repeat(64); }); }
				, item => { receipt(item, value => { value.runtimeIdentity = "0".repeat(64); }); }
				, item => { receipt(item, value => { value.name = "different"; }); }
				, item => { receipt(item, value => { value.namespace = "different"; }); }
				, item => { receipt(item, value => { value.glibcMinimumVersion = "2.38"; }); }
				, item => { receipt(item, value => { value.sourceIdentity.sourceTreeSha256 = "0".repeat(64); }); }
				, item => { receipt(item, value => { delete value.files[Object.keys(value.files)[0]]; }); }
				, item => { env(item).files["unrecorded.rb"] = { bytes: 1, sha256: "0".repeat(64) }; env(item).expectedSha256 = sha256(canonicalJson(env(item).files)); }
			];
			for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "compilerFreeReplay", "sourceUnchangedAfterReplay"])
				mutations.push(item => { item[key] = false; });
			if(profile === "ruby") mutations.push(
				item => { env(item).expectedSha256 = "0".repeat(64); }
				, item => { env(item).fullName = "other-1.0.0-x86_64-linux"; }
				, item => { const field = `cache/${env(item).fullName}.gem`; env(item).files[field].sha256 = "0".repeat(64); env(item).expectedSha256 = sha256(canonicalJson(env(item).files)); }
				, item => { receipt(item, value => { value.requirePath = "other"; }); }
			);
			else mutations.push(
				item => { env(item).profile = profile === "java" ? "kotlin" : "java"; }
				, item => { env(item).archiveSha256 = "0".repeat(64); }
				, item => { env(item).packageFileSetSha256 = "0".repeat(64); }
				, item => { env(item).files["component.jar"].sha256 = "0".repeat(64); }
				, item => { env(item).files[`consumer.${profile === "java" ? "java" : "kt"}`].sha256 = "0".repeat(64); }
				, item => { receipt(item, value => { value.kotlin.standardLibraryVersion = "0"; }); }
			);
			for(const mutate of mutations)
			{
				const report = structuredClone(original); mutate(report.reports[index]);
				const changed = new Map(base);
				changed.set("report.json", Buffer.from(canonicalJson(report)));
				changed.set(profile + ".json", Buffer.from(canonicalJson(report.reports[index])));
				await assert.rejects(() => validate(changed)); controls++;
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
	assert.equal(controls, 312);
});
