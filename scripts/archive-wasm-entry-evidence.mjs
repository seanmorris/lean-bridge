/**
 * Preserve every local reviewed Fin Wasm entry attempt, its frozen expectations and its exact producer sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertWasmEntryArchive, wasmEntryAttempts, wasmEntryDirectory, wasmEntryFrozen, wasmEntryReceipt, wasmEntrySnapshot, wasmEntrySources, writeWasmEntryArtifact } from "../tests/helpers/wasm-entry-evidence.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=") || option.startsWith("--producer=")), "Only --check, --from=<checkout holding the originals> and --producer=<7eae444 checkout> are accepted");
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const producer = resolve(options.find(option => option.startsWith("--producer="))?.slice("--producer=".length) ?? ".");
const revision = wasmEntryAttempts.at(-1).revision;
assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: producer, encoding: "utf8" }).trim(), revision, "frozen members come from the newest producer revision");
assert.equal(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: producer, encoding: "utf8" }), "");
const pending = new Map(), artifacts = [];
// Members are stored compressed when named .gz; the receipt names both the archived and the original bytes.
const add = (path, original, originalPath) => {
	assert.ok(!pending.has(path));
	const bytes = path.endsWith(".gz") ? gzipSync(original, { level: 9 }) : original;
	pending.set(path, bytes);
	artifacts.push({ path, originalPath, sha256: sha256(bytes), bytes: bytes.length, originalSha256: sha256(original), originalBytes: original.length });
};
for(const attempt of wasmEntryAttempts) for(const [name, file] of Object.entries(attempt.files))
{
	const bytes = await readFile(join(from, file.original));
	assert.deepEqual([sha256(bytes), bytes.length], [file.sha256, file.bytes], file.original);
	add(`${wasmEntryDirectory}/${attempt.id}/${name}`, bytes, file.original);
}
const generator = path => import(pathToFileURL(join(producer, path)).href);
const { expectReviewedFinWasmEntry } = await generator("tests/helpers/reviewed-fin-wasm-entry.mjs");
const { reviewedFinWasmTypeScript } = await generator("tests/helpers/reviewed-fin-wasm-typescript.mjs");
for(const name of Object.keys(wasmEntryFrozen))
{
	const [kind, file] = name.split("/");
	const text = kind === "expectations"
		? canonicalJson(await expectReviewedFinWasmEntry(file.split(/[-.]/u)[1], file.split("-")[0]))
		: reviewedFinWasmTypeScript(file.split(".")[0]);
	const bytes = Buffer.from(text);
	assert.deepEqual([sha256(bytes), bytes.length], [wasmEntryFrozen[name].sha256, wasmEntryFrozen[name].bytes], name);
	add(`${wasmEntryDirectory}/${name}`, bytes, "7eae444 generator");
}
for(const source of wasmEntrySources)
{
	const bytes = execFileSync("git", ["show", `${source.revision}:${source.path}`], { maxBuffer: 64 * 1024 * 1024 });
	assert.equal(sha256(bytes), source.sha256, source.path);
	add(wasmEntrySnapshot(source.revision, source.path), bytes, `git:${source.revision}:${source.path}`);
}
const receipt = wasmEntryReceipt(artifacts);
const { runs } = await assertWasmEntryArchive(receipt, async path => pending.get(path), { currentSources: false });
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!options.includes("--check"))
{
	for(const [path, content] of pending) await writeWasmEntryArtifact(path, content);
	await writeWasmEntryArtifact(`${wasmEntryDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${options.includes("--check") ? "Validated" : "Archived"} ${artifacts.length} files and recounted ${runs} runs for the reviewed Fin Wasm entry measurements. Receipt SHA-256 ${sha256(bytes)}\n`);
