import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { access, mkdir, open, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { waitNominalSubtypeDotnetResources } from "../tests/helpers/nominal-subtype-dotnet-resources.mjs";
const [attempt, ...requested] = process.argv.slice(2); assert.match(attempt, /^r[1-9][0-9]*$/);
const all = ["ordinary/full", "ordinary/result-only", "reviewed/full", "reviewed/result-only"];
const selections = requested.length ? requested : all;
assert.equal(new Set(selections).size, selections.length); assert.ok(selections.every(item => all.includes(item)));
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 ** 2 });
const head = git(["rev-parse", "HEAD"]).trim();
assert.notEqual(head, "c7257172d9756a03513a7e666c5d65af8975c350", "Commit the harness before installed runs");
git(["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
const paths = git(["ls-files", "-z", "--", "src", "scripts", "tests", ".github/workflows/consumer-matrix.yml", "docs/type-surface.v1.json"]).split("\0").filter(Boolean).sort();
const sources = {}; for(const path of paths) sources[path] = sha256(await readFile(path));
const root = resolve(`build/vo1467-wit-installed-20261013-${attempt}`);
await assert.rejects(access(root), { code: "ENOENT" }); await mkdir(root);
const environment = { ...process.env, NO_COLOR: "1", LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
  , CC: "/usr/bin/cc", LEAN_BRIDGE_WASM_TOOLS: resolve(".toolchains/wasm-tools/bin/wasm-tools")
  , LEAN_BRIDGE_WASMTIME_C_API: resolve(".toolchains/wasmtime42")
  , LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36", LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_TEST: "1", LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_OUTPUT: root };
const records = [], args = ["--max-old-space-size=3072", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/nominal-subtype-wit-installed-tests.mjs"];
await writeFile(root + "/start.json", canonicalJson({ head, sources, selections, started: new Date().toISOString(), args }), { flag: "wx" });
for(const selection of selections) {
  const resources = await waitNominalSubtypeDotnetResources(root, { notify: console.log });
  const [route, mode] = selection.split("/");
  const log = root + `/${route}-${mode}.tap`, handle = await open(log, "wx"), started = new Date().toISOString();
  console.log(JSON.stringify({ selection, started, log, resources })); let result;
  try { result = await new Promise((done, fail) => {
    const child = spawn(process.execPath, args, { env: { ...environment, LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_ROUTES: route, LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_MODES: mode }, stdio: ["ignore", handle.fd, handle.fd] });
    child.once("error", fail); child.once("close", (code, signal) => done({ code, signal }));
  }); } finally { await handle.close(); }
  const bytes = await readFile(log), changed = [];
  for(const [path, digest] of Object.entries(sources)) if(sha256(await readFile(path)) !== digest) changed.push(path);
  records.push({ selection, started, finished: new Date().toISOString(), ...result, log, bytes: bytes.length, sha256: sha256(bytes), sourcesChecked: paths.length, changed });
  await writeFile(root + "/runs.json", canonicalJson(records));
  console.log(JSON.stringify(records.at(-1))); console.log(bytes.toString().slice(-5000));
  assert.deepEqual(changed, []); assert.equal(git(["rev-parse", "HEAD"]).trim(), head);
  if(result.code !== 0 || result.signal) { process.exitCode = 1; break; }
  const tap = bytes.toString();
  for(const [name, expected] of [["tests", 1], ["pass", 1], ["fail", 0], ["cancelled", 0], ["skipped", 0], ["todo", 0]]) {
    const matches = [...tap.matchAll(new RegExp(`^# ${name} ([0-9]+)$`, "gm"))]; assert.equal(matches.length, 1); assert.equal(Number(matches[0][1]), expected);
  }
}
