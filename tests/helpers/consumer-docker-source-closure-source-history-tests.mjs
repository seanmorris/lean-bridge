/**
 * Authenticate the bounded Docker consumer source-closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { ownedPhpWasmCallbackResultEvidencePath }
	from "./owned-php-wasm-callback-result-evidence.mjs";
import {
	ownedPhpWasmCallbackProducer
	, ownedPhpWasmCallbackProducerClosure
} from "./owned-php-wasm-callback-result-replay.mjs";
import {
	beforeConsumerDockerSourceClosureSource
	, consumerDockerSourceClosureHistoryAdditions
	, consumerDockerSourceClosureHistoryPath
	, consumerDockerSourceClosureImplementation
	, consumerDockerSourceClosureImplementationAdditions
	, consumerDockerSourceClosureImplementationPaths
	, consumerDockerSourceClosureIntegrationPaths
	, consumerDockerSourceClosurePredecessor
	, reverseConsumerDockerSourceClosureUpdate
} from "./consumer-docker-source-closure-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	consumerDockerSourceClosureHistoryPath, "utf8"));

test("Docker source closure records the exact repeated ENOSPC failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "consumer-docker-source-closure-source-v1");
		assert.equal(history.predecessorCommit
			, consumerDockerSourceClosurePredecessor);
		assert.equal(history.implementationCommit
			, consumerDockerSourceClosureImplementation);
		assert.deepEqual(history.failedRun, {
			workflow: 41189690848, job: 124506591222
		});
		assert.deepEqual(history.priorFailedRun, {
			workflow: 41170510578, job: 124447261275
		});
		assert.deepEqual(history.phpWasmFailedRun, {
			workflow: 41189690848, job: 124506591191
			, failedAt: "2026-10-31T10:56:45Z"
			, failedStep: "Verify callback-result owners and installed packages"
			, error: "retained producer tree unavailable in shallow checkout"
		});
		assert.equal(history.failure, "hosted runner ENOSPC");
		assert.equal(history.failedStep
			, "Execute the clean consumer through Docker");
		assert.deepEqual(history.localInventory, {
			tests: 870, passed: 866, failed: 4
			, failedTests: [
				"Core/PHP CI input repair refreshes all 93 live citations"
				, "dependent Fin compiler repair refreshes exactly four live citations"
				, "final Core test repair closes all nine registrations and 102 pins"
				, "proof evidence audit binds 102 exact cells and preserves 102 gaps"
			]
		});
		assert.deepEqual(history.updates.map(item => item.path)
			, consumerDockerSourceClosureImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, consumerDockerSourceClosureIntegrationPaths);
	}
);

test("Docker source closure reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			consumerDockerSourceClosureImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, consumerDockerSourceClosureImplementation + ":" + update.path]);
		assert.equal(reverseConsumerDockerSourceClosureUpdate(
			current, update), previous, update.path);
		assert.equal(beforeConsumerDockerSourceClosureSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("Docker source closure preserves the complete type-surface model"
	, async () => {
		const history = await record();
		assert.equal(history.refreshedCitationCount, 117);
		assert.equal(history.semanticChanges, 0);
		assert.deepEqual(history.typeSurfaceCounts, {
			evidence: 900, observations: 717, paths: 2, positions: 6
			, profiles: 17, stages: 5
		});
		const inventoryPath = "docs/type-surface.v1.json";
		const before = git(["show"
			, consumerDockerSourceClosurePredecessor + ":" + inventoryPath]);
		const after = git(["show"
			, consumerDockerSourceClosureImplementation + ":" + inventoryPath]);
		let restored = after;
		for(const pin of history.currentSourcePins)
		{
			restored = restored.replaceAll(pin.current, pin.previous);
			assert.equal(after.split(pin.current).length - 1, pin.count);
			assert.equal(after.includes(pin.previous), false);
		}
		assert.equal(restored, before);
	}
);

test("Docker source closure excludes history and unused toolchains"
	, async () => {
		const workflow = await readFile(
			".github/workflows/consumer-matrix.yml", "utf8");
		const job = workflow.split("  docker-engine:\n")[1]
			?.split("\n  perl-consumer:\n")[0];
		assert.ok(job);
		const mismatches = [];
		const recordMismatch = (label, passed) => {
			if(!passed) mismatches.push(label);
		};
		recordMismatch("shallow checkout"
			, /^ {10}fetch-depth: 1$/mu.test(job));
		recordMismatch("no full checkout"
			, !/^ {10}fetch-depth: 0$/mu.test(job));
		recordMismatch("Git shallow guard"
			, /git rev-parse --is-shallow-repository/u.test(job));
		recordMismatch("one-commit guard"
			, /git rev-list --count HEAD/u.test(job));
		recordMismatch("no toolchain cache"
			, !/actions\/cache|\.toolchains/u.test(job));
		recordMismatch("no duplicate bootstrap"
			, !/npm run bootstrap/u.test(job));
		for(const command of [
			"npm ci --ignore-scripts", "npm run build:builder-image"
			, "npm run test:builder-ownership", "npm run test:consumer:docker-ci"
		]) recordMismatch(command, job.includes(command));
		assert.deepEqual(mismatches, []);
	}
);

test("PHP-Wasm source closure fetches only its exact retained producer"
	, async () => {
		const history = await record();
		assert.deepEqual(history.phpWasmProducerFetch, {
			producer: ownedPhpWasmCallbackProducer
			, sourceMapFiles: 17, importClosureFiles: 114
			, fetchedClosureFiles: 122, maxRequiredBlobBytes: 70669
			, filterBlobLimitBytes: 131072
		});
		const workflow = await readFile(
			".github/workflows/consumer-matrix.yml", "utf8");
		const job = workflow.split("  php-wasm-callback-results:\n")[1]
			?.split("\n  php-consumers:\n")[0];
		assert.ok(job);
		assert.doesNotMatch(job, /fetch-depth: 0/u);
		assert.match(job
			, /fetch\.negotiationAlgorithm=noop fetch --no-tags --depth=1 --filter=blob:limit=128k origin "\$producer"/u);
		assert.match(job, /git cat-file -e "\$producer:package\.json"/u);
		const archive = JSON.parse(await readFile(
			ownedPhpWasmCallbackResultEvidencePath, "utf8"));
		const closure = ownedPhpWasmCallbackProducerClosure(archive.sources);
		const paths = [...new Set([
			...Object.keys(archive.sources), ...closure
		])].sort();
		assert.equal(Object.keys(archive.sources).length, 17);
		assert.equal(closure.length, 114);
		assert.equal(paths.length, 122);
		const sizes = paths.map(path => Number(git([
			"cat-file", "-s", `${ownedPhpWasmCallbackProducer}:${path}`
		]).trim()));
		assert.equal(Math.max(...sizes), 70669);
		assert.ok(sizes.every(size => size <= 128 * 1024));
	}
);

test("Docker source closure authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.implementationAdditions.map(item => item.path)
			, consumerDockerSourceClosureImplementationAdditions);
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, consumerDockerSourceClosureHistoryAdditions);
		for(const addition of [
			...history.implementationAdditions, ...history.historyAdditions
		]) assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, consumerDockerSourceClosureImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseConsumerDockerSourceClosureUpdate(current, forged));
	}
);

test("Docker source-closure writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-consumer-docker-source-closure-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /consumer-docker-source-closure-source-history-20261031\.json/u);
});
