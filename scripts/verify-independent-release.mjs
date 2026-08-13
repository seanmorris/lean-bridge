#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyIndependentRelease } from "../src/release/independent-verifier.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index];
	const value = process.argv[index + 1];
	if(!name?.startsWith("--") || value === undefined) throw new Error(`invalid option ${name ?? ""}`);
	options.set(name, value);
}
for(const required of ["--repository", "--published"])
{
	if(!options.has(required)) throw new Error(`${required} is required`);
}
const result = await verifyIndependentRelease({
	repository: options.get("--repository")
	, revision: options.get("--revision") ?? null
	, published: options.get("--published")
	, outputRoot: resolve(repositoryRoot, options.get("--output") ?? "build/independent-confirmation")
	, verifierIdentity: options.get("--verifier") ?? null
	, reportUrl: options.get("--report-url") ?? null
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
