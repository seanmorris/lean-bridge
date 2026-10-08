/**
 * Record exact PHP-Wasm promotion transitions without changing older evidence claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { phpWasmFinPromotionChangedPaths, phpWasmFinPromotionHistoryPath, reversePhpWasmFinPromotionUpdate } from "../tests/helpers/php-wasm-fin-promotion-source-history.mjs";

const predecessorCommit = "c764790da547a5622fb120bb7f5564eed073b490";
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessorCommit, "PHP-Wasm promotion history is draft-only at its exact predecessor; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", phpWasmFinPromotionHistoryPath]).trim(), "Never rewrite a committed PHP-Wasm promotion ledger");
const path = "docs/type-surface.v1.json", inventory = JSON.parse(await readFile(path, "utf8"));
const baseline = JSON.parse(git(["show", `${predecessorCommit}:${path}`]));
const draft = await readFile(phpWasmFinPromotionHistoryPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft) assert.equal(draft.predecessorCommit, predecessorCommit);
const sources = new Map();
for(const path of phpWasmFinPromotionChangedPaths.filter(path => path !== "docs/type-surface.v1.json"))
	sources.set(path, { previous: sha256(git(["show", `${predecessorCommit}:${path}`]))
		, current: sha256(await readFile(path)) });
let pins = 0;
for(const [index, entry] of baseline.evidence.entries())
{
	assert.equal(inventory.evidence[index].id, entry.id);
	for(const [position, file] of entry.files.entries())
	{
		const update = sources.get(file.path);
		if(!update || update.previous === update.current || file.sha256 !== update.previous) continue;
		const current = inventory.evidence[index].files[position];
		assert.equal(current.path, file.path);
		const earlier = draft?.updates.find(item => item.path === file.path && item.previousSha256 === update.previous);
		assert.ok([update.previous, update.current, earlier?.currentSha256].includes(current.sha256));
		current.sha256 = update.current; pins++;
	}
}
const added = inventory.evidence.slice(baseline.evidence.length);
assert.ok(added.length === 0 || added.length === 4);
if(added.length) assert.deepEqual(added.map(item => item.id), ["ordinary", "reviewed"].flatMap(route =>
	["products", "records"].map(fixture => `php-wasm-fin-${fixture}-${route}-installed`)));
for(const entry of added) for(const file of entry.files) file.sha256 = sha256(await readFile(file.path));
await writeFile(path, JSON.stringify(inventory, null, 2) + "\n");
const updates = [];
for(const path of phpWasmFinPromotionChangedPaths)
{
	const source = await readFile(path, "utf8"), previous = git(["show", `${predecessorCommit}:${path}`]);
	// Bootstrap before the new claims and generated tables exist; final tests require all paths.
	if(source === previous) continue;
	const currentLines = source.split(/(?<=\n)/u), previousLines = previous.split(/(?<=\n)/u);
	const diff = git(["diff", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", predecessorCommit, "--", path]);
	const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
		const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0), currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
	});
	const update = { path, currentSha256: sha256(source), previousSha256: sha256(previous), edits };
	assert.equal(reversePhpWasmFinPromotionUpdate(source, update), previous); updates.push(update);
}
await writeFile(phpWasmFinPromotionHistoryPath, JSON.stringify({ schemaVersion: 1
	, milestone: "php-wasm-fin-promotion-v1"
	, predecessorCommit, updates }, null, 2) + "\n");
process.stdout.write(`Recorded ${updates.length} exact transitions and ${pins} source-pin-only updates.\n`);
