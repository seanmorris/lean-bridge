/**
 * Refuse partial preflight and preserve user edits during promotion rollback.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { commitPromotionFiles, promotionFileIdentity }
	from "./promotion-file-transaction.mjs";

const fixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-promotion-transaction-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const staging = join(root, "staged");
	await mkdir(staging);
	const files = [];
	for(const [number, name] of ["existing.md", "new.md"].entries())
	{
		if(number === 0) await writeFile(join(root, name), "Original documentation");
		const staged = join(staging, `next-${number}`);
		await writeFile(staged, `Updated documentation ${number}`);
		files.push({ path: name, staged
			, previous: await promotionFileIdentity(join(root, name))
			, next: await promotionFileIdentity(staged) });
	}
	return { root, staging, files };
};

test("promotion transaction installs a complete preflighted update", async t => {
	const options = await fixture(t);
	assert.deepEqual(await commitPromotionFiles(options), ["existing.md", "new.md"]);
	for(const file of options.files)
		assert.deepEqual(await promotionFileIdentity(join(options.root, file.path)), file.next);
	assert.equal(await readFile(join(options.staging, "previous-0"), "utf8")
		, "Original documentation");
});

test("promotion transaction preflights every file before any target changes", async t => {
	const options = await fixture(t);
	await writeFile(options.files[1].staged, "Changed staged file");
	await assert.rejects(commitPromotionFiles(options), /Staged promotion changed/u);
	assert.equal(await readFile(join(options.root, "existing.md"), "utf8")
		, "Original documentation");
	assert.equal(await promotionFileIdentity(join(options.root, "new.md")), null);
});

test("promotion transaction rolls back an installation failure", async t => {
	const options = await fixture(t);
	let count = 0;
	await assert.rejects(commitPromotionFiles(options, async (source, target) => {
		if(++count === 2) throw new Error("Injected rename failure");
		await rename(source, target);
	}), AggregateError);
	assert.equal(await readFile(join(options.root, "existing.md"), "utf8")
		, "Original documentation");
	assert.equal(await promotionFileIdentity(join(options.root, "new.md")), null);
});

test("promotion transaction never rolls back over a concurrent user edit", async t => {
	const options = await fixture(t);
	let count = 0;
	await assert.rejects(commitPromotionFiles(options, async (source, target) => {
		if(++count === 2)
		{
			await writeFile(join(options.root, "existing.md"), "User edit");
			throw new Error("Injected interruption");
		}
		await rename(source, target);
	}), error => error instanceof AggregateError && error.errors.length === 2);
	assert.equal(await readFile(join(options.root, "existing.md"), "utf8"), "User edit");
	assert.equal(await readFile(join(options.staging, "previous-0"), "utf8")
		, "Original documentation");
});

test("promotion transaction rejects target drift and unsafe selections", async t => {
	for(const mutate of [
		options => { options.files[1].path = "../escape"; }
		, options => { options.files[1].path = options.files[0].path; }
		, options => { options.files[1].staged = options.files[0].staged; }
		, options => { options.files[1].previous = options.files[0].previous; }
	]) {
		const options = await fixture(t); mutate(options);
		await assert.rejects(commitPromotionFiles(options), assert.AssertionError);
		assert.equal(await readFile(join(options.root, "existing.md"), "utf8")
			, "Original documentation");
	}
});
