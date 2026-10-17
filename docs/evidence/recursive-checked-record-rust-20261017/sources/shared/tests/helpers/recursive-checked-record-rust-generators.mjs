/**
 * Reconstruct the exact historical Rust graph generator and dependency lock.
 * Recorded producer paths are provenance, never files to reopen on this host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { pathToFileURL } from "node:url";
import { moduleSpecifiers } from "./module-closure.mjs";
import { nominalSubtypeRustOriginal } from "./nominal-subtype-rust-generators.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const graphEntry = "src/backends/rust/copied-graph-package.mjs";
const lockEntry = "src/backends/rust/copied-values.mjs";
const metadataEntry = "src/analyze/package-metadata.mjs";
const resource = "src/backends/rust/dependencies.lock";
const generators = new Map();

export const recursiveCheckedRecordRustOriginal = nominalSubtypeRustOriginal;

/**
 * Load every transitive source and compute both fixture locks before cleanup.
 *
 * @param revision - Full immutable producer revision.
 */
export const recursiveCheckedRecordRustGenerator = revision => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	if(!generators.has(revision)) generators.set(revision, (async () => {
		const closure = new Map();
		const visit = path => {
			assert.ok(path.startsWith("src/")
				&& (/\.(?:mjs|json)$/u.test(path) || path === resource)
				&& posix.normalize(path) === path, path);
			if(closure.has(path)) return;
			const bytes = recursiveCheckedRecordRustOriginal(revision, path);
			const source = bytes.toString();
			if(path === resource)
			{
				closure.set(path, bytes);
				return;
			}
			if(path.endsWith(".json"))
			{
				JSON.parse(source);
				closure.set(path, bytes);
				return;
			}
			assert.doesNotMatch(source, /\bimport\s*\(/u, path);
			const guard = "if(process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)";
			const resourceUse = 'new URL("./dependencies.lock", import.meta.url)';
			let checked = path === "src/release/component-package-receipt.mjs"
				? source.replace(guard, "") : source;
			if(path === lockEntry)
			{
				assert.ok(checked.includes(resourceUse));
				checked = checked.replace(resourceUse, "");
				visit(resource);
			}
			assert.doesNotMatch(checked, /\bimport\.meta/u, path);
			closure.set(path, bytes);
			for(const specifier of moduleSpecifiers(source, path))
				visit(posix.normalize(posix.join(posix.dirname(path), specifier)));
		};
		visit(graphEntry);
		visit(lockEntry);
		visit(metadataEntry);
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-rust-generator-"));
		try
		{
			for(const [path, bytes] of closure) await saveLakeFile(directory, path, bytes);
			const graph = await import(pathToFileURL(join(directory, graphEntry)).href);
			const { copiedRustLock } = await import(pathToFileURL(join(directory, lockEntry)).href);
			const { compiledPackageMetadata } = await import(
				pathToFileURL(join(directory, metadataEntry)).href);
			const locks = Object.fromEntries(await Promise.all([
				"recursivecheckedrecords", "mutualcheckedrecords"
			].map(async name => [name, await copiedRustLock(name, "1.0.0")])));
			return Object.freeze({
				compileCopiedRustGraphPackageModel: graph.compileCopiedRustGraphPackageModel
				, generateCopiedRustGraphPackage: graph.generateCopiedRustGraphPackage
				, compiledPackageMetadata
				, locks: Object.freeze(locks)
				, paths: Object.freeze([...closure.keys()].sort())
			});
		}
		finally
		{
			await rm(directory, { recursive: true });
		}
	})());
	return generators.get(revision);
};
