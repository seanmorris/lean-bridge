/**
 * Refuse corrupted original archives and weakened RubyGems/JVM receipt and execution observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertReviewedSubtypeRubyJvmRecords } from "./reviewed-subtype-ruby-jvm-report.mjs";
import { readReviewedSubtypeRubyJvmArchive, reviewedSubtypeRubyJvmRoot } from "./reviewed-subtype-ruby-jvm-archive.mjs";

test("reviewed Subtype Ruby and JVM archives authenticate complete reproduced and relocated consumers", async () => {
	const { reports, files } = await readReviewedSubtypeRubyJvmArchive();
	assert.deepEqual(reports.flatMap(report => report.reports.map(item => [item.profile, item.checks])), [["ruby", 2024], ["java", 2024], ["kotlin", 2023]]);
	assert.equal(files.size, 53);
});

test("reviewed Ruby and JVM archives refuse every changed original record and index", async () => {
	const { files } = await readReviewedSubtypeRubyJvmArchive();
	const originals = new Map([...files].map(([path, bytes]) => [`${reviewedSubtypeRubyJvmRoot}/${path}`, bytes]));
	originals.set(`${reviewedSubtypeRubyJvmRoot}/index.json`, await readFile(`${reviewedSubtypeRubyJvmRoot}/index.json`));
	for(const [path, bytes] of originals)
	{
		const sameSize = Buffer.from(bytes); sameSize[0] ^= 1;
		for(const changed of [Buffer.concat([bytes, Buffer.from("\n")]), sameSize])
			await assert.rejects(() => readReviewedSubtypeRubyJvmArchive(candidate => candidate === path ? changed : originals.get(candidate)), undefined, path);
	}
});

test("reviewed Ruby and JVM reports refuse weakened isolation, changed receipts and unrecorded executable inputs", async () => {
	const { files } = await readReviewedSubtypeRubyJvmArchive();
	let controls = 0;
	for(const [group, profiles] of [["ruby", ["ruby"]], ["jvm", ["java", "kotlin"]]])
	{
		const base = new Map([...files].filter(([path]) => path.startsWith(group + "/")).map(([path, bytes]) => [path.slice(group.length + 1), bytes]));
		const original = JSON.parse(base.get("report.json"));
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
			);
			else mutations.push(
				item => { env(item).profile = profile === "java" ? "kotlin" : "java"; }
				, item => { env(item).archiveSha256 = "0".repeat(64); }
				, item => { env(item).packageFileSetSha256 = "0".repeat(64); }
				, item => { env(item).files["component.jar"].sha256 = "0".repeat(64); }
				, item => { env(item).files[`consumer.${profile === "java" ? "java" : "kt"}`].sha256 = "0".repeat(64); }
			);
			for(const mutate of mutations)
			{
				const report = structuredClone(original); mutate(report.reports[index]);
				const changed = new Map(base);
				changed.set("report.json", Buffer.from(canonicalJson(report)));
				changed.set(profile + ".json", Buffer.from(canonicalJson(report.reports[index])));
				await assert.rejects(() => assertReviewedSubtypeRubyJvmRecords({ profiles, read: path => changed.get(path) }));
				controls++;
			}
		}
	}
	assert.equal(controls, 64);
});
