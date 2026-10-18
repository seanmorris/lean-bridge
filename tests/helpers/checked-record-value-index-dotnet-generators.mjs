/**
 * Reconstruct the complete C# generator at the original producer revision.
 * Historical absolute paths remain provenance, never inputs to reopen.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { pathToFileURL } from "node:url";
import { moduleSpecifiers } from "./module-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const sources = new Map(), generators = new Map();
const entry = "src/backends/dotnet/copied-values.mjs";

/**
 * Read normalized repository paths at a full immutable revision.
 *
 * @param revision - Full producer commit.
 * @param path - Repository-relative source path.
 */
export const checkedRecordValueIndexDotnetOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path)
		&& !path.startsWith("/") && posix.normalize(path) === path
		&& path.split("/").every(part => part && part !== "." && part !== ".."), path);
	const key = `${revision}:${path}`;
	if(!sources.has(key))
		sources.set(key, execFileSync("git", ["show", key], { maxBuffer: 16 * 1024 * 1024 }));
	return Buffer.from(sources.get(key));
};

/**
 * Load only the recorded generator and all of its static transitive imports.
 *
 * @param revision - Full original producer commit.
 */
export const checkedRecordValueIndexDotnetGenerator = revision => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	if(!generators.has(revision)) generators.set(revision, (async () => {
		const closure = new Map();
		const visit = path => {
			assert.ok(path.startsWith("src/") && /\.(?:mjs|json)$/u.test(path)
				&& posix.normalize(path) === path, path);
			if(closure.has(path)) return;
			const bytes = checkedRecordValueIndexDotnetOriginal(revision, path);
			const source = bytes.toString();
			if(path.endsWith(".json"))
			{
				JSON.parse(source); closure.set(path, bytes); return;
			}
			assert.doesNotMatch(source, /\bimport\s*\(/u, path);
			const guard = "if(process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)";
			const checked = path === "src/release/component-package-receipt.mjs"
				? source.replace(guard, "") : source;
			assert.doesNotMatch(checked, /\bimport\.meta/u, path);
			closure.set(path, bytes);
			for(const specifier of moduleSpecifiers(source, path))
				visit(posix.normalize(posix.join(posix.dirname(path), specifier)));
		};
		visit(entry);
		const directory = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-dotnet-generator-"
		));
		try
		{
			for(const [path, bytes] of closure) await saveLakeFile(directory, path, bytes);
			const { generateCopiedDotnetPackage } = await import(pathToFileURL(join(directory, entry)).href);
			return Object.freeze({ generateCopiedDotnetPackage
				, paths: Object.freeze([...closure.keys()].sort()) });
		}
		finally
		{
			await rm(directory, { recursive: true });
		}
	})());
	return generators.get(revision);
};
