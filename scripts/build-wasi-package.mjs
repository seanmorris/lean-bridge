#!/usr/bin/env node

import { resolve } from "node:path";
import { buildWasiPackage } from "../src/release/wasi-package.mjs";

const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
for (const name of ["--bundle", "--output"]) if (!options.get(name)) throw new Error(`missing ${name}`);
const result = await buildWasiPackage({ bundleRoot: resolve(options.get("--bundle")), outputRoot: resolve(options.get("--output")) });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
