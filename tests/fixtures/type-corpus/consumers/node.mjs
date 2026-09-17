/**
 * Source-free public npm consumer, also used by the strict TypeScript program.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executeCorpus } from "./javascript.mjs";
export { floatFromBits } from "./javascript.mjs";

/** Load only the supplied host-neutral cases and Lean oracle results. */
export const loadRequest = async () => JSON.parse(await readFile(process.argv[2], "utf8"));

/**
 * Exercise installed exports, host rejections and recovery against fresh Lean.
 *
 * @param request - Serialized catalog cases and oracle results.
 * @param api - Installed public package namespace.
 * @param typedCall - Optional compiled TypeScript case dispatcher.
 */
export const runCorpus = async (request, api, typedCall) => {
	const modulePath = await realpath(fileURLToPath(import.meta.resolve(request.module)));
	assert.ok(modulePath.startsWith(`${await realpath(request.installRoot)}/node_modules/`));
	process.stdout.write(JSON.stringify({ schemaVersion: 1
		, profile: request.profile, module: request.module
		, hostVersion: process.versions.node, modulePath
		, results: executeCorpus(request, api, typedCall) }));
};

if(process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
{
	const request = await loadRequest();
	await runCorpus(request, await import(request.module));
}
