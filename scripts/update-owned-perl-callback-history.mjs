/**
 * Regenerate staged Perl source bookkeeping without changing acceptance receipts.
 * Run from the repository root after all source edits have settled.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";

const baseline = "95978558fed7e305833175f36a93a140ff84be9e";
const helperPath = "tests/helpers/owned-perl-callback-result-history.mjs";
const historyPath = "docs/evidence/owned-perl-callback-result-source-history-20261003.json";
const previous = {
	path: "docs/evidence/owned-jvm-callback-result-source-history-20261002.json"
	, sha256: "5738bc2e884766b3bb05e52cf7ee93659a70a01ef5238898ebb796485086e211"
};
const completedPredecessor = {
	path: "docs/evidence/owned-jvm-callback-results-20261003.json"
	, sha256: "ce3855e16ac23fed6c437def1c09a9c27c7c3ac54c2d3298141bad60c78d3310"
};
const allowed = new Set([
	"config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/backends/perl/owned-borrows.mjs", "src/backends/perl/owned-values.mjs"
	, "src/backends/perl/owned-xs.mjs"
	, "tests/helpers/copied-fixture-source-history.mjs"
	, "tests/helpers/owned-jvm-callback-result-history.mjs"
	, "tests/helpers/owned-jvm-callback-result-acceptance.mjs"
	, "tests/helpers/owned-jvm-callback-result-package-evidence.mjs"
	, "tests/helpers/owned-jvm-callback-result-combined-evidence.mjs"
	, "tests/helpers/owned-perl-native.mjs"
	, "tests/owned-jvm-callback-result-history.test.mjs"
	, "tests/owned-perl-borrows.test.mjs", "tests/owned-perl-values.test.mjs"
	, "tests/owned-perl-xs.test.mjs"
]);
const added = new Set([
	historyPath, helperPath, "scripts/update-owned-perl-callback-history.mjs"
	, "docs/evidence/owned-perl-callback-results-20261003.md"
	, "src/backends/perl/owned-callback-arguments.mjs"
	, "tests/fixtures/structured-types/owned-perl-callback-results.pl"
	, ...["contract", "factory", "history", "runtime", "xs"]
		.map(name => `tests/helpers/owned-perl-callback-result-${name}-tests.mjs`)
]);
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
for(const predecessor of [previous, completedPredecessor])
{
	assert.equal(sha256(await readFile(predecessor.path)), predecessor.sha256);
	assert.equal(sha256(git(["show", `${baseline}:${predecessor.path}`])), predecessor.sha256);
}
const changes = git(["diff", "--name-status", "--no-renames", "-z", baseline]).split("\0");
assert.equal(changes.pop(), ""); assert.equal(changes.length % 2, 0);
const paths = [];
for(let index = 0; index < changes.length; index += 2)
{
	const status = changes[index], path = changes[index + 1];
	if(status === "A") assert.ok(added.has(path), `Unreviewed added source: ${path}`);
	else
	{
		assert.equal(status, "M", `Unsupported source transition: ${status} ${path}`);
		assert.ok(allowed.has(path), `Unreviewed source transition: ${path}`);
		paths.push(path);
	}
}
for(const path of git(["ls-files", "--others", "--exclude-standard"]).trim().split("\n").filter(Boolean))
	assert.ok(added.has(path) || [".toolchains", "node_modules"].includes(path), `Unreviewed untracked source: ${path}`);

const inventoryPath = "docs/type-surface.v1.json";
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
for(const evidence of inventory.evidence) for(const file of evidence.files)
	file.sha256 = sha256(await readFile(file.path));
const inventoryBytes = JSON.stringify(inventory, null, 2) + "\n";
const inventoryPrior = git(["show", `${baseline}:${inventoryPath}`]);
if(inventoryBytes !== inventoryPrior && !paths.includes(inventoryPath)) paths.push(inventoryPath);

const updates = [];
for(const path of paths.sort())
{
	const current = path === inventoryPath ? inventoryBytes : await readFile(path, "utf8");
	const prior = path === inventoryPath ? inventoryPrior : git(["show", `${baseline}:${path}`]);
	assert.notEqual(current, prior, path);
	let start = 0;
	while(start < current.length && start < prior.length && current[start] === prior[start]) start++;
	let currentEnd = current.length, priorEnd = prior.length;
	while(currentEnd > start && priorEnd > start && current[currentEnd - 1] === prior[priorEnd - 1])
	{
		currentEnd--; priorEnd--;
	}
	updates.push({
		path
		, currentSha256: sha256(current)
		, previousSha256: sha256(prior)
		, strategy: "spans"
		, edits: [{ start, current: current.slice(start, currentEnd), previous: prior.slice(start, priorEnd) }]
	});
}
const bytes = JSON.stringify({ baselineRevision: baseline
	, completedPredecessor
	, kind: "owned-perl-callback-result-source-history"
	, previous
	, schemaVersion: 1
	, updates }, null, 2) + "\n";
const source = await readFile(helperPath, "utf8");
const pattern = /export const ownedPerlCallbackHistorySha256 = "(?:PENDING|[a-f0-9]{64})";/gu;
assert.equal([...source.matchAll(pattern)].length, 1);
await writeFile(inventoryPath, inventoryBytes);
await writeFile(historyPath, bytes);
await writeFile(helperPath, source.replace(pattern, `export const ownedPerlCallbackHistorySha256 = "${sha256(bytes)}";`));
process.stdout.write(`Updated ${updates.length} staged Perl source transitions; JVM acceptance and predecessor receipts unchanged.\n`);
