/**
 * Reconstruct frozen copied-PHP receipts with their authenticated generators.
 * Live package generation continues to use the current production modules.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedPhpWasmPackages, ownedPhpWasmHistoryPath } from "./owned-php-wasm-source-history.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const paths = [
	"src/backends/php/php-wasm-copied-loader.mjs"
	, "src/backends/php/zend-callables.mjs"
	, "src/backends/php/copied-zend.mjs"
	, "src/backends/php/copied-graph-zend.mjs"
	, "src/backends/php/callable-graph-zend-php.mjs"
	, "src/backends/php/callable-graph-zend.mjs"
	, "src/build/php-wasm-graph-component.mjs"
];
let cached;

/**
 * Import the seven-module generator closure with exact predecessor source bytes.
 * Every other dependency stays on its independently authenticated current path.
 */
export const preOwnedPhpWasmGenerators = () => cached ??= (async () => {
	const record = JSON.parse(await readFile(ownedPhpWasmHistoryPath, "utf8"));
	const directory = await mkdtemp(join(tmpdir(), "lean-php-historical-generators-"));
	try
	{
		const replacements = new Map(paths.map(path => [resolve(path), pathToFileURL(join(directory, path)).href]));
		for(const path of paths)
		{
			const current = await readFile(path, "utf8");
			assert.equal(sha256(current), record.sources[path], path);
			let source = beforeOwnedPhpWasmPackages(path, current);
			const expected = record.updates.find(update => update.path === path)?.previousSha256 ?? record.sources[path];
			assert.equal(sha256(source), expected, path);
			assert.doesNotMatch(source, /\bimport\s*\(|\bimport\.meta/u);
			// These authenticated generator modules have only static named imports.
			source = source.replace(/\bfrom\s+"(\.[^"]+)"/gu, (_, specifier) => {
				const dependency = resolve(dirname(path), specifier);
				return "from " + JSON.stringify(replacements.get(dependency) ?? pathToFileURL(dependency).href);
			});
			await saveLakeFile(directory, path, source);
		}
		const modules = await Promise.all(paths.map(path => import(pathToFileURL(join(directory, path)).href)));
		return Object.freeze({ ...modules[2], ...modules[3], ...modules[5], ...modules[6] });
	}
	finally
	{ await rm(directory, { recursive: true, force: true }); }
})();
