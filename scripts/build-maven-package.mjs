#!/usr/bin/env node
/**
 * Builds the Maven package workflow.
 *
 * @file
 */

import { buildMavenPackage } from "../src/release/maven-package.mjs";
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
if(!options.get("--bundle") || !options.get("--output")) throw new Error("usage: build-maven-package --bundle DIR --output DIR");
process.stdout.write(`${JSON.stringify(await buildMavenPackage({ bundleRoot: options.get("--bundle"), outputRoot: options.get("--output") }), null, 2)}\n`);
