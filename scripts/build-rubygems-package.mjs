#!/usr/bin/env node
import { buildRubyGemsPackage } from "../src/release/rubygems-package.mjs";
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
if (!options.get("--bundle") || !options.get("--output")) throw new Error("usage: build-rubygems-package --bundle DIR --output DIR [--gem COMMAND]");
process.stdout.write(`${JSON.stringify(await buildRubyGemsPackage({ bundleRoot: options.get("--bundle"), outputRoot: options.get("--output"), gemCommand: options.get("--gem") }), null, 2)}\n`);
