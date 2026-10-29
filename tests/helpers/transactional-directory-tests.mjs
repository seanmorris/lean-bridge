/**
 * Tests for copy-free publication of large evidence directories.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile }
	from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	createTransactionalDirectory
} from "../../src/capsule/transactional-directory.mjs";

test("transactional directory publication renames the staged inode", async () => {
	const parent = await mkdtemp(join(tmpdir(), "lean-transactional-directory-"));
	try
	{
		const destination = join(parent, "evidence");
		const transaction = await createTransactionalDirectory(destination);
		const staged = join(transaction.root, "nested", "record.bin");
		await mkdir(join(transaction.root, "nested"));
		await writeFile(staged, Buffer.from("retained evidence"), { flag: "wx" });
		const before = await stat(staged);
		await transaction.publish();
		await transaction.dispose();
		const published = join(destination, "nested", "record.bin");
		const after = await stat(published);
		assert.equal(after.ino, before.ino);
		assert.equal((await readFile(published)).toString(), "retained evidence");
		await assert.rejects(access(transaction.root), { code: "ENOENT" });
	}
	finally
	{ await rm(parent, { recursive: true }); }
});

test("transactional directory disposal removes an unpublished tree", async () => {
	const parent = await mkdtemp(join(tmpdir(), "lean-transactional-dispose-"));
	try
	{
		const destination = join(parent, "evidence");
		const transaction = await createTransactionalDirectory(destination);
		await writeFile(join(transaction.root, "partial"), "partial");
		await transaction.dispose();
		await transaction.dispose();
		await assert.rejects(access(transaction.root), { code: "ENOENT" });
		await assert.rejects(access(destination), { code: "ENOENT" });
		await assert.rejects(transaction.publish(), /not open/u);
	}
	finally
	{ await rm(parent, { recursive: true }); }
});

test("transactional publication refuses a destination created mid-flight", async () => {
	const parent = await mkdtemp(join(tmpdir(), "lean-transactional-collision-"));
	try
	{
		const destination = join(parent, "evidence");
		const transaction = await createTransactionalDirectory(destination);
		await mkdir(destination);
		await assert.rejects(transaction.publish());
		await transaction.dispose();
		assert.ok((await stat(destination)).isDirectory());
	}
	finally
	{ await rm(parent, { recursive: true }); }
});
