#!/usr/bin/env node

import { resolve } from "node:path";

import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";

const options = new Map();
for(let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
if(!options.get("--receipt")) throw new Error("--receipt is required");
const result = await verifyComponentPackageReceipt({
	receiptPath: resolve(options.get("--receipt"))
	, artifactRoot: options.get("--artifacts") ? resolve(options.get("--artifacts")) : null
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
