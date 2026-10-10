/**
 * Protect the remaining installed Subtype evidence from byte corruption and false host claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { assertReviewedSubtypeRemainingHostRecords } from "./reviewed-subtype-remaining-host-report.mjs";
import { readReviewedSubtypeRemainingArchive, reviewedSubtypeRemainingRoot } from "./reviewed-subtype-remaining-archive.mjs";

test("remaining reviewed Subtype archives authenticate Rust, .NET, PHP, WIT and four Perl ABIs", async () => {
	const { reports, files } = await readReviewedSubtypeRemainingArchive();
	assert.equal(files.size, 243);
	assert.deepEqual(reports.map(report => report.reports[0].checks), [2026, 2024, 2024, 2031, 2025, 2025, 2025, 2025]);
	assert.deepEqual(reports.slice(4).map(report => report.reports[0].perl.useithreads), ["define", null, "define", null]);
});

test("remaining reviewed Subtype archives reject every changed original record and index", async () => {
	const { files } = await readReviewedSubtypeRemainingArchive();
	const originals = new Map([...files].map(([path, bytes]) => [`${reviewedSubtypeRemainingRoot}/${path}`, bytes]));
	originals.set(`${reviewedSubtypeRemainingRoot}/index.json`, await readFile(`${reviewedSubtypeRemainingRoot}/index.json`));
	for(const [path, bytes] of originals)
	{
		const sameSize = Buffer.from(bytes); sameSize[0] ^= 1;
		for(const changed of [Buffer.concat([bytes, Buffer.from("\n")]), sameSize])
			await assert.rejects(() => readReviewedSubtypeRemainingArchive(candidate => candidate === path ? changed : originals.get(candidate)), undefined, path);
	}
});

test("remaining reviewed Subtype reports reject weakened isolation, changed runtime inputs and false Perl ABIs", async () => {
	const { index, files } = await readReviewedSubtypeRemainingArchive();
	let controls = 0;
	for(const { group, profile } of index.runs)
	{
		const base = new Map([...files].filter(([path]) => path.startsWith(group + "/")).map(([path, bytes]) => [path.slice(group.length + 1), bytes]));
		const original = JSON.parse(base.get("report.json"));
		const mutations = [
			item => { item.checks--; }
			, item => { item.dispatch = { observed: true }; }
			, item => { item.consumerSha256 = "0".repeat(64); }
			, item => { item.reviewedBindingIrSha256 = "0".repeat(64); }
		];
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution"])
			mutations.push(item => { item[key] = false; });
		if(profile === "perl")
		{
			mutations.push(item => { item.perl.version = "5.40.0"; }
				, item => { item.perl.useithreads = false; }
				, item => { item.perl.usemultiplicity = "unexpected"; }
				, item => { item.perl.archname = "aarch64-linux"; }
				, item => { item.perl.ivsize = "4"; }
				, item => { item.interpreterSha256 = "unrecorded"; });
		}
		else
		{
			for(const key of ["compilerFreeReplay", "sourceUnchangedAfterReplay"]) mutations.push(item => { item[key] = false; });
			mutations.push(item => { item.repeatedRuns = 0; });
		}
		if(profile === "dotnet" || profile === "php-native")
		{
			const env = item => profile === "dotnet" ? item.dotnetEnvironment : item.phpEnvironment;
			for(const field of ["bindingIrSha256", "runtimeIdentity", "name"])
				mutations.push(item => { const receipt = JSON.parse(env(item).receiptBytes); receipt[field] = "changed"; env(item).receiptBytes = canonicalJson(receipt); });
			mutations.push(item => { env(item).packageFileSetSha256 = "0".repeat(64); });
			for(const field of profile === "dotnet" ? ["inputs", "cacheFiles", "outputs", "buildInputs"] : ["inputs", "dependencyFiles", "generatedFiles", "vendorFiles"])
				mutations.push(item => { env(item)[field]["unrecorded"] = { bytes: 1, sha256: "0".repeat(64) }; });
			if(profile === "dotnet") mutations.push(item => { env(item).cacheFiles["subtypes.api/1.0.0/subtypes.api.1.0.0.nupkg"].sha256 = "0".repeat(64); });
			else mutations.push(item => { env(item).runtimeFlags = []; }
				, item => { env(item).feedFiles["component.zip"].sha256 = "0".repeat(64); }
				, item => { delete env(item).tools[env(item).command]; });
		}
		for(const mutate of mutations)
		{
			const report = structuredClone(original); mutate(report.reports[0]);
			const changed = new Map(base);
			changed.set("report.json", Buffer.from(canonicalJson(report)));
			changed.set(profile + ".json", Buffer.from(canonicalJson(report.reports[0])));
			await assert.rejects(() => assertReviewedSubtypeRemainingHostRecords({ profiles: [profile], read: path => changed.get(path) }));
			controls++;
		}
	}
	assert.equal(controls, 128);
});
