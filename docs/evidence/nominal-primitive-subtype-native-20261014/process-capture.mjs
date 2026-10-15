import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { open, readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";

const [kind, route, mode, third, fourth] = process.argv.slice(2);
assert.ok(["producer", "controls"].includes(kind));
assert.ok(["ordinary", "reviewed"].includes(route));
assert.ok(["full", "result-only"].includes(mode));
for (const value of [third, fourth]) assert.match(value ?? "", /^r[1-9][0-9]*$/);
const runner = kind === "producer" ? "build/vo1469-native-produce.mjs" : "build/vo1469-native-installed-controls.mjs";
const attempt = kind === "producer" ? third : fourth;
const prefix = `build/vo1469-native-${kind}-process-${route}-${mode}-${attempt}`;
const args = ["--max-old-space-size=3072", runner, route, mode, third, fourth];
const runnerSha256 = sha256(await readFile(runner)), wrapperSha256 = sha256(await readFile(import.meta.filename));
const log = prefix + ".log", handle = await open(log, "wx"), started = new Date().toISOString();
let result;
try {
  result = await new Promise((done, fail) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", handle.fd, handle.fd] });
    child.once("error", fail); child.once("close", (code, signal) => done({ code, signal }));
  });
} catch (error) {
  result = { code: null, signal: null, spawnError: { name: error.name, message: error.message, code: error.code } };
} finally { await handle.close(); }
const bytes = await readFile(log);
const report = { kind, route, mode, third, fourth, args, runnerSha256, wrapperSha256, started,
  ...result, log, bytes: bytes.length, sha256: sha256(bytes), finished: new Date().toISOString() };
await writeFile(prefix + ".json", canonicalJson(report), { flag: "wx" });
console.log(JSON.stringify(report)); console.log(bytes.toString());
assert.equal(sha256(await readFile(runner)), runnerSha256);
assert.equal(sha256(await readFile(import.meta.filename)), wrapperSha256);
assert.equal(result.code, 0); assert.equal(result.signal, null);
