/**
 * Preserve exact successful, failed and unlaunched native Array evidence without overwriting originals.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { arrayHostAttempts, arrayHostDirectory, collectArrayHostEvidence } from "../tests/helpers/generic-record-array-host-evidence.mjs";
import { writeArrayEvidenceArtifact } from "../tests/helpers/generic-record-array-evidence.mjs";

const args = process.argv.slice(2);
assert.ok(args.every(arg => arg === "--check" || arg.startsWith("--from=")));
assert.equal(new Set(args.map(arg => arg.split("=")[0])).size, args.length);
const from = args.find(arg => arg.startsWith("--from="))?.slice(7) ?? ".";
const pending = new Map();
const add = async (path, original) => { assert.ok(!pending.has(path)); pending.set(path, await readFile(join(from, original))); };
for(const attempt of arrayHostAttempts)
{
	const root = `${arrayHostDirectory}/${attempt.id}`, original = `build/vo1439-generic-record-arrays-${attempt.id}`;
	await add(`${root}/queue.json`, `${original}/queue.json`);
	const queueBytes = pending.get(`${root}/queue.json`); assert.equal(sha256(queueBytes), attempt.queueSha256);
	const queue = JSON.parse(queueBytes);
	assert.equal(execFileSync("git", ["rev-parse", `${attempt.revision}^{tree}`], { encoding: "utf8" }).trim(), queue.tree);
	await add(`${root}/runner.mjs.txt`, `build/run-vo1439-generic-record-arrays-${attempt.id}.mjs`);
	await add(`${root}/runner-output.txt`, `${original}.runner.log`);
	const actualMembers = ["queue.json"];
	for(const selection of queue.selections)
	{
		if(attempt.notRun.includes(selection.name)) continue;
		actualMembers.push(selection.name);
		assert.deepEqual((await readdir(join(from, original, selection.name))).sort(), ["end.json", "run.tap", "start.json"]);
		for(const name of ["start.json", "end.json", "run.tap"]) await add(`${root}/${selection.name}/${name}`, `${original}/${selection.name}/${name}`);
		if(attempt.passed.includes(selection.name))
		{
			actualMembers.push(selection.report); await add(`${root}/${selection.report}`, `${original}/${selection.report}`);
		}
	}
	assert.deepEqual((await readdir(join(from, original))).sort(), actualMembers.sort(), "original directory must not contain invented or unaccounted attempts");
	for(const [path, hash] of Object.entries(queue.sources))
	{
		const bytes = execFileSync("git", ["show", `${attempt.revision}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
		assert.equal(sha256(bytes), hash, path); pending.set(`${root}/sources/${path}.txt`, bytes);
	}
	for(const item of queue.supersedes?.unlaunchedRunners ?? [])
		await add(`${root}/unlaunched/${basename(item.path)}.txt`, item.path.replace(/^\/app\//u, ""));
}
const receipt = await collectArrayHostEvidence(async path => pending.get(path));
assert.equal(receipt.artifacts.length, pending.size);
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!args.includes("--check"))
{
	for(const [path, content] of pending) await writeArrayEvidenceArtifact(path, content);
	await writeArrayEvidenceArtifact(`${arrayHostDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${args.includes("--check") ? "Validated" : "Archived"} ${pending.size} original artifacts; receipt SHA-256 ${sha256(bytes)}\n`);
