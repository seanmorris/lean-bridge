/**
 * Refresh audited source identities for the native-PHP acceptance wrapper.
 * This updater does not add observations or change support states.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";

const baseline = "53e3f8ef1d4ff4873c41aab4f7cf9f0302c5d42f";
const inventoryPath = "docs/type-surface.v1.json";
const refreshPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/php.md", "package.json", "src/adoption/test-profiles.mjs"
	, "tests/copied-fixture-source-history.test.mjs"
	, "tests/helpers/owned-php-callback-result-package-evidence.mjs"
].sort();
const git = arguments_ => execFileSync("git", arguments_, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), baseline,
	"Acceptance refresh is pinned to the authenticated PHP staging backup.");
const originalBytes = git(["show", `${baseline}:${inventoryPath}`]);
assert.equal(await readFile(inventoryPath, "utf8"), originalBytes,
	"Inventory already contains changes outside this exact refresh.");
const inventory = JSON.parse(originalBytes), identities = new Map();
for(const path of refreshPaths) identities.set(path, {
	previous: sha256(git(["show", `${baseline}:${path}`]))
	, current: sha256(await readFile(path))
});
let replacements = 0;
for(const evidence of inventory.evidence) for(const file of evidence.files)
{
	const identity = identities.get(file.path);
	if(!identity) continue;
	assert.equal(file.sha256, identity.previous, file.path);
	file.sha256 = identity.current; replacements++;
}
assert.ok(replacements > 0);
assert.ok(inventory.evidence.every(evidence => evidence.files.every(file =>
	!identities.has(file.path) || file.sha256 === identities.get(file.path).current)));
await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write(`Refreshed ${replacements} audited PHP acceptance source identities without changing support states.\n`);
