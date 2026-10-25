/**
 * Replay one real retained matrix and reject independently mutated copies.
 * Run from the repository root with Node 22. No original file is modified.
 * Output is written to a fresh directory; failure never writes acceptance.json.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, statfs, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeArtifactPaths } from "../../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../../src/capsule/node.mjs";
import { checkedRecordValueIndexHostedDigest } from "../../../tests/helpers/checked-record-value-index-hosted-archive.mjs";
import { checkPhpWasmEntryHostedArchive } from "../../../tests/helpers/php-wasm-refinement-entry-hosted-archive.mjs";

const repository = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
assert.equal(process.cwd(), repository);
const args = process.argv.slice(2), options = {};
assert.equal(args.length, 6, "--archive <absolute> --producer-checkout <absolute> --output <fresh-absolute-directory>");
for(let position = 0; position < args.length; position += 2) {
  const flag = args[position], value = args[position + 1];
  assert.ok(["--archive", "--producer-checkout", "--output"].includes(flag) && !Object.hasOwn(options, flag));
  assert.ok(isAbsolute(value) && resolve(value) === value);
  options[flag] = value;
}
const archive = options["--archive"], producer = options["--producer-checkout"], output = options["--output"];
assert.equal(await realpath(archive), archive);
assert.equal(await realpath(producer), producer);
assert.equal(await realpath(dirname(output)), dirname(output));
assert.ok(!output.startsWith(archive + "/") && output !== archive);
assert.ok(!output.startsWith(producer + "/") && output !== producer);
const checkerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.match(checkerCommit, /^[a-f0-9]{40}$/u);
const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const fileIdentity = async path => {
  assert.equal(await realpath(path), path);
  const info = await lstat(path); assert.ok(info.isFile(), path);
  return { bytes: info.size, sha256: await checkedRecordValueIndexHostedDigest(path) };
};
const manifest = async root => {
  const files = [];
  for(const path of await nativeArtifactPaths(root)) files.push({ path, ...await fileIdentity(join(root, path)) });
  return files;
};
const originals = await manifest(archive), index = await readJson(join(archive, "index.json"));
const totalBytes = originals.reduce((sum, row) => sum + row.bytes, 0);
const space = await statfs(tmpdir());
assert.ok(space.bavail * space.bsize >= totalBytes * 2 + 512 * 1024 ** 2, "acceptance disk reserve");
await mkdir(output);
const save = async (name, value) => {
  const bytes = Buffer.from(canonicalJson(value));
  await writeFile(join(output, name), bytes, { flag: "wx" });
  return { path: name, ...identity(bytes) };
};
const source = { path: "docs/evidence/php-wasm-entry-hosted-acceptance-20261025/acceptance-runner.mjs"
  , ...await fileIdentity(fileURLToPath(import.meta.url)) };
await copyFile(fileURLToPath(import.meta.url), join(output, "runner.mjs"), constants.COPYFILE_EXCL);
const originalManifest = await save("original-files.json", originals);
console.log(JSON.stringify({ phase: "positive-original", files: originals.length, bytes: totalBytes }));
const positive = await checkPhpWasmEntryHostedArchive(archive, producer);
assert.equal(positive.replayedRoutes, 30);
const positiveReceipt = await save("positive.json", positive);
const temporary = await mkdtemp(join(tmpdir(), "lean-php-entry-real-controls-"));
const clone = join(temporary, "archive"), controls = [];
const originalByPath = new Map(originals.map(file => [file.path, file]));
const changed = new Set();
const change = async (path, bytes) => {
  assert.ok(originalByPath.has(path), path); changed.add(path);
  await writeFile(join(clone, path), bytes);
};
const jsonChange = async (path, mutation) => {
  const value = await readJson(join(clone, path)); mutation(value);
  const bytes = Buffer.from(canonicalJson(value)); await change(path, bytes); return identity(bytes);
};
const indexChange = mutation => jsonChange("index.json", mutation);
const apiChange = async (path, mutation, binding) => {
  const receipt = await jsonChange(path, mutation);
  await indexChange(value => binding(value, receipt));
};
const flip = async path => {
  const bytes = await readFile(join(clone, path)); assert.ok(bytes.length);
  bytes[Math.floor(bytes.length / 2)] ^= 1; await change(path, bytes);
};
const expectedAssertion = (error, actual, expected) => error?.code === "ERR_ASSERTION"
  && error.actual === actual && error.expected === expected;
const rejection = async (name, mutation, matches, selectedProducer = producer) => {
  assert.equal(changed.size, 0);
  await mutation();
  const changes = [];
  for(const path of [...changed].sort()) {
    const target = join(clone, path), info = await lstat(target);
    changes.push({ path, before: originalByPath.get(path) ?? null
      , after: info.isSymbolicLink() ? { kind: "symlink" } : await fileIdentity(target) });
  }
  console.log(JSON.stringify({ phase: "negative", name }));
  let observed;
  try { await checkPhpWasmEntryHostedArchive(clone, selectedProducer); }
  catch(error) { observed = error; }
  assert.ok(observed, "mutation unexpectedly accepted: " + name);
  assert.ok(matches(observed), "wrong refusal for " + name + ": " + observed?.message);
  controls.push({ name, rejected: true, changes, refusal: {
    name: observed.name, code: observed.code, message: observed.message.slice(0, 4096)
  } });
  await save(String(controls.length).padStart(2, "0") + "-" + name + ".json", controls.at(-1));
  for(const path of changed) {
    const target = join(clone, path); await rm(target);
    if(originalByPath.has(path)) {
      await copyFile(join(archive, path), target, constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE);
      const { path: ignored, ...expected } = originalByPath.get(path);
      assert.deepEqual(await fileIdentity(target), expected);
    }
  }
  changed.clear();
  assert.deepEqual(await nativeArtifactPaths(clone), originals.map(file => file.path));
};
try {
  await mkdir(clone);
  for(const file of originals) {
    const target = join(clone, file.path); await mkdir(dirname(target), { recursive: true });
    await copyFile(join(archive, file.path), target, constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE);
  }
  assert.deepEqual(await manifest(clone), originals);
  await rejection("malformed-index", () => indexChange(value => { value.unknown = true; })
    , error => error.code === "ERR_ASSERTION" && /complete archive fields/u.test(error.message));
  await rejection("missing-artifact", () => indexChange(value => { value.artifacts.pop(); })
    , error => expectedAssertion(error, 27, 28));
  await rejection("reordered-artifacts", () => indexChange(value => { value.artifacts.reverse(); })
    , error => expectedAssertion(error, index.artifacts.at(-1).name, index.artifacts[0].name));
  await rejection("duplicate-artifact", () => indexChange(value => { value.artifacts[1] = value.artifacts[0]; })
    , error => expectedAssertion(error, index.artifacts[0].name, index.artifacts[1].name));
  const wrongSha = "0".repeat(40);
  await rejection("wrong-producer", () => apiChange("api/run.json", value => { value.head_sha = wrongSha; }
    , (value, receipt) => { value.run = receipt; })
    , error => expectedAssertion(error, "ci/php-wasm-refinement-entry/" + index.producerCommit
      , "ci/php-wasm-refinement-entry/" + wrongSha));
  const firstJob = await readJson(join(archive, "api/jobs/0000.json"));
  await rejection("stale-attempt", () => apiChange("api/jobs/0000.json", value => { value.run_attempt++; }
    , (value, receipt) => { value.artifacts[0].job = receipt; })
    , error => expectedAssertion(error, firstJob.run_attempt + 1, firstJob.run_attempt));
  await rejection("wrong-job", () => apiChange("api/jobs/0000.json", value => { value.name = "foreign job"; }
    , (value, receipt) => { value.artifacts[0].job = receipt; })
    , error => expectedAssertion(error, "foreign job", firstJob.name));
  await rejection("expired-artifact", () => apiChange("api/artifacts/0000.json", value => { value.expired = true; }
    , (value, receipt) => { value.artifacts[0].artifact = receipt; })
    , error => expectedAssertion(error, true, false));
  await rejection("failed-upload", () => apiChange("api/jobs/0000.json", value => {
    value.steps.find(step => step.name === "Preserve original and partial compiler-input records").conclusion = "failure";
  }, (value, receipt) => { value.artifacts[0].job = receipt; })
    , error => error.code === "ERR_ASSERTION" && /Preserve original and partial compiler-input records/u.test(error.message));
  const stored = await readJson(join(archive, "artifacts/0000/index.json"));
  const zipPart = "artifacts/0000/" + stored.zip.parts[0].path;
  await rejection("zip-tamper", () => flip(zipPart)
    , error => error.code === "ERR_ASSERTION" && error.message.startsWith(stored.zip.parts[0].path));
  const member = stored.output.find(file => file.bytes > 0);
  await rejection("output-tamper", () => flip("artifacts/0000/" + member.path)
    , error => error.code === "ERR_ASSERTION" && error.message.startsWith(member.path));
  const sourcePart = index.sources[0].parts[0].path;
  await rejection("source-zip-tamper", () => flip(sourcePart)
    , error => error.code === "ERR_ASSERTION" && error.expected === index.sources[0].parts[0].sha256
      && typeof error.actual === "string" && /^[a-f0-9]{64}$/u.test(error.actual)
      && error.actual !== error.expected);
  await rejection("source-manifest-tamper", () => indexChange(value => { value.sources[0].snapshot.files[0].sha256 = "0".repeat(64); })
    , error => error.code === "ERR_ASSERTION" && /source closure must equal original Git bytes/u.test(error.message));
  await rejection("source-symlink", async () => {
    changed.add(sourcePart); await rm(join(clone, sourcePart));
    await symlink(join(archive, sourcePart), join(clone, sourcePart));
  }, error => error.code === "ERR_ASSERTION" && /canonical archive path/u.test(error.message));
  await rejection("extra-member", async () => {
    const path = "unrecorded-file.txt"; changed.add(path);
    await writeFile(join(clone, path), "unexpected member\n", { flag: "wx" });
  }, error => error.code === "ERR_ASSERTION" && /complete archive file closure/u.test(error.message));
  await rejection("forged-replay-summary", async () => {
    const receipt = await jsonChange("replay.json", value => { value.matrix.calls++; });
    await indexChange(value => { value.replay = receipt; });
  }, error => error.code === "ERR_ASSERTION" && /all hosted summary semantics must match actual original-source replay/u.test(error.message));
  await rejection("wrong-source-checkout", async () => {}
    , error => expectedAssertion(error, checkerCommit, index.producerCommit), repository);
  assert.equal(controls.length, 17);
  assert.deepEqual(await manifest(clone), originals);
  console.log(JSON.stringify({ phase: "positive-restored-clone", controls: controls.length }));
  const restored = await checkPhpWasmEntryHostedArchive(clone, producer);
  assert.deepEqual(restored, positive);
  const restoredReceipt = await save("positive-restored.json", restored);
  assert.deepEqual(await manifest(archive), originals, "original archive remains byte-for-byte unchanged");
  const report = { schemaVersion: 1, kind: "php-wasm-entry-real-archive-controls-v1"
    , scope: "separate-instrumented-probe", producerCommit: index.producerCommit, checkerCommit
    , nodeVersion: process.versions.node, runId: positive.runId, runAttempt: positive.runAttempt
    , source, originalManifest, archiveIndex: await fileIdentity(join(archive, "index.json"))
    , positive: positiveReceipt, restored: restoredReceipt, negativeControls: controls.length
    , controls: controls.map(control => control.name), originalBytesUnchanged: true };
  const result = await save("acceptance.json", report);
  console.log(JSON.stringify({ phase: "complete", ...result, negativeControls: controls.length }));
} finally {
  assert.ok(temporary.startsWith(join(tmpdir(), "lean-php-entry-real-controls-")));
  await rm(temporary, { recursive: true, force: true });
}
