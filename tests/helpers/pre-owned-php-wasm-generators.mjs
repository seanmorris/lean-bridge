/**
 * Reconstruct frozen copied-PHP receipts with their authenticated generators.
 * Live package generation continues to use the current production modules.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
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

let recursiveCached;

const selectedExports = modules => Object.freeze({
	...modules.get("src/backends/php/copied-zend.mjs")
	, ...modules.get("src/backends/php/copied-graph-zend.mjs")
	, ...modules.get("src/backends/php/callable-graph-zend.mjs")
	, ...modules.get("src/build/php-wasm-graph-component.mjs")
});

const importHistoricalGenerators = async (
	selectedPaths, sources, directoryPrefix, ownedRecord
	, normalize = beforeFinRefinementSource
) => {
	const directory = await mkdtemp(join(tmpdir(), directoryPrefix));
	try
	{
		const replacements = new Map(selectedPaths.map(path => [resolve(path)
			, pathToFileURL(join(directory, path)).href]));
		for(const path of selectedPaths)
		{
			const target = sources[path];
			assert.match(target, /^[a-f0-9]{64}$/u, path);
			const current = normalize(
				path, await readFile(path, "utf8"), target);
			assert.equal(sha256(current), target, path);
			let source = current, expected = target;
			if(ownedRecord !== undefined)
			{
				source = beforeOwnedPhpWasmPackages(path, current);
				expected = ownedRecord.updates.find(
					update => update.path === path)?.previousSha256 ?? target;
			}
			assert.equal(sha256(source), expected, path);
			assert.doesNotMatch(source, /\bimport\s*\(|\bimport\.meta/u);
			source = source.replace(/\bfrom\s+"(\.[^"]+)"/gu, (_, specifier) => {
				const dependency = resolve(dirname(path), specifier);
				return "from " + JSON.stringify(replacements.get(dependency)
					?? pathToFileURL(dependency).href);
			});
			await saveLakeFile(directory, path, source);
		}
		const imported = new Map();
		for(const path of selectedPaths) imported.set(path
			, await import(pathToFileURL(join(directory, path)).href));
		return selectedExports(imported);
	}
	finally
	{ await rm(directory, { recursive: true, force: true }); }
};

/**
 * Import the seven-module generator closure with exact predecessor source bytes.
 * Every other dependency stays on its independently authenticated current path.
 */
export const preOwnedPhpWasmGenerators = () => cached ??= (async () => {
	const record = JSON.parse(await readFile(ownedPhpWasmHistoryPath, "utf8"));
	return importHistoricalGenerators(paths, record.sources
		, "lean-php-historical-generators-", record);
})();

/**
 * Import the exact generator closure retained by the recursive PHP-Wasm
 * execution record. This is distinct from the earlier pre-owned package
 * closure used by copied-package receipts.
 */
export const phpWasmRecursiveGenerators = () => recursiveCached ??= (async () => {
	const implementation = "7daacb859a45f3c90ba8739bd9396fa5d970813d";
	const directory = await mkdtemp(join(resolve("build")
		, "lean-php-recursive-generators-"));
	try
	{
		assert.equal(execFileSync("git", ["rev-parse", implementation]
			, { encoding: "utf8" }).trim(), implementation);
		const archive = execFileSync("git", ["archive", "--format=tar"
			, implementation, "src"], { maxBuffer: 512 * 1024 * 1024 });
		execFileSync("tar", ["-xf", "-", "-C", directory]
			, { input: archive, maxBuffer: 512 * 1024 * 1024 });
		const record = JSON.parse(await readFile(
			"docs/evidence/php-wasm-recursive-callables-20260926.json"
			, "utf8"));
		for(const [path, digest] of Object.entries(record.projectionSources))
			assert.equal(sha256(await readFile(join(directory, path)))
				, digest, path);
		const [component, model, native] = await Promise.all([
			import(pathToFileURL(join(directory
				, "src/build/php-wasm-graph-component.mjs")).href)
			, import(pathToFileURL(join(directory
				, "src/build/php-wasm-graph-model.mjs")).href)
			, import(pathToFileURL(join(directory
				, "src/build/native-callable-graph.mjs")).href)
		]);
		return Object.freeze({ ...component, ...model, ...native });
	}
	finally
	{ await rm(directory, { recursive: true, force: true }); }
})();
