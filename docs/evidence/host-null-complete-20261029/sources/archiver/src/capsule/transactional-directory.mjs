/**
 * Build a directory beside its destination and publish it with one rename.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdtemp, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/**
 * Create an unpublished sibling directory for a large immutable artifact.
 *
 * The caller writes only below `root`, calls `publish` once after complete
 * validation, and always calls `dispose` from `finally`. A published tree is
 * never removed by `dispose`.
 *
 * @param destination - Repository-relative or absolute final directory.
 */
export const createTransactionalDirectory = async destination => {
	assert.ok(typeof destination === "string" && destination.length > 0
		&& !/[\0\r\n]/u.test(destination));
	await assert.rejects(access(destination), { code: "ENOENT" });
	const root = await mkdtemp(join(dirname(destination)
		, `.${basename(destination)}-staging-`));
	let state = "open";
	return Object.freeze({
		root
		, publish: async () => {
			assert.equal(state, "open", "Transactional directory is not open");
			await assert.rejects(access(destination), { code: "ENOENT" });
			await rename(root, destination);
			state = "published";
		}
		, dispose: async () => {
			if(state !== "open") return;
			await rm(root, { recursive: true, force: true });
			state = "disposed";
		}
	});
};
