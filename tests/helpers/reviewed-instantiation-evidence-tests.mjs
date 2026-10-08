/**
 * Test installed reviewed record evidence without rerunning its compilers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertReviewedInstantiationArchive, assertReviewedInstantiationReport, assertReviewedInstantiationTap, reviewedInstantiationEvidenceDirectory as directory, reviewedInstantiationEvidenceReceipt, writeReviewedInstantiationArtifact } from "./reviewed-instantiation-evidence.mjs";

test("reviewed instantiation archive authenticates both producers and preserves weaker attempts", async () => {
	const bytes = await readFile(`${directory}/receipt.json`);
	assert.equal(sha256(bytes), "3cc7ab64f600c37c5c85705a24f64c41ebe1569f20470ec27173f56495b811e9");
	const receipt = JSON.parse(bytes);
	await assertReviewedInstantiationArchive(receipt);
	assert.equal(receipt.artifacts.length, 15);
	assert.deepEqual(receipt.earlierAttempts.map(item => item.revision), ["3c2d5800cfcfc08b6506e6ee05af718772b4208e", "4bab1c77f750e5420bde7a8ecc9b6f03467fff6b"]);
});

test("reviewed record reports reject weakened isolation, missing specializations and mismatched receipts", async () => {
	for(const host of ["native", "npm"]) for(const composed of [false, true])
	{
		const original = JSON.parse(await readFile(`${directory}/${host}-${composed ? "composed" : "direct"}.json`, "utf8"));
		const item = report => host === "npm" ? report : report.reports[0];
		const mutations = [
			report => { report.reproducible = false; }
			, report => { item(report).sourceRemovedBeforeInstallation = false; }
			, report => { item(report).offlineInstall = false; }
			, report => { item(report).compilerFreePath = false; }
			, report => { item(report).path = "ordinary-source"; }
			, report => { item(report).checks--; }
			, report => { item(report).profile = "browser-javascript"; }
			, report => { delete item(report).instantiations.NatBoxAgain; }
			, report => { item(report).reviewedBindingIrSha256 = "0".repeat(64); }
			, report => { item(report).consumerSha256 = "0".repeat(64); }
			, report => { if(composed) item(report).specializations.pop(); else item(report).specializations = []; }
		];
		if(host === "npm") mutations.push(
			report => { report.independentBuilds = 1; }
			, report => { report.rejections--; }
			, report => { report.typescript.strict = false; }
			, report => { report.typescript.skipLibCheck = true; }
			, report => { report.receipt.package.sha256 = "0".repeat(64); }
			, report => { report.receipt.policies.runtimeShared = false; }
			, report => { report.runtimeArchiveSha256 = "0".repeat(64); }
		);
		else mutations.push(
			report => { report.reports.pop(); }
			, report => { report.archives.extra = "0".repeat(64); }
			, report => { report.reports[1].modelSha256 = "0".repeat(64); }
			, report => { report.reports[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
		);
		for(const mutate of mutations)
		{
			const changed = structuredClone(original); mutate(changed);
			await assert.rejects(assertReviewedInstantiationReport(changed, host, composed));
		}
	}
});

test("each reviewed record queue must actually execute both selections without skips", async () => {
	for(const host of ["native", "npm"])
	{
		const original = await readFile(`${directory}/${host}.tap`, "utf8");
		const mutations = [
			text => text.replace("# pass 1", "# pass 0")
			, text => text.replace("# skipped 0", "# skipped 1")
			, text => text.replace("exit=0", "exit=1")
			, text => text.replace("ok 1 - ", "not ok 1 - ")
			, text => text.replace("1..1\n", "1..1\n1..1\n")
			, text => text.slice(text.indexOf("# step ", 1))
			, text => text.replace(/^ok 1 - .+$/mu, "$& # SKIP")
		];
		for(const mutate of mutations) assert.throws(() => assertReviewedInstantiationTap(mutate(original), host));
	}
});

test("reviewed archive rejects foreign paths before reading and authenticates the current producer sources", async () => {
	const original = reviewedInstantiationEvidenceReceipt();
	for(const path of ["/etc/passwd", "../outside", `${directory}/unexpected.json`])
	{
		const changed = structuredClone(original); changed.artifacts[0].path = path;
		let reads = 0;
		await assert.rejects(assertReviewedInstantiationArchive(changed, async () => { reads++; return Buffer.alloc(0); }));
		assert.equal(reads, 0);
	}
	for(const path of [original.artifacts[0].path, ...original.producers.native.files.map(item => item.path)])
		await assert.rejects(assertReviewedInstantiationArchive(original, async file => {
			const bytes = await readFile(file);
			return file === path ? Buffer.concat([bytes, Buffer.from("\n// unknown edit\n")]) : bytes;
		}));
});

test("reviewed record archive writes preserve exact originals and refuse overwrites", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-instantiation-evidence-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const path = join(root, "archive", "original.txt"), bytes = Buffer.from("original\n");
	await writeReviewedInstantiationArtifact(path, bytes);
	await writeReviewedInstantiationArtifact(path, bytes);
	await assert.rejects(writeReviewedInstantiationArtifact(path, Buffer.from("changed\n")));
	assert.deepEqual(await readFile(path), bytes);
});
