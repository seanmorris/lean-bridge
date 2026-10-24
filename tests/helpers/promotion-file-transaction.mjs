/**
 * Install a preflighted maintainer update with byte-checked rollback copies.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { copyFile, lstat, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";

const safeRelative = path => {
	assert.ok(typeof path === "string" && !isAbsolute(path)
		&& !/[\\:\0]/u.test(path)
		&& path.split("/").every(part => part && part !== "." && part !== "..")
	, `Unsafe promotion path: ${path}`);
};

/**
 * Hash one regular file without reading it into memory. Missing files are null.
 *
 * @param path - Exact file path.
 */
export const promotionFileIdentity = async path => {
	let information;
	try
	{
		information = await lstat(path);
	}
	catch(error)
	{
		if(error.code === "ENOENT") return null;
		throw error;
	}
	assert.ok(information.isFile(), `Promotion file must be regular: ${path}`);
	const digest = createHash("sha256");
	let bytes = 0;
	for await(const chunk of createReadStream(path))
	{
		digest.update(chunk);
		bytes += chunk.length;
	}
	assert.equal(bytes, information.size, `Promotion file size changed: ${path}`);
	return { bytes, sha256: digest.digest("hex") };
};

/**
 * Check every source and destination before installing any file. Failed
 * installation restores only files that still equal our own staged bytes;
 * external edits are never overwritten and recovery copies remain available.
 *
 * @param options - Complete preflighted update.
 * @param options.root - Repository root.
 * @param options.staging - Fresh staging directory inside the repository.
 * @param options.files - Relative target, staged source, previous and next identities.
 * @param move - Rename operation, injectable for failure controls.
 */
export const commitPromotionFiles = async ({ root, staging, files }, move = rename) => {
	root = await realpath(root);
	staging = await realpath(staging);
	safeRelative(relative(root, staging));
	assert.ok(files.length > 0);
	assert.equal(new Set(files.map(file => file.path)).size, files.length);
	assert.equal(new Set(files.map(file => file.staged)).size, files.length);
	const prepared = [];
	for(const [number, file] of files.entries())
	{
		safeRelative(file.path);
		const target = join(root, file.path);
		assert.ok(!target.startsWith(staging + "/"), "Promotion targets must be outside staging");
		assert.equal(await realpath(dirname(target)), dirname(target)
			, "Promotion target parent must not contain symlinks");
		assert.equal(await realpath(file.staged), file.staged);
		safeRelative(relative(staging, file.staged));
		assert.notEqual(file.staged, target);
		assert.ok(file.next && Number.isSafeInteger(file.next.bytes)
			&& file.next.bytes >= 0 && /^[a-f0-9]{64}$/u.test(file.next.sha256));
		assert.deepEqual(await promotionFileIdentity(file.staged), file.next
			, `Staged promotion changed: ${file.path}`);
		assert.deepEqual(await promotionFileIdentity(target), file.previous
			, `Promotion target changed: ${file.path}`);
		const backup = join(staging, `previous-${number}`);
		if(file.previous !== null)
		{
			await copyFile(target, backup, constants.COPYFILE_EXCL);
			assert.deepEqual(await promotionFileIdentity(backup), file.previous
				, `Promotion backup changed: ${file.path}`);
		}
		prepared.push({ ...file, target, backup });
	}
	await writeFile(join(staging, "transaction.json"), JSON.stringify({
		schemaVersion: 1, root, files: prepared
	}, null, 2) + "\n", { flag: "wx" });
	const installed = [];
	try
	{
		for(const file of prepared)
		{
			assert.deepEqual(await promotionFileIdentity(file.staged), file.next
				, `Staged promotion changed during installation: ${file.path}`);
			assert.deepEqual(await promotionFileIdentity(file.target), file.previous
				, `Promotion target changed during installation: ${file.path}`);
			await move(file.staged, file.target);
			installed.push(file);
		}
		return prepared.map(file => file.path);
	}
	catch(error)
	{
		const errors = [error];
		for(const file of installed.toReversed())
		{
			try
			{
				assert.deepEqual(await promotionFileIdentity(file.target), file.next
					, `Cannot roll back an external edit: ${file.path}`);
				if(file.previous === null) await unlink(file.target);
				else
				{
					assert.deepEqual(await promotionFileIdentity(file.backup), file.previous);
					await rename(file.backup, file.target);
				}
			}
			catch(rollbackError)
			{
				errors.push(rollbackError);
			}
		}
		throw new AggregateError(errors
			, `Promotion installation failed; recovery files retained in ${staging}`
			, { cause: error });
	}
};
