#!/usr/bin/env node
/**
 * Record the missing checked-JavaScript disposition without rewriting an
 * earlier source-history ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";

const predecessor = "8e43e3210de3053867485f71929d0fe610f74966";
const historyPath
	= "docs/evidence/checked-javascript-disposition-source-history-20261017.json";
const inventoryPath = "docs/type-surface.v1.json";
const restoredRootAttributes = {
	path: ".gitattributes"
	, predecessorSha256: "bc7f83c3c940635f624ada398ba6b396157a1575ab3d0401f18674090b5786fe"
	, currentSha256: "665b28fb2dcbd6d1c09b4007fb1c05b1f9061a909aa0755ddbab4d2be258441b"
};
const sourcePaths = [
	"config/checked-javascript.json"
	, "scripts/promote-fin-native-hosted-evidence.mjs"
	, "scripts/update-hosted-container-inventory-history.mjs"
	, "src/adoption/test-profiles.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/checked-records.test.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/current-source-evidence.test.mjs"
	, "tests/fin-container-edge-integration-history.test.mjs"
	, "tests/fin-scalar-dispatch-inventory.test.mjs"
	, "tests/generic-record-array-rollout.test.mjs"
	, "tests/helpers/archive-batch-source-history-tests.mjs"
	, "tests/helpers/browser-generic-promotion-source-history-tests.mjs"
	, "tests/helpers/browser-install-source-history-tests.mjs"
	, "tests/helpers/browser-refinements-source-history-tests.mjs"
	, "tests/helpers/callback-coverage-repair-source-history-tests.mjs"
	, "tests/helpers/callback-fin-promotion-source-history-tests.mjs"
	, "tests/helpers/callback-fin-promotion-tests.mjs"
	, "tests/helpers/callback-fin-source-history-tests.mjs"
	, "tests/helpers/checked-record-browser-history-tests.mjs"
	, "tests/helpers/checked-record-host-ci-workflow-tests.mjs"
	, "tests/helpers/checked-record-native-promotion-tests.mjs"
	, "tests/helpers/checked-record-perl-ci-workflow-tests.mjs"
	, "tests/helpers/checked-record-perl-promotion-tests.mjs"
	, "tests/helpers/checked-record-promotion-source-history-tests.mjs"
	, "tests/helpers/checked-record-promotion-tests.mjs"
	, "tests/helpers/ci-contract-repair-source-history.mjs"
	, "tests/helpers/ci-dependency-timeout-source-history-tests.mjs"
	, "tests/helpers/cli-package-config-history-tests.mjs"
	, "tests/helpers/cli-package-config-history.mjs"
	, "tests/helpers/combined-lineage-source-history-tests.mjs"
	, "tests/helpers/container-host-dispatch-source-history-tests.mjs"
	, "tests/helpers/core-quality-budget-tests.mjs"
	, "tests/helpers/cpan-cli-control-source-history-tests.mjs"
	, "tests/helpers/cpp-fin-dispatch-integration-tests.mjs"
	, "tests/helpers/diagnostic-followup-source-history-tests.mjs"
	, "tests/helpers/dotnet-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/dotnet-fin-source-history-tests.mjs"
	, "tests/helpers/fin-container-evidence-ci-tests.mjs"
	, "tests/helpers/fin-core-repair-history-tests.mjs"
	, "tests/helpers/fin-distribution-source-history-tests.mjs"
	, "tests/helpers/fin-entry-integration-tests.mjs"
	, "tests/helpers/fin-native-batch-promotion-source-history-tests.mjs"
	, "tests/helpers/fin-native-batch-promotion-tests.mjs"
	, "tests/helpers/fin-native-hosted-promotion-tests.mjs"
	, "tests/helpers/fin-product-evidence-tests.mjs"
	, "tests/helpers/fin-product-php-name-source-history-tests.mjs"
	, "tests/helpers/fin-products-source-history-tests.mjs"
	, "tests/helpers/fin-python-ruby-archive-source-history-tests.mjs"
	, "tests/helpers/fin-python-ruby-host-notes-source-history-tests.mjs"
	, "tests/helpers/fin-python-ruby-promotion-source-history-tests.mjs"
	, "tests/helpers/fin-python-ruby-promotion-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/fin-runtime-provenance-source-history-tests.mjs"
	, "tests/helpers/generic-record-browser-archive-source-history-tests.mjs"
	, "tests/helpers/generic-record-browser-source-history-tests.mjs"
	, "tests/helpers/generic-record-hosts-source-history-tests.mjs"
	, "tests/helpers/generic-record-npm-closure-tests.mjs"
	, "tests/helpers/generic-record-promotion-source-history-tests.mjs"
	, "tests/helpers/generic-record-specialization-source-history-tests.mjs"
	, "tests/helpers/generic-records-engine-source-history-tests.mjs"
	, "tests/helpers/generic-records-source-history-tests.mjs"
	, "tests/helpers/generic-refusal-fix-source-history-tests.mjs"
	, "tests/helpers/history-digest-source-history-tests.mjs"
	, "tests/helpers/host-fin-evidence-source-history-tests.mjs"
	, "tests/helpers/hosted-container-inventory.mjs"
	, "tests/helpers/inheritance-subtype-harness-source-history-tests.mjs"
	, "tests/helpers/inherited-record-archive-source-history-tests.mjs"
	, "tests/helpers/inherited-record-promotion-tests.mjs"
	, "tests/helpers/inherited-records-source-history-tests.mjs"
	, "tests/helpers/jvm-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/jvm-fin-source-history-tests.mjs"
	, "tests/helpers/jvm-shard-source-history-tests.mjs"
	, "tests/helpers/native-consumer-partition-history-tests.mjs"
	, "tests/helpers/native-consumer-partition-tests.mjs"
	, "tests/helpers/native-fin-containers-source-history-tests.mjs"
	, "tests/helpers/native-fin-jvm-exit-history-tests.mjs"
	, "tests/helpers/native-fin-promotion-source-history-tests.mjs"
	, "tests/helpers/native-fin-promotion-tests.mjs"
	, "tests/helpers/native-fin-source-history-tests.mjs"
	, "tests/helpers/native-observation-split-tests.mjs"
	, "tests/helpers/native-specializations-source-history-tests.mjs"
	, "tests/helpers/native-subtype-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-diagnostic-oracle-source-history-tests.mjs"
	, "tests/helpers/node-consumer-budget-ci-tests.mjs"
	, "tests/helpers/nominal-fin-contract-tests.mjs"
	, "tests/helpers/nominal-fin-source-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-npm-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-ruby-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-native-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-npm-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-php-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-php-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-path-history-tests.mjs"
	, "tests/helpers/nominal-subtype-python-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-python-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-promotion-tests.mjs"
	, "tests/helpers/npm-fin-diagnostics-source-history-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-history-tests.mjs"
	, "tests/helpers/perl-closure-native-budget-tests.mjs"
	, "tests/helpers/perl-evidence-repair-source-history-tests.mjs"
	, "tests/helpers/perl-fin-source-history-tests.mjs"
	, "tests/helpers/perl-indexed-errors-source-history-tests.mjs"
	, "tests/helpers/perl-refinement-hosted-source-history-tests.mjs"
	, "tests/helpers/perl-refinements-source-history-tests.mjs"
	, "tests/helpers/perl-scalar-relocation-source-history-tests.mjs"
	, "tests/helpers/perl-xs-budget-source-history-tests.mjs"
	, "tests/helpers/php-callback-installed-staging-history-tests.mjs"
	, "tests/helpers/php-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/php-fin-source-history-tests.mjs"
	, "tests/helpers/php-receiver-dependency-source-history-tests.mjs"
	, "tests/helpers/php-shard-ci-tests.mjs"
	, "tests/helpers/php-shard-source-history-tests.mjs"
	, "tests/helpers/php-wasm-corpus-partition-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-entry-ci-tests.mjs"
	, "tests/helpers/primitive-subtype-history-repair-tests.mjs"
	, "tests/helpers/python-fin-source-history-tests.mjs"
	, "tests/helpers/python-refinement-evidence-source-history-tests.mjs"
	, "tests/helpers/refinement-audit-source-history-tests.mjs"
	, "tests/helpers/refinement-ci-followup-source-history-tests.mjs"
	, "tests/helpers/refinement-ci-repair-source-history-tests.mjs"
	, "tests/helpers/refinement-closure-source-history-tests.mjs"
	, "tests/helpers/refinement-core-followup-source-history-tests.mjs"
	, "tests/helpers/refinement-history-cache-tests.mjs"
	, "tests/helpers/reviewed-callback-fin-admission-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-acceptance-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-evidence-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-host-evidence-tests.mjs"
	, "tests/helpers/reviewed-fin-promotion-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-promotion-tests.mjs"
	, "tests/helpers/reviewed-fin-refusal-ci-tests.mjs"
	, "tests/helpers/reviewed-fin-source-history-tests.mjs"
	, "tests/helpers/reviewed-record-promotion-tests.mjs"
	, "tests/helpers/reviewed-scalar-hosts-source-history-tests.mjs"
	, "tests/helpers/reviewed-scalar-rollout-source-history-tests.mjs"
	, "tests/helpers/reviewed-semantic-decisions-source-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-admission-source-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-decisions-source-history-tests.mjs"
	, "tests/helpers/ruby-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/ruby-fin-source-history-tests.mjs"
	, "tests/helpers/runtime-receipt-source-history-tests.mjs"
	, "tests/helpers/rust-fin-source-history-tests.mjs"
	, "tests/helpers/scalar-fin-rejection-source-history-tests.mjs"
	, "tests/helpers/scalar-fin-source-entry-ci-source-history-tests.mjs"
	, "tests/helpers/scalar-fin-source-entry-integration-source-history-tests.mjs"
	, "tests/helpers/scalar-fin-wording-source-history-tests.mjs"
	, "tests/helpers/source-history-memo.mjs"
	, "tests/helpers/structural-subtype-core-ci-history-tests.mjs"
	, "tests/helpers/structural-subtype-registration-history-tests.mjs"
	, "tests/helpers/test-profile-registration-source-history-tests.mjs"
	, "tests/helpers/wit-callback-runtime-staging-history-tests.mjs"
	, "tests/helpers/wit-dependency-source-history-tests.mjs"
	, "tests/helpers/wit-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/wit-fin-source-history-tests.mjs"
	, "tests/hosted-container-inventory.test.mjs"
	, "tests/native-edge-array-harness-history.test.mjs"
	, "tests/owned-javascript-receiver-evidence.test.mjs"
	, "tests/owned-php-wasm-ci.test.mjs"
	, "tests/perl-relocated-promotion.test.mjs"
	, "tests/php-wasm-fin.test.mjs"
	, "tests/recursive-component-regression-repair-source-history.test.mjs"
	, "tests/recursive-wit-test-registration-history.test.mjs"
	, "tests/reviewed-fin-refusal-history.test.mjs"
	, "tests/test-profile-backlog-repair.test.mjs"
	, "tests/wasm-ci-array-history.test.mjs"
	, "tests/wasm-entry-archive-history.test.mjs"
	, "tests/wasm-entry-controls-history.test.mjs"
	, "tests/wasm-entry-harness-history.test.mjs"
	, "tests/wasm-entry-supplement-history.test.mjs"
	, "tests/wasm-entry-supplement.test.mjs"
].sort();
const additionPaths = [
	"scripts/update-checked-javascript-disposition-history.mjs"
	, "tests/checked-record-browser-ci.test.mjs"
	, "tests/checked-record-browser-foundation.test.mjs"
	, "tests/checked-record-browser-promotion.test.mjs"
	, "tests/checked-record-native-archives.test.mjs"
	, "tests/checked-record-native-ci.test.mjs"
	, "tests/checked-record-native-history.test.mjs"
	, "tests/checked-record-perl-acceptance.test.mjs"
	, "tests/checked-record-php-wasm-evidence-ci.test.mjs"
	, "tests/checked-record-php-wasm-foundation.test.mjs"
	, "tests/checked-record-php-wasm-promotion.test.mjs"
	, "tests/helpers/checked-javascript-disposition-history-tests.mjs"
	, "tests/helpers/checked-javascript-disposition-history.mjs"
	, "tests/helpers/source-at-fin-history-milestone.mjs"
].sort();
const historicalSpecs = [
	{
		commit: "b79328f845381df3d29e640a786dc6ce5c655d1f"
		, predecessorCommit: "ea1cf3ac43f125c8648b2e8d32e064b30ad3eec3"
		, paths: ["tests/helpers/nominal-primitive-subtype-tests.mjs"]
	}
	, {
		commit: "18bcdff78d98a15d1b5fbacac7654b305a8d5f9c"
		, predecessorCommit: "b79328f845381df3d29e640a786dc6ce5c655d1f"
		, paths: ["tests/helpers/nominal-primitive-subtype-tests.mjs"]
		, modifiedPaths: [
			"tests/helpers/nominal-primitive-subtype-dotnet-generators.mjs"
			, "tests/helpers/nominal-primitive-subtype-dotnet-provenance.mjs"
			, "tests/helpers/nominal-primitive-subtype-tests.mjs"
		]
	}
	, {
		commit: "f6c632d18f48ec14eaafe2c0bbecfc10672217bd"
		, predecessorCommit: "ecb7e22ed0e106bad8184d9a058e3511e2545420"
		, paths: ["tests/helpers/nominal-primitive-subtype-tests.mjs"]
	}
	, {
		commit: "0da829c7e1c767a28b4dd7ae7a9cd2c5ac8871d8"
		, predecessorCommit: "0f4c7b519a7a40d8298dba442ee6614a217f1a0e"
		, paths: ["tests/helpers/nominal-primitive-subtype-tests.mjs"]
	}
	, {
		commit: "b24dcd2606e959caebd7d152c2554b6d7a46e157"
		, predecessorCommit: "0da829c7e1c767a28b4dd7ae7a9cd2c5ac8871d8"
		, paths: ["tests/helpers/nominal-primitive-subtype-tests.mjs"]
	}
	, {
		commit: "5676f6cabdf71f38c777f408ed25e3c74801e5db"
		, predecessorCommit: "cf7560011431138f9dac9f69aa047e1579638e29"
		, paths: ["tests/helpers/nominal-subtype-npm-report.mjs"]
		, modifiedPaths: [
			"tests/helpers/nominal-subtype-entry-tests.mjs"
			, "tests/helpers/nominal-subtype-entry.mjs"
			, "tests/helpers/nominal-subtype-npm-installed-tests.mjs"
			, "tests/helpers/nominal-subtype-npm-report.mjs"
		]
	}
	, {
		commit: "66b441ecb8c3437a61796c9798c9935672bc4c52"
		, predecessorCommit: "dd9af401088a52e701c8cfa684a56c4a6f9be2df"
		, paths: [".gitattributes"
			, "tests/recursive-checked-record-wit.test.mjs"]
	}
	, {
		commit: "e30a8577c8fbe7c4d29ed0157a032ba015843280"
		, predecessorCommit: "66b441ecb8c3437a61796c9798c9935672bc4c52"
		, paths: ["scripts/run-test-profile.mjs"
			, "tests/helpers/core-quality-budget-tests.mjs"]
	}
	, {
		commit: "bd9ebbf14f05a8750364255bf2416890b79d373e"
		, predecessorCommit: "e30a8577c8fbe7c4d29ed0157a032ba015843280"
		, paths: [".gitattributes"
			, "tests/helpers/recursive-checked-record-rust-tests.mjs"]
	}
	, {
		commit: "8e43e3210de3053867485f71929d0fe610f74966"
		, predecessorCommit: "ff1df8449a7f52fd8aee5203eae2493cf812cd2f"
		, paths: [".gitattributes"
			, "tests/recursive-checked-record-php.test.mjs"]
	}
];
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessor
	, "Checked-JavaScript disposition history must stay on its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", historyPath]).trim(), ""
	, "Never rewrite a committed checked-JavaScript disposition ledger");
const draft = await readFile(historyPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-javascript-disposition-source-v1");
	assert.equal(draft.predecessorCommit, predecessor);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"])
	.trim().split("\n").filter(path => path && path !== inventoryPath
		&& path !== restoredRootAttributes.path).sort()
, sourcePaths);
assert.equal(sha256(git(["show", `${predecessor}:${restoredRootAttributes.path}`]))
	, restoredRootAttributes.predecessorSha256);
assert.equal(sha256(await readFile(restoredRootAttributes.path))
	, restoredRootAttributes.currentSha256);

const sources = new Map();
for(const path of sourcePaths)
{
	const previous = git(["show", `${predecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of additionPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${predecessor}:${path}`], { stdio: "ignore" }).status, 0);
	const current = await readFile(path);
	additions.push({ path, currentSha256: sha256(current) });
}

const inventoryPrevious = git(["show", `${predecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
const pinUpdates = [];
let pinCount = 0;
for(const [path, source] of sources)
{
	const previousSha256 = sha256(source.previous);
	const currentSha256 = sha256(source.current);
	let count = 0;
	for(const entry of inventory.evidence) for(const file of entry.files)
		if(file.path === path && file.sha256 === previousSha256)
		{
			file.sha256 = currentSha256;
			count++;
		}
	if(count)
	{
		pinCount += count;
		pinUpdates.push({ path, previousSha256, currentSha256, count });
	}
}
assert.equal(pinCount, 418
	, "Checked-JavaScript and Core history repairs must refresh 418 live source pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-checked-javascript-disposition-"
));
try
{
	const edits = async (previous, current) => {
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous);
		await writeFile(currentPath, current);
		let diff;
		try
		{
			diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
				, previousPath, currentPath]
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		const result = [...diff.matchAll(
			/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
		)].map(match => {
			const previousCount = Number(match[2] ?? 1);
			const currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return {
				start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart
					, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart
					, currentStart + currentCount).join("")
			};
		});
		assert.ok(result.length > 0);
		return result;
	};
	const paths = [inventoryPath, ...sourcePaths].sort();
	const updates = [];
	for(const path of paths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
		};
		if(path === inventoryPath) update.replacements = pinUpdates.map(pin => ({
			previous: pin.previousSha256, current: pin.currentSha256
			, count: pin.count
		}));
		else update.edits = await edits(source.previous, source.current);
		updates.push(update);
	}
	const historicalTransitions = [];
	for(const spec of historicalSpecs)
	{
		assert.equal(git(["rev-parse", `${spec.commit}^`]).trim()
			, spec.predecessorCommit);
		const observed = git(["diff", "--name-only", "--diff-filter=M"
			, spec.predecessorCommit, spec.commit]).trim().split("\n")
			.filter(Boolean).sort();
		const modifiedPaths = spec.modifiedPaths ?? spec.paths;
		assert.deepEqual(observed, [...modifiedPaths].sort(), spec.commit);
		assert.ok(spec.paths.every(path => modifiedPaths.includes(path))
			, spec.commit);
		const historicalUpdates = [];
		for(const path of [...spec.paths].sort())
		{
			const previous = git(["show"
				, `${spec.predecessorCommit}:${path}`]);
			const current = git(["show", `${spec.commit}:${path}`]);
			historicalUpdates.push({
				path, previousSha256: sha256(previous)
				, currentSha256: sha256(current)
				, edits: await edits(previous, current)
			});
		}
		historicalTransitions.push({
			commit: spec.commit, predecessorCommit: spec.predecessorCommit
			, updates: historicalUpdates
		});
	}
	const pathsSha256 = sha256(JSON.stringify(paths));
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "checked-javascript-disposition-source-v1"
		, predecessorCommit: predecessor, pathsSha256, pinCount, pinUpdates
		, additions, updates, historicalTransitions
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(historyPath, record, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} transitions, ${additions.length} additions and refreshed ${pinCount} pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
