/**
 * Reconcile two ordinary C/C++ callback observations without adding overlapping or inferred cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { nativeFinReplyPromotionId, nativeFinReplyPromotionObservation, nativeFinReplyPromotionObservationIds, nativeFinReplyPromotionReference, nativeFinReplyPromotionValidators } from "../tests/helpers/native-fin-reply-promotion-references.mjs";

const predecessor = "ffb7a4478f00a72983d2e8863e73bb0d01e94d9f";
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessor, "Native Fin reply promotion is draft-only at its exact predecessor");
assert.ok(process.argv.slice(2).every(argument => argument === "--refresh"), "Only --refresh is accepted");
const path = "docs/type-surface.v1.json", previous = JSON.parse(git(["show", `${predecessor}:${path}`]));
const inventory = JSON.parse(await readFile(path)), refresh = process.argv.includes("--refresh");
const reference = await nativeFinReplyPromotionReference();
assert.equal(inventory.observations.length, previous.observations.length);
assert.equal(inventory.evidence.length, previous.evidence.length + Number(refresh));
if(refresh) assert.equal(inventory.evidence.at(-1).id, nativeFinReplyPromotionId);
else assert.ok(!inventory.evidence.some(entry => entry.id === nativeFinReplyPromotionId));
for(const [index, observation] of previous.observations.entries())
{
	if(nativeFinReplyPromotionObservationIds.includes(observation.id))
	{
		assert.equal(inventory.observations[index].id, observation.id);
		if(!refresh) assert.deepEqual(inventory.observations[index], observation);
		inventory.observations[index] = nativeFinReplyPromotionObservation(observation);
	}
	else assert.deepEqual(inventory.observations[index], observation);
}
const entry = { id: reference.id, kind: "installed"
	, revision: reference.revision, command: reference.command
	, scope: reference.scope
	, files: await Promise.all([...nativeFinReplyPromotionValidators, ...reference.files.map(file => file.path)].map(async path => ({ path, sha256: sha256(await readFile(path)) })))
	, artifacts: reference.artifacts };
if(refresh) inventory.evidence[inventory.evidence.length - 1] = entry;
else inventory.evidence.push(entry);
await writeFile(path, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write("Reconciled two ordinary C/C++ callback observations with contained host replies; no new cells.\n");
