/**
 * Refusal controls for hosted dependent-signature capture and replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	dependentSignatureConsumerRun
	, dependentSignatureHostedLanes
	, dependentSignatureHostedOriginal
	, dependentSignatureHostedProducer
	, dependentSignatureHostedSources
	, dependentSignaturePerlRun
	, parseDependentSignatureHostedArchiveArgs
} from "./dependent-signature-hosted-archive.mjs";
import {
	validateDependentSignatureManagedReport
} from "./dependent-signature-hosted-evidence.mjs";
import {
	dependentFinRefinements
} from "./managed-dependent-fin.mjs";

const digest = value => sha256(value);
const pythonLane = dependentSignatureHostedLanes.find(
	lane => lane.id === "python");
const pythonConsumer = digest(dependentSignatureHostedOriginal(
	dependentSignatureHostedProducer
	, "tests/fixtures/dependent-fin-consumers/python.py"
));
const managedReport = route => {
	const artifact = {
		path: "dependentfin-1.0.0.whl", bytes: 1234
		, sha256: digest("archive")
	};
	return {
		schemaVersion: 1, reproducible: true
		, archives: { [artifact.path]: artifact.sha256 }
		, reports: [{
			profile: "python", path: route, checks: 2017
			, offlineInstall: true, compilerFreePath: true
			, consumerSha256: pythonConsumer
			, dispatch: {
				observed: false
				, reason: "the dependent comparison runs in the bundled C adapter before Lean; its rejection text and recovery are observed through the public host API"
			}
			, packages: [{ target: "pypi", artifacts: [artifact] }]
			, refinements: dependentFinRefinements
			, bindingIrSha256: digest(`binding:${route}`)
			, sourceTreeSha256: digest("source")
			, modelSha256: digest(`model:${route}`)
			, receiptSha256: digest(`receipt:${route}`)
			, ...route === "reviewed-ir"
				? { reviewedSourceSha256: digest("reviewed") } : {}
			, sourceRemovedBeforeInstallation: true
			, handoffRelocatedBeforeInstallation: true
		}]
	};
};

test("the hosted plan closes exactly 17 profiles across both author routes", () => {
	assert.equal(dependentSignatureHostedLanes.length, 14);
	const ordinaryProfiles = new Set();
	for(const lane of dependentSignatureHostedLanes)
	{
		assert.equal(lane.reportPaths.length, 2, lane.id);
		assert.equal(new Set(lane.profiles).size, lane.profiles.length, lane.id);
		for(const profile of lane.profiles) ordinaryProfiles.add(profile);
		assert.equal(lane.runId, lane.id.startsWith("perl-")
			? dependentSignaturePerlRun : dependentSignatureConsumerRun);
	}
	assert.deepEqual([...ordinaryProfiles].sort(), [
		"browser-javascript", "browser-react", "browser-worker", "c", "cpp"
		, "dotnet", "java", "kotlin", "node-javascript", "node-typescript"
		, "perl", "php-native", "php-wasm", "python", "ruby", "rust"
		, "wit-wasi"
	]);
	assert.equal(ordinaryProfiles.size * 2, 34);
	assert.equal(dependentSignatureHostedLanes.filter(
		lane => lane.id.startsWith("perl-")).length, 4);
});

test("the archive CLI accepts one canonical absolute input root only", async t => {
	const root = await mkdtemp(join(tmpdir(), "dependent-signature-args-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	assert.equal(parseDependentSignatureHostedArchiveArgs([
		"--input-root", root
	]), root);
	for(const args of [[], ["--input-root", "relative"], ["--else", root]
		, ["--input-root", root, "--input-root", root]])
		assert.throws(() => parseDependentSignatureHostedArchiveArgs(args));
});

test("managed reports bind the source, packages and live dependency graph", () => {
	for(const route of ["ordinary-source", "reviewed-ir"])
	{
		const report = managedReport(route), bytes = Buffer.from(canonicalJson(report));
		const accepted = validateDependentSignatureManagedReport(
			pythonLane, bytes, route);
		assert.deepEqual(accepted.profiles, ["python"]);
		assert.deepEqual(accepted.checks, { python: 2017 });
		for(const mutate of [
			value => { value.reports[0].checks = 2000; }
			, value => { value.reports[0].consumerSha256 = "0".repeat(64); }
			, value => { value.reports[0].refinements["DependentFin.mirror"].parameters[1].parameter = 1; }
			, value => { value.reports[0].packages[0].target = "npm"; }
			, value => { value.reports[0].offlineInstall = false; }
			, value => { delete value.archives[Object.keys(value.archives)[0]]; }
		]) {
			const forged = structuredClone(report); mutate(forged);
			assert.throws(() => validateDependentSignatureManagedReport(
				pythonLane, Buffer.from(canonicalJson(forged)), route));
		}
	}
});

const closureCommitted = spawnSync("git", [
	"cat-file", "-e", "HEAD:scripts/archive-dependent-signature-hosted.mjs"
]).status === 0;
test("source selection freezes producer fixtures plus checker and archiver", {
	skip: !closureCommitted
}, () => {
	const current = execFileSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf8"
	}).trim();
	const revisions = {
		producer: dependentSignatureHostedProducer
		, checker: current, archiver: current
	};
	const producer = dependentSignatureHostedSources(revisions);
	assert.ok(producer.some(source => source.role === "producer"
		&& source.path === "tests/managed-dependent-fin.test.mjs"));
	assert.ok(producer.some(source => source.role === "producer"
		&& source.path === "tests/fixtures/dependent-fin-consumers/perl.pl"));
	assert.equal(new Set(producer.map(source =>
		`${source.role}:${source.path}`)).size, producer.length);
});
