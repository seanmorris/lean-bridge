/**
 * Load an ES module from its exact Git producer revision and complete relative
 * import closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { bytesAtProducer } from "./producer-source.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const modules = new Map();
const revisionPattern = /^[a-f0-9]{40}$/u;
const modulePathPattern = /^(?:scripts|site|src|tests)\/(?:[^/]+\/)*[^/]+\.mjs$/u;
const sourcePathPattern = /^(?:scripts|site|src|tests)\/(?:[^/]+\/)*[^/]+\.(?:json|mjs)$/u;

/**
 * Import one immutable producer module without consulting current source.
 *
 * @param revision - Full producer commit identity.
 * @param entry - Repository-relative module entry point.
 */
export const moduleAtProducer = (revision, entry) => {
	assert.match(revision, revisionPattern);
	assert.match(entry, modulePathPattern);
	assert.equal(posix.normalize(entry), entry);
	const key = `${revision}:${entry}`;
	if(!modules.has(key)) modules.set(key, (async () => {
		const closure = new Map();
		const visit = path => {
			assert.match(path, sourcePathPattern);
			assert.equal(posix.normalize(path), path);
			if(closure.has(path)) return;
			const bytes = bytesAtProducer(revision, path);
			closure.set(path, bytes);
			if(path.endsWith(".json"))
			{
				JSON.parse(bytes);
				return;
			}
			for(const specifier of moduleSpecifiers(bytes.toString("utf8"), path))
			{
				const joined = posix.normalize(posix.join(
					posix.dirname(path), specifier
				));
				visit(posix.extname(joined) === "" ? `${joined}.mjs` : joined);
			}
		};
		visit(entry);
		const root = resolve("build");
		await mkdir(root, { recursive: true });
		const directory = await mkdtemp(join(root, ".producer-module-"));
		try
		{
			for(const [path, bytes] of closure)
				await saveLakeFile(directory, path, bytes);
			return await import(pathToFileURL(join(directory, entry)).href);
		}
		finally
		{
			await rm(directory, { recursive: true, force: true });
		}
	})());
	return modules.get(key);
};
