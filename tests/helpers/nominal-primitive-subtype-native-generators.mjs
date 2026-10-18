/**
 * Reconstruct the original C/C++ generators from its complete frozen Git closure.
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

/**
 * Read an immutable repository file, rejecting revisions and paths outside this contract.
 *
 * @param revision - Full producer commit.
 * @param path - Repository-relative source path.
 */
export const nominalPrimitiveSubtypeNativeOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(/^(?:src|tests)\//u.test(path) && posix.normalize(path) === path);
	const key = `${revision}:${path}`;
	if(!sources.has(key)) sources.set(key, execFileSync("git", ["show", key], { maxBuffer: 16 * 1024 * 1024 }));
	return Buffer.from(sources.get(key));
};

/**
 * Load the exact historical generator and every transitive relative import.
 *
 * @param revision - Frozen Git revision, independent of the current checkout.
 */
export const nominalPrimitiveSubtypeNativeGenerators = revision => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	if(!generators.has(revision)) generators.set(revision, (async () => {
		const entries = [
			"src/backends/c/generate.mjs", "src/backends/c/gmp-projection.mjs"
			, "src/backends/cpp/generate.mjs", "src/backends/cpp/boost.mjs"
			, "src/backends/c/graph-package.mjs"
			, "src/build/native-graph-sources.mjs"
		], closure = new Map();
		const visit = path => {
			assert.ok(path.startsWith("src/") && /\.(?:mjs|json)$/u.test(path) && posix.normalize(path) === path, path);
			if(closure.has(path)) return;
			const bytes = nominalPrimitiveSubtypeNativeOriginal(revision, path), source = bytes.toString();
			if(path.endsWith(".json"))
			{ JSON.parse(source); closure.set(path, bytes); return; }
			assert.doesNotMatch(source, /\bimport\s*\(/u, path);
			const guard = "if(process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)";
			assert.doesNotMatch(path === "src/release/component-package-receipt.mjs" ? source.replace(guard, "") : source, /\bimport\.meta/u, path);
			closure.set(path, bytes);
			for(const specifier of moduleSpecifiers(source, path))
				visit(posix.normalize(posix.join(posix.dirname(path), specifier)));
		};
		for(const entry of entries) visit(entry);
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-native-generators-"));
		try
		{
			for(const [path, bytes] of closure) await saveLakeFile(directory, path, bytes);
			const modules = await Promise.all(entries.map(entry => import(pathToFileURL(join(directory, entry)).href)));
			return { generateCBindingPackage: modules[0].generateCBindingPackage
				, generateGmpProjection: modules[1].generateGmpProjection
				, generateCppBindingPackage: modules[2].generateCppBindingPackage
				, boostSources: modules[3].boostSources
				, generateCopiedGraphPackage: modules[4].generateCopiedGraphPackage
				, nativeGraphProjectionSources: modules[5].nativeGraphProjectionSources
				, nativeGraphRefinementDiagnostics: modules[5].nativeGraphRefinementDiagnostics
				, paths: Object.freeze([...closure.keys()].sort()) };
		}
		finally
		{ await rm(directory, { recursive: true }); }
	})());
	return generators.get(revision);
};
