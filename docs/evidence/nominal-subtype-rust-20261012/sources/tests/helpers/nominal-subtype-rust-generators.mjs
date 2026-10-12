/**
 * Reconstruct the exact historical Rust generator, including its lock resource.
 * Recorded producer paths are provenance, never files to reopen on this host.
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
const entry = "src/backends/rust/copied-values.mjs";
const resource = "src/backends/rust/dependencies.lock";

/**
 * Require immutable revisions and normalized repository paths.
 *
 * @param revision - Full producer commit.
 * @param path - Repository-relative input path.
 */
export const nominalSubtypeRustOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(/^(?:src|tests)\//u.test(path) && posix.normalize(path) === path);
	const key = `${revision}:${path}`;
	if(!sources.has(key)) sources.set(key, execFileSync("git", ["show", key], { maxBuffer: 16 * 1024 * 1024 }));
	return Buffer.from(sources.get(key));
};

/**
 * Load all transitive imports and invoke the original lock generator before cleanup.
 * Only this fixture's fixed package coordinates are accepted for the lock output.
 *
 * @param revision - Frozen producer revision.
 */
export const nominalSubtypeRustGenerator = revision => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	if(!generators.has(revision)) generators.set(revision, (async () => {
		const closure = new Map();
		const visit = path => {
			assert.ok(path.startsWith("src/") && (/\.(?:mjs|json)$/u.test(path) || path === resource) && posix.normalize(path) === path, path);
			if(closure.has(path)) return;
			const bytes = nominalSubtypeRustOriginal(revision, path), source = bytes.toString();
			if(path === resource)
{ closure.set(path, bytes); return; }
			if(path.endsWith(".json"))
{ JSON.parse(source); closure.set(path, bytes); return; }
			assert.doesNotMatch(source, /\bimport\s*\(/u, path);
			const guard = "if(process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)";
			const resourceUse = 'new URL("./dependencies.lock", import.meta.url)';
			let checked = path === "src/release/component-package-receipt.mjs" ? source.replace(guard, "") : source;
			if(path === entry)
			{
				assert.ok(checked.includes(resourceUse));
				checked = checked.replace(resourceUse, ""); visit(resource);
			}
			assert.doesNotMatch(checked, /\bimport\.meta/u, path);
			closure.set(path, bytes);
			for(const specifier of moduleSpecifiers(source, path))
				visit(posix.normalize(posix.join(posix.dirname(path), specifier)));
		};
		visit(entry);
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-rust-generator-"));
		try
		{
			for(const [path, bytes] of closure) await saveLakeFile(directory, path, bytes);
			const { generateCopiedRustPackage, copiedRustLock } = await import(pathToFileURL(join(directory, entry)).href);
			const lock = await copiedRustLock("nominalsubtypes", "1.0.0");
			return Object.freeze({ generateCopiedRustPackage, lock, paths: Object.freeze([...closure.keys()].sort()) });
		}
		finally
{ await rm(directory, { recursive: true }); }
	})());
	return generators.get(revision);
};
