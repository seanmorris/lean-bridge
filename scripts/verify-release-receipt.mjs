#!/usr/bin/env node
/**
 * Verifies the release receipt workflow.
 *
 * @file
 */


import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { verifyReleaseReceipt } from "../src/release/release-receipt.mjs";

const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index];
	const value = process.argv[index + 1];
	if(!name?.startsWith("--") || value === undefined || options.has(name)) throw new Error(`invalid option ${name ?? ""}`);
	options.set(name, value);
}
if(!options.has("--receipt") || !options.has("--policy"))
{
	throw new Error("--receipt and --policy are required");
}
const policy = JSON.parse(await readFile(resolve(options.get("--policy")), "utf8"));
const result = await verifyReleaseReceipt({
	receiptPath: resolve(options.get("--receipt"))
	, policy
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
