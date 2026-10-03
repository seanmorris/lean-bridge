/**
 * Record the bounded optional Perl extension; never rewrite older ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { perlVariantHistoryPath, perlVariantBaseline, perlVariantIntegration
	, perlVariantSuccessorBaseline
	, perlVariantPrevious, perlVariantPredecessor, perlVariantSuccessorPaths
	, perlVariantExtensionPaths, perlVariantIntroducedPaths, assertPerlVariantHistory } from "../tests/helpers/owned-perl-callback-result-variant-history.mjs";

const helper = "tests/helpers/owned-perl-callback-result-variant-history.mjs";
const added = [helper, perlVariantHistoryPath
	, "scripts/update-owned-perl-callback-variant-history.mjs"
	, "scripts/record-owned-perl-callback-variants.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-history-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-acceptance.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-acceptance-tests.mjs"
	, "docs/evidence/owned-perl-callback-result-variants-20261003.md"
	, "docs/evidence/owned-perl-callback-result-variants-20261003.json"];
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 ** 2 });
const at = (revision, path) => git(["show", `${revision}:${path}`]);
assert.equal(git(["rev-parse", "HEAD"]).trim(), perlVariantBaseline, "Later edits require a new stage, not regeneration.");
const lineage = ["bffb781a7a0926b93dcef46c2bc03efecab86cf3", perlVariantIntegration];
const before = git(["rev-parse", lineage[0] + "^"]).trim();
assert.equal(before, perlVariantSuccessorBaseline);
assert.equal(git(["rev-parse", lineage[1] + "^"]).trim(), lineage[0]);
const changes = git(["diff", "--name-status", "--no-renames", before, perlVariantIntegration]).trim().split("\n").map(line => line.split("\t"));
assert.deepEqual(changes.filter(([status]) => status === "M").map(([, path]) => path), perlVariantSuccessorPaths);
assert.deepEqual(changes.filter(([status]) => status === "A").map(([, path]) => path), perlVariantIntroducedPaths);
assert.ok(changes.every(([status]) => ["A", "M"].includes(status)));
for(const predecessor of [perlVariantPrevious, perlVariantPredecessor])
{
	assert.equal(sha256(await readFile(predecessor.path)), predecessor.sha256);
	assert.equal(sha256(at(perlVariantBaseline, predecessor.path)), predecessor.sha256);
}
for(const line of git(["diff", "--name-status", "--no-renames", perlVariantBaseline]).trim().split("\n").filter(Boolean))
{
	const [status, path] = line.split("\t");
	assert.ok(status === "M" && perlVariantExtensionPaths.includes(path) || status === "A" && added.includes(path), line);
}
for(const path of git(["ls-files", "--others", "--exclude-standard"]).trim().split("\n").filter(Boolean))
	assert.ok(added.includes(path) || [".toolchains", "node_modules"].includes(path), path);
const update = (path, current, previous) => {
	assert.notEqual(current, previous, path); let start = 0;
	while(start < current.length && start < previous.length && current[start] === previous[start]) start++;
	let end = current.length, priorEnd = previous.length;
	while(end > start && priorEnd > start && current[end - 1] === previous[priorEnd - 1])
	{ end--; priorEnd--; }
	return { path, currentSha256: sha256(current), previousSha256: sha256(previous)
		, strategy: "spans"
		, edits: [{ start, current: current.slice(start, end), previous: previous.slice(start, priorEnd) }] };
};
const successorUpdates = perlVariantSuccessorPaths.map(path => update(path, at(perlVariantIntegration, path), at(before, path)));
const extensionUpdates = [];
for(const path of perlVariantExtensionPaths) extensionUpdates.push(update(path, await readFile(path, "utf8"), at(perlVariantBaseline, path)));
const introducedSources = Object.fromEntries(perlVariantIntroducedPaths.map(path => [path, { sha256: sha256(at(perlVariantIntegration, path)) }]));
const record = { schemaVersion: 1
	, kind: "owned-perl-callback-result-variant-source-history"
	, extensionBaselineRevision: perlVariantBaseline
	, successorBaselineRevision: perlVariantSuccessorBaseline
	, successorIntegrationRevision: perlVariantIntegration
	, lineage, previous: perlVariantPrevious, predecessor: perlVariantPredecessor
	, successorUpdates, extensionUpdates, introducedSources };
assertPerlVariantHistory(record);
const bytes = JSON.stringify(record, null, 2) + "\n", source = await readFile(helper, "utf8");
const pattern = /export const perlVariantHistorySha256 = "(?:PENDING|[a-f0-9]{64})";/gu;
assert.equal([...source.matchAll(pattern)].length, 1);
await writeFile(perlVariantHistoryPath, bytes);
await writeFile(helper, source.replace(pattern, `export const perlVariantHistorySha256 = "${sha256(bytes)}";`));
process.stdout.write(`Recorded ${successorUpdates.length} formerly excluded successors, ${extensionUpdates.length} extension transitions and ${Object.keys(introducedSources).length} introduced readers.\n`);
