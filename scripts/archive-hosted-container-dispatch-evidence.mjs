/**
 * Preserve original hosted Python/Rust container observations and exact producer source snapshots.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { assertHostedContainerArchive, hostedContainerDirectory, hostedContainerOriginals, hostedContainerReceipt, hostedContainerRevision, hostedContainerSnapshot, hostedContainerSources, writeHostedContainerArtifact } from "../tests/helpers/hosted-container-dispatch-evidence.mjs";
import { hostedContainerMembership, hostedContainerMembershipPath } from "../tests/helpers/hosted-container-artifact-membership.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<checkout holding the originals> are accepted");
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const pending = new Map(), artifacts = [];
const add = (path, bytes, originalPath) => {
	assert.ok(!pending.has(path)); pending.set(path, bytes);
	artifacts.push({ path, originalPath, sha256: sha256(bytes), bytes: bytes.length });
};
for(const [name, file] of Object.entries(hostedContainerOriginals))
{
	const bytes = await readFile(join(from, file.original));
	assert.equal(sha256(bytes), file.sha256, file.original); assert.equal(bytes.length, file.bytes);
	add(`${hostedContainerDirectory}/${name}`, bytes, file.original);
}
for(const [path, digest] of Object.entries(hostedContainerSources))
{
	const bytes = execFileSync("git", ["show", `${hostedContainerRevision}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
	assert.equal(sha256(bytes), digest, path);
	add(hostedContainerSnapshot(path), bytes, `git:${hostedContainerRevision}:${path}`);
}
const receipt = hostedContainerReceipt(artifacts);
pending.set(`${hostedContainerDirectory}/receipt.json`, Buffer.from(JSON.stringify(receipt, null, 2) + "\n"));
for(const file of hostedContainerMembership.artifacts)
{
	const bytes = await readFile(join(from, file.originalPath));
	assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256);
	pending.set(file.path, bytes);
}
pending.set(hostedContainerMembershipPath, Buffer.from(JSON.stringify(hostedContainerMembership, null, 2) + "\n"));
await assertHostedContainerArchive(receipt, path => Promise.resolve(pending.get(path)), { currentSources: false });
if(!options.includes("--check"))
{
	for(const [path, bytes] of pending) await writeHostedContainerArtifact(path, bytes);
}
console.log(`Authenticated ${artifacts.length} original reports, metadata, logs and source snapshots, plus both original ZIPs and four exact member bindings.`);
