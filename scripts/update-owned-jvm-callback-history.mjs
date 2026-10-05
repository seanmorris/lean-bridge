/**
 * Regenerate staged JVM source bookkeeping without changing acceptance receipts.
 * Run from the repository root after all source edits have settled.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";

const baseline = "72d123d69917f1145ec03d8624b6a08c3b2be6bc";
const helperPath = "tests/helpers/owned-jvm-callback-result-history.mjs";
const historyPath = "docs/evidence/owned-jvm-callback-result-source-history-20261002.json";
const previous = {
	path: "docs/evidence/owned-dotnet-callback-result-source-history-20261002.json"
	, sha256: "dc4b95aa55a74b04b86e55e47289f5c45ca39d42a97247f3e9e62074496f2a59"
};
const allowed = new Set([
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/java.md", "docs/consume/kotlin.md"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "package.json", "src/adoption/test-profiles.mjs"
	, ...["owned-callables", "owned-calls", "owned-conversions", "owned-kotlin"
		, "owned-layout", "owned-package", "owned-receivers", "owned-values"]
		.map(name => `src/backends/jvm/${name}.mjs`)
	, ...["compile-jvm-sources", "multi-profile-project", "native-c-projection"
		, "native-project", "owned-jvm-artifacts", "owned-jvm-projection"]
		.map(name => `src/build/${name}.mjs`)
	, "src/release/owned-maven.mjs"
	, "tests/helpers/owned-jvm-call-fixture.mjs"
	, "tests/helpers/owned-jvm-package-tamper.mjs"
	, "tests/helpers/owned-jvm-installed-assets.mjs"
	, "tests/helpers/type-corpus-jvm.mjs"
	, "tests/helpers/owned-callback-combined-release.mjs"
	, "tests/helpers/copied-fixture-source-history.mjs"
	, "tests/helpers/owned-dotnet-callback-result-history.mjs"
	, "tests/helpers/owned-dotnet-callback-result-acceptance.mjs"
	, "tests/helpers/owned-dotnet-callback-result-package-execution.mjs"
	, "tests/owned-dotnet-callback-result-history.test.mjs"
]);
assert.equal(sha256(await readFile(previous.path)), previous.sha256);
const inventoryPath = "docs/type-surface.v1.json";
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
for(const evidence of inventory.evidence) for(const file of evidence.files)
	file.sha256 = sha256(await readFile(file.path));
await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
const paths = execFileSync("git", ["diff", "--name-only", "--diff-filter=M", baseline], { encoding: "utf8" })
	.trim().split("\n").filter(Boolean).sort();
for(const path of paths) assert.ok(allowed.has(path), `Unreviewed source transition: ${path}`);
const updates = [];
for(const path of paths)
{
	const current = await readFile(path, "utf8");
	const prior = execFileSync("git", ["show", `${baseline}:${path}`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
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
		, edits: [{
			start
			, current: current.slice(start, currentEnd)
			, previous: prior.slice(start, priorEnd)
		}]
	});
}
const bytes = JSON.stringify({ baselineRevision: baseline
	, kind: "owned-jvm-callback-result-source-history"
	, previous
	, schemaVersion: 1
	, updates }, null, 2) + "\n";
await writeFile(historyPath, bytes);
const source = await readFile(helperPath, "utf8");
const pattern = /export const ownedJvmCallbackHistorySha256 = "(?:PENDING|[a-f0-9]{64})";/gu;
assert.equal([...source.matchAll(pattern)].length, 1);
await writeFile(helperPath, source.replace(pattern, `export const ownedJvmCallbackHistorySha256 = "${sha256(bytes)}";`));
process.stdout.write(`Updated ${updates.length} staged source transitions; predecessor receipts unchanged.\n`);
