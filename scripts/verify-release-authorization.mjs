#!/usr/bin/env node
/**
 * Verifies the release authorization workflow.
 *
 * @file
 */


import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyReleaseAuthorization } from "../src/release/reproducibility-gate.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index];
	const value = process.argv[index + 1];
	if(!name?.startsWith("--") || value === undefined) throw new Error(`invalid option ${name ?? ""}`);
	options.set(name, value);
}
if(!options.has("--authorization") || !options.has("--candidate"))
{
	throw new Error("--authorization and --candidate are required");
}
const result = await verifyReleaseAuthorization({
	authorizationRoot: resolve(repositoryRoot, options.get("--authorization"))
	, candidateRoot: resolve(repositoryRoot, options.get("--candidate"))
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
