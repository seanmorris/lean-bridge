/**
 * Preserve the original JVM pending-exit investigation, without promoting installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";

const root = "docs/evidence/jvm-pending-exit-20261011";
const runtime = "build/vo1454-jvm-wait-runtime-r1";
const summary = JSON.parse(await readFile(join(runtime, "summary.json")));
assert.equal(summary.results.length, 2);
assert.deepEqual(summary.results.map(run => [run.mode, run.status, run.checks]), [
	["production", 0, "passed"], ["reaped-without-gdb-status", 72, "passed"]
]);
const originals = [
	["hosted-failure.log", "build/vo1220-jvm-114537520888.log"]
	, ["runner.mjs.txt", "build/check-vo1454-jvm-wait-runtime.mjs"]
	, ["kernel-controls.tap", "build/vo1454-jvm-wait-unit-r3.tap"]
	, ...["start.json", "summary.json"
		, ...[0, 1].flatMap(index =>
			["json", "py", "record", "armed.json", "result.json", "stderr", "stdout"].map(extension => `run-${index}.${extension}`))]
		.map(path => [`runtime/${path}`, join(runtime, path)])
	, ...["fin-container-edge-jvm-wait.mjs"
		, "fin-container-edge-jvm-wait-tests.mjs"
		, "fin-container-edge-jvm-gdb.mjs"
		, "fin-container-edge-jvm-exit.mjs", "fin-container-edge-report-hosts.mjs"]
		.map(path => [`sources/${path}`, `tests/helpers/${path}`])
];
const files = [];
await mkdir(root);
const save = async (path, bytes, original) => {
	const destination = join(root, path);
	await mkdir(join(destination, ".."), { recursive: true });
	await writeFile(destination, bytes, { flag: "wx" });
	files.push({ path, bytes: bytes.length, sha256: sha256(bytes), ...original ? { original } : {} });
};
for(const [path, original] of originals) await save(path, await readFile(original), original);
const config = JSON.parse(await readFile(join(runtime, "run-0.json")));
const listings = {};
for(const [name, digest] of Object.entries(summary.libraries))
{
	const path = join(config.root, name);
	assert.equal(sha256(await readFile(path)), digest);
	const symbols = execFileSync("/usr/bin/nm", ["-D", "--defined-only", path], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	// Keep every definition of the eight measured symbols, not unrelated runtime symbols.
	listings[name] = symbols.split("\n").filter(line => config.identity.columns.includes(line.trim().split(/\s+/u).at(-1))).join("\n") + "\n";
}
await save("runtime/listings.json", Buffer.from(JSON.stringify(listings, null, 2) + "\n"));
files.sort((a, b) => a.path.localeCompare(b.path));
const index = Buffer.from(JSON.stringify({ schemaVersion: 1
	, scope: "Observed JVM exit and genuine kernel-child controls. The hosted race is not locally reproduced; no new installed support is claimed."
	, files }, null, 2) + "\n");
await writeFile(join(root, "index.json"), index, { flag: "wx" });
process.stdout.write(JSON.stringify({ root, files: files.length, indexSha256: sha256(index) }) + "\n");
