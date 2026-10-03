/**
 * Regenerate only the closed post-Perl callback staging transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";

const baseline = "1459c08d3a54340b9980dd62dc7145e01efb3280";
const lineage = ["68e24c2e0cfc65b5d1c68eb0c9a6ae5feb4f0938"
	, "c2c9f9ad1d2428cfb0f8459860c6d4ed1c806ba9"
	, "b266a7ea404c532469e56219c1859795bbb3fc6e"
	, "8345109d5066d0a95e917520eded18bcd574da85"];
const helperPath = "tests/helpers/post-perl-callback-staging-history.mjs";
const historyPath = "docs/evidence/post-perl-callback-staging-source-history-20261003.json";
const previous = {
	path: "docs/evidence/owned-perl-callback-result-source-history-20261003.json"
	, sha256: "7812c91c8a621252cb8a45ad9580afd7f4a2e4111a1d604b233297c4f3920e2c"
};
const completedPredecessor = {
	path: "docs/evidence/owned-perl-callback-results-20261003.json"
	, sha256: "6844d0cfd72bea211625618e74a65a484bbab1a0d61573da45b05b107387eec7"
};
const allowed = new Set([
	".github/workflows/consumer-matrix.yml", "package.json"
	, "src/adoption/test-profiles.mjs", "docs/type-surface.v1.json"
	, ...["owned-call-runtime", "owned-calls", "owned-conversion-support"
		, "owned-conversions", "owned-package", "owned-receivers", "owned-values"]
		.map(name => `src/backends/php/${name}.mjs`)
	, ...["owned-graph-model", "owned-native-resources", "owned-package"]
		.map(name => `src/backends/wit/${name}.mjs`)
	, ...["multi-profile-project", "native-c-projection", "native-project"
		, "owned-php-artifacts", "owned-php-projection", "owned-wit-artifacts"
		, "owned-wit-projection"].map(name => `src/build/${name}.mjs`)
	, "src/release/owned-composer.mjs", "tests/helpers/owned-php-native.mjs"
	, "tests/helpers/copied-fixture-source-history.mjs"
	, "tests/helpers/owned-perl-callback-result-history.mjs"
	, "tests/helpers/owned-perl-callback-result-history-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-acceptance.mjs"
	, "tests/helpers/owned-perl-callback-result-acceptance-tests.mjs"
	, "tests/owned-jvm-callback-result-history.test.mjs"
]);
const introduced = new Set([
	"tests/fixtures/structured-types/owned-perl-callback-results-variants-installed.pl"
	, "tests/fixtures/structured-types/owned-php-callback-results.php"
	, "tests/helpers/owned-perl-callback-result-variant-packaging-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-producer.mjs"
	, "tests/helpers/owned-php-callback-result-runtime-tests.mjs"
	, "tests/helpers/wit-owned-callback-result-fixture.mjs"
	, "tests/owned-php-callback-results.test.mjs"
	, "tests/wit-owned-callback-results.test.mjs"
]);
const added = new Set([...introduced, helperPath, historyPath
	, "scripts/update-post-perl-callback-staging-history.mjs"
	, "docs/evidence/owned-php-callback-runtime-staged-20261003.json"
	, "tests/helpers/post-perl-callback-staging-history-tests.mjs"
	, "tests/helpers/owned-php-callback-result-runtime-evidence.mjs"
	, "tests/helpers/owned-php-callback-result-runtime-evidence-tests.mjs"
	, "tests/helpers/owned-php-callback-result-runtime-sources.mjs"
]);
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), lineage.at(-1), "Stage frozen at 8345109; later changes require a new chained ledger.");
for(const [index, commit] of lineage.entries())
	assert.equal(git(["rev-parse", `${commit}^`]).trim(), index ? lineage[index - 1] : baseline);
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
		assert.ok(allowed.has(path), `Unreviewed source transition: ${path}`); paths.push(path);
	}
}
for(const path of git(["ls-files", "--others", "--exclude-standard"]).trim().split("\n").filter(Boolean))
	assert.ok(added.has(path) || [".toolchains", "node_modules"].includes(path), `Unreviewed untracked source: ${path}`);
const updates = [];
const inventoryPath = "docs/type-surface.v1.json";
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
for(const evidence of inventory.evidence) for(const file of evidence.files)
	file.sha256 = sha256(await readFile(file.path));
const inventoryBytes = JSON.stringify(inventory, null, 2) + "\n";
if(inventoryBytes !== git(["show", `${baseline}:${inventoryPath}`]) && !paths.includes(inventoryPath)) paths.push(inventoryPath);
for(const path of paths.sort())
{
	const current = path === inventoryPath ? inventoryBytes : await readFile(path, "utf8");
	const prior = git(["show", `${baseline}:${path}`]);
	assert.notEqual(current, prior, path);
	let start = 0;
	while(start < current.length && start < prior.length && current[start] === prior[start]) start++;
	let currentEnd = current.length, priorEnd = prior.length;
	while(currentEnd > start && priorEnd > start && current[currentEnd - 1] === prior[priorEnd - 1])
	{
		currentEnd--; priorEnd--;
	}
	updates.push({ path, currentSha256: sha256(current)
		, previousSha256: sha256(prior), strategy: "spans"
		, edits: [{ start, current: current.slice(start, currentEnd)
			, previous: prior.slice(start, priorEnd) }] });
}
const introducedSources = {};
for(const path of [...introduced].sort()) introducedSources[path] = {
	currentSha256: sha256(await readFile(path))
	, integratedSha256: sha256(git(["show", `${lineage.at(-1)}:${path}`]))
};
for(const identity of Object.values(introducedSources)) assert.equal(identity.currentSha256, identity.integratedSha256);
const bytes = JSON.stringify({ schemaVersion: 1
	, kind: "post-perl-callback-staging-source-history"
	, baselineRevision: baseline, lineage, previous, completedPredecessor
	, updates, introducedSources }, null, 2) + "\n";
const source = await readFile(helperPath, "utf8");
const pattern = /export const postPerlCallbackHistorySha256 = "(?:PENDING|[a-f0-9]{64})";/gu;
assert.equal([...source.matchAll(pattern)].length, 1);
await writeFile(historyPath, bytes);
await writeFile(inventoryPath, inventoryBytes);
await writeFile(helperPath, source.replace(pattern, `export const postPerlCallbackHistorySha256 = "${sha256(bytes)}";`));
process.stdout.write(`Updated ${updates.length} exact post-Perl source transitions and ${introduced.size} introduced source identities; predecessor receipts unchanged.\n`);
