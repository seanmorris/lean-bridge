/**
 * Test receipt-only handoffs with inert archives; these are not installed claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { copyComponentPackageHandoff } from "./component-package-handoff.mjs";
import { createLocalHandoff } from "./component-receipt-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";

test("the npm handoff contains only receipt, verifier and both exact archives after author removal", async t => {
	const author = await createLocalHandoff(t), consumer = await mkdtemp(join(tmpdir(), "lean-bridge-handoff-consumer-"));
	t.after(() => rm(consumer, { recursive: true, force: true }));
	await saveLakeFile(author.directory, "source/Main.lean", "def privateSource := 7\n");
	await saveLakeFile(author.directory, "build/private.o", "not part of the release\n");
	const release = await copyComponentPackageHandoff(author.directory, join(consumer, "release"));
	assert.deepEqual(release.receipt, author.receipt);
	assert.deepEqual((await readdir(release.output)).sort(), [
		"component-package-receipt.json", "runtime.tgz", "sample.tgz"
		, "verify-component-package-receipt.mjs"
	]);
	await rm(author.directory, { recursive: true, force: true });
	await assert.rejects(stat(author.directory), { code: "ENOENT" });
	assert.deepEqual(await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") }), release.verified);
	assert.equal(await readFile(release.componentArchive, "utf8"), "component archive bytes\n");
	assert.equal(await readFile(release.runtimeArchive, "utf8"), "runtime archive bytes\n");
	await saveLakeFile(release.output, "sample.tgz", "altered consumer archive\n");
	await assert.rejects(verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") }), /archive differs/u);
});

test("the npm handoff refuses producer-contained destinations and altered archives", async t => {
	const author = await createLocalHandoff(t), consumer = await mkdtemp(join(tmpdir(), "lean-bridge-handoff-refusal-"));
	t.after(() => rm(consumer, { recursive: true, force: true }));
	for(const path of [author.directory, dirname(author.directory), join(author.directory, "copy")])
		await assert.rejects(copyComponentPackageHandoff(author.directory, path), /separate consumer/u);
	await saveLakeFile(consumer, "existing/keep", "consumer-owned bytes\n");
	await assert.rejects(copyComponentPackageHandoff(author.directory, join(consumer, "existing")), { code: "EEXIST" });
	assert.equal(await readFile(join(consumer, "existing/keep"), "utf8"), "consumer-owned bytes\n");
	await saveLakeFile(author.directory, "runtime.tgz", "altered producer archive\n");
	await assert.rejects(copyComponentPackageHandoff(author.directory, join(consumer, "release")), /archive differs/u);
	await assert.rejects(stat(join(consumer, "release")), { code: "ENOENT" });
});
