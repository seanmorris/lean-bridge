/**
 * Validate the closed direct proof-erasure hosted capture contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	directProofErasureHostedCoreRunId
	, directProofErasureHostedLanes
	, directProofErasureHostedProducer
	, directProofErasureHostedRefusal
	, directProofErasureHostedRunId
	, directProofErasureHostedSources
	, parseDirectProofErasureHostedArchiveArgs
} from "./direct-proof-erasure-hosted-archive.mjs";

test("hosted proof-erasure capture closes ten lanes and seventeen profiles", () => {
	assert.match(directProofErasureHostedProducer, /^[a-f0-9]{40}$/u);
	assert.ok(Number.isSafeInteger(directProofErasureHostedRunId));
	assert.ok(Number.isSafeInteger(directProofErasureHostedCoreRunId));
	assert.equal(directProofErasureHostedLanes.length, 10);
	assert.equal(new Set(directProofErasureHostedLanes.flatMap(
		lane => lane.profiles)).size, 17);
	assert.equal(new Set(directProofErasureHostedLanes.map(
		lane => lane.key)).size, 10);
	for(const lane of directProofErasureHostedLanes)
	{
		assert.equal(lane.runId, directProofErasureHostedRunId);
		assert.equal(lane.producerCommit, directProofErasureHostedProducer);
		assert.deepEqual(Object.keys(lane.steps).sort()
			, ["acceptance", "enforce", "upload"]);
	}
	assert.equal(directProofErasureHostedRefusal.diagnostic, "proof-only");
});

test("hosted proof-erasure archiver accepts only one canonical root", () => {
	assert.equal(parseDirectProofErasureHostedArchiveArgs([
		"--input-root", "/tmp/direct-proof-input"
	]), "/tmp/direct-proof-input");
	for(const args of [
		[], ["--input-root", "relative"], ["--other", "/tmp/input"]
		, ["--input-root", "/tmp/input", "extra"]
		, ["--input-root", "/tmp/input\nother"]
	]) assert.throws(() => parseDirectProofErasureHostedArchiveArgs(args));
});

test("hosted proof-erasure producer sources contain every exact workflow step", () => {
	const workflow = execFileSync("git", ["show"
		, `${directProofErasureHostedProducer}:.github/workflows/consumer-matrix.yml`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	const perl = execFileSync("git", ["show"
		, `${directProofErasureHostedProducer}:.github/workflows/perl-consumer.yml`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	for(const lane of directProofErasureHostedLanes)
		for(const step of Object.values(lane.steps))
			assert.ok((lane.key === "language-perl" ? perl : workflow)
				.includes(`- name: ${step}`), `${lane.key}:${step}`);
});

test("hosted proof-erasure source closure is closed at immutable revisions", () => {
	const revisions = {
		producer: directProofErasureHostedProducer
		, checker: execFileSync("git", ["rev-parse", "HEAD"])
			.toString().trim()
		, archiver: execFileSync("git", ["rev-parse", "HEAD"])
			.toString().trim()
	};
	const sources = directProofErasureHostedSources(revisions);
	assert.ok(sources.length > 100);
	assert.equal(new Set(sources.map(source =>
		`${source.revision}:${source.path}`)).size, sources.length);
	for(const source of sources) assert.doesNotThrow(() => execFileSync(
		"git", ["cat-file", "-e", `${source.revision}:${source.path}`]
	));
});
