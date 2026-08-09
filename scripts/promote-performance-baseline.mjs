#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cp, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const options = { source: null, destination: null };
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === "--source") options.source = resolve(process.argv[++index]);
  else if (argument === "--destination") options.destination = resolve(process.argv[++index]);
  else throw new Error(`unknown baseline promotion option ${argument}`);
}
if (!options.source || !options.destination) throw new Error("--source and --destination are required");
try {
  await stat(options.destination);
  throw new Error(`refusing to overwrite retained baseline ${options.destination}`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const baseline = JSON.parse(await readFile(resolve(options.source, "baseline.json"), "utf8"));
for (const record of baseline.collection.rawForkFiles) {
  if (record.path.startsWith("/") || record.path.includes("..")) {
    throw new Error(`unsafe raw fork path ${record.path}`);
  }
  const bytes = await readFile(resolve(options.source, record.path));
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== record.sha256 || bytes.byteLength !== record.bytes) {
    throw new Error(`raw fork identity mismatch for ${record.path}`);
  }
}
await mkdir(dirname(options.destination), { recursive: true });
await cp(options.source, options.destination, { recursive: true, errorOnExist: true, force: false });
process.stdout.write(`${JSON.stringify({
  accepted: true,
  baselineId: baseline.id,
  destination: options.destination,
  rawForks: baseline.collection.rawForkFiles.length,
}, null, 2)}\n`);
