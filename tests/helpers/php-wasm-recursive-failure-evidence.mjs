/**
 * Keep a failed recursive PHP-Wasm probe available for diagnosis in CI.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

const errorRecord = (error, seen = new Set()) => {
	if(!error || typeof error !== "object") return { message: String(error) };
	if(seen.has(error)) return { message: "Repeated error cause" };
	seen.add(error);
	return { name: error.name, message: error.message, stack: error.stack
		, code: error.code, details: error.details
		, ...error.cause ? { cause: errorRecord(error.cause, seen) } : {} };
};

/**
 * Remove successful scratch only; retain original failing inputs and diagnostics.
 *
 * @param check - Operation receiving a fresh probe directory.
 * @param options - Test-owned output parent and diagnostic reporter.
 * @param options.parent - Parent uploaded by the PHP-Wasm CI job.
 * @param options.diagnostic - Reports retained evidence without hiding failure.
 */
export const withPhpWasmRecursiveFailureEvidence = async (check, {
	parent = resolve("build/recursive-callables"), diagnostic = () => {}
} = {}) => {
	await mkdir(parent, { recursive: true });
	const directory = await mkdtemp(join(parent, "php-wasm-generated-failure-"));
	let result;
	try
	{
		result = await check(directory);
	}
	catch(error)
	{
		try
		{
			const sources = {};
			for(const path of ["src/build/process-runner.mjs"
				, "tests/helpers/php-wasm-recursive-callable-generated.mjs"
				, "tests/helpers/php-wasm-recursive-failure-evidence.mjs"])
				sources[path] = sha256(await readFile(path));
			const record = { schemaVersion: 1, at: new Date().toISOString()
				, cwd: process.cwd(), directory, platform: process.platform
				, arch: process.arch
				, node: { executable: process.execPath, version: process.version
					, sha256: sha256(await readFile(process.execPath)) }
				, sources, error: errorRecord(error) };
			await writeFile(join(directory, "failure.json"), canonicalJson(record), { flag: "wx" });
		}
		catch(retentionError)
		{
			diagnostic(`Could not record failure metadata in ${directory}: ${retentionError.message}`);
			throw new AggregateError([error, retentionError], "PHP-Wasm probe and diagnostic recording failed", { cause: retentionError });
		}
		diagnostic(`Original failing PHP-Wasm probe retained in ${directory}`);
		throw error;
	}
	await rm(directory, { recursive: true });
	return result;
};
