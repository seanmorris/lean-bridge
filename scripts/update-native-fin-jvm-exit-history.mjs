/**
 * Record the scalar JVM exit-observer repair once at its exact predecessor.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { nativeFinJvmExitChangedPaths, nativeFinJvmExitHistoryPath, nativeFinJvmExitPredecessor, reverseNativeFinJvmExitUpdate } from "../tests/helpers/native-fin-jvm-exit-history.mjs";

const predecessorCommit = nativeFinJvmExitPredecessor;
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessorCommit, "Scalar JVM exit history is draft-only at its exact predecessor; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", nativeFinJvmExitHistoryPath]).trim(), "Never rewrite a committed scalar JVM exit ledger");
const inventoryPath = "docs/type-surface.v1.json";
const previousInventory = git(["show", `${predecessorCommit}:${inventoryPath}`]);
const draft = await readFile(nativeFinJvmExitHistoryPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft) assert.equal(draft.predecessorCommit, predecessorCommit);
const inventoryBefore = await readFile(inventoryPath, "utf8");
const prior = draft?.updates.find(update => update.path === inventoryPath);
const restored = prior?.currentSha256 === sha256(inventoryBefore)
	? reverseNativeFinJvmExitUpdate(inventoryBefore, prior) : inventoryBefore;
assert.equal(restored, previousInventory, "Never overwrite unrecorded support inventory changes");
const producerPath = "tests/jvm-fin.test.mjs";
const previousPin = sha256(git(["show", `${predecessorCommit}:${producerPath}`]));
const currentPin = sha256(await readFile(producerPath));
const pinLine = `"path": "${producerPath}",\n          "sha256": "${previousPin}"`;
assert.equal(previousInventory.split(pinLine).length, 2, "One exact JVM source pin");
const pinStart = previousInventory.indexOf(pinLine) + pinLine.indexOf(previousPin);
const inventoryText = previousInventory.slice(0, pinStart) + currentPin + previousInventory.slice(pinStart + previousPin.length);
const parsed = JSON.parse(inventoryText), original = JSON.parse(previousInventory);
const affected = parsed.evidence.flatMap(entry => entry.files
	.filter(file => file.path === producerPath).map(file => ({ entry, file })));
assert.equal(affected.length, 1); assert.equal(affected[0].entry.id, "jvm-fin-installed");
assert.equal(affected[0].file.sha256, currentPin);
affected[0].file.sha256 = previousPin;
assert.deepEqual(parsed, original, "Only the installed scalar JVM source pin may change");
const updates = [];
for(const path of nativeFinJvmExitChangedPaths)
{
	const source = path === inventoryPath ? inventoryText : await readFile(path, "utf8");
	const previous = git(["show", `${predecessorCommit}:${path}`]);
	assert.notEqual(source, previous, path);
	if(path === inventoryPath)
	{
		const update = {
			path, currentSha256: sha256(source)
			, previousSha256: sha256(previous)
			, edits: [{ start: pinStart, previous: previousPin, current: currentPin }]
		};
		assert.equal(reverseNativeFinJvmExitUpdate(source, update), previous); updates.push(update);
		continue;
	}
	const diff = git(["diff", "--histogram", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", predecessorCommit, "--", path]);
	const currentLines = source.split(/(?<=\n)/u), previousLines = previous.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
		const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0), currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
	});
	const update = { path, currentSha256: sha256(source), previousSha256: sha256(previous), edits };
	assert.equal(reverseNativeFinJvmExitUpdate(source, update), previous); updates.push(update);
}
await writeFile(inventoryPath, inventoryText);
await writeFile(nativeFinJvmExitHistoryPath, JSON.stringify({
	schemaVersion: 1, milestone: "native-fin-jvm-exit-source-v1"
	, predecessorCommit, updates
}, null, 2) + "\n");
process.stdout.write(`Recorded ${updates.length} exact scalar JVM exit transitions and one source pin; support claims are unchanged.\n`);
