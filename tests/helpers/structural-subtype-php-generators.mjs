/**
 * Replay archived PHP APIs with their producer's complete JavaScript closure.
 * No current generator module or historical installation path is used.
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

const generators = new Map();

/**
 * Import exact Git blobs for the original PHP generator and every relative import.
 *
 * @param producerCommit - Full immutable Git revision authenticated by the archive.
 */
export const structuralSubtypePhpGenerators = producerCommit => {
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	if(!generators.has(producerCommit)) generators.set(producerCommit, (async () => {
		const entry = "src/backends/php/copied-values.mjs", sources = new Map();
		const visit = path => {
			assert.ok(path.startsWith("src/") && path.endsWith(".mjs") && posix.normalize(path) === path);
			if(sources.has(path)) return;
			const source = execFileSync("git", ["show", `${producerCommit}:${path}`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
			// This frozen closure needs neither data-file lookups nor dynamic imports.
			assert.doesNotMatch(source, /\bimport\.meta|\bimport\s*\(/u, path);
			sources.set(path, source);
			for(const specifier of moduleSpecifiers(source, path))
				visit(posix.normalize(posix.join(posix.dirname(path), specifier)));
		};
		visit(entry);
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-structural-php-producer-"));
		try
		{
			for(const [path, source] of sources) await saveLakeFile(directory, path, source);
			const values = await import(pathToFileURL(join(directory, entry)).href);
			const model = await import(pathToFileURL(join(directory, "src/backends/php/copied-model.mjs")).href);
			return Object.freeze({ ...values, ...model });
		}
		finally
		{ await rm(directory, { recursive: true, force: true }); }
	})());
	return generators.get(producerCommit);
};
