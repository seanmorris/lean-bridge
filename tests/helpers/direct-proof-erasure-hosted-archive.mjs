/**
 * Closed hosted inputs and exact replay source closure for direct proof erasure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, posix, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	inspectCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
import {
	directProofErasureMatrixLanes
	, directProofErasureMatrixRoutes, directProofErasureMatrixWorkflow
} from "./direct-proof-erasure-matrix.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";

export const directProofErasureHostedProducer
	= "52622818425c3fb69a81ef87b5af26ce429e3136";
export const directProofErasureHostedRunId = 40824858819;
export const directProofErasureHostedCoreRunId = 40824858718;
export const directProofErasureHostedEvidenceDirectory
	= "docs/evidence/direct-proof-erasure-hosted-20261028";
export const directProofErasureHostedRefusal = Object.freeze({
	id: "refusal", workflow: ".github/workflows/quality.yml"
	, jobName: "Static quality contract"
	, testName: "fresh Lean erases a closed proof binder and refuses conditional or proof-result APIs"
	, diagnostic: "proof-only"
});

const stepNames = Object.freeze({
	npm: Object.freeze({
		acceptance: "Require direct proof erasure in Node, TypeScript and three browsers"
		, upload: "Preserve direct proof-erasure npm and browser records"
		, enforce: "Enforce Node support and the browser corpus"
	})
	, native: Object.freeze({
		acceptance: "Execute direct proof erasure through prepared C and C++ packages"
		, upload: "Preserve direct proof-erasure C and C++ packages"
		, enforce: "Enforce native consumer support"
	})
	, php: Object.freeze({
		acceptance: "Qualify direct proof erasure in native PHP and PHP-Wasm packages"
		, upload: "Upload direct proof-erasure PHP evidence"
		, enforce: "Enforce PHP support"
	})
	, perl: Object.freeze({
		acceptance: "Qualify direct proof erasure in the prepared Perl package"
		, upload: "Preserve direct proof-erasure Perl acceptance"
		, enforce: "Enforce direct proof-erasure Perl support"
	})
	, language: Object.freeze({
		acceptance: "Qualify direct proof erasure in prepared language packages"
		, upload: "Preserve direct proof-erasure language acceptance"
		, enforce: "Enforce native consumer support"
	})
	, ruby: Object.freeze({
		acceptance: "Qualify direct proof erasure in the prepared Ruby package"
		, upload: "Preserve direct proof-erasure Ruby acceptance"
		, enforce: "Enforce managed consumer support"
	})
	, managed: Object.freeze({
		acceptance: "Qualify direct proof erasure in prepared managed packages"
		, upload: "Preserve direct proof-erasure managed acceptance"
		, enforce: "Enforce managed consumer support"
	})
	, wit: Object.freeze({
		acceptance: "Qualify direct proof erasure in the prepared WIT package"
		, upload: "Preserve direct proof-erasure WIT acceptance"
		, enforce: "Enforce WIT and WASI support"
	})
});

const laneSteps = lane => {
	if(lane.key === "language-perl") return stepNames.perl;
	if(lane.key === "language-ruby") return stepNames.ruby;
	if(lane.checker === "language") return stepNames.language;
	return stepNames[lane.checker];
};

export const directProofErasureHostedLanes = Object.freeze(
	directProofErasureMatrixLanes.map(lane => Object.freeze({
		...lane, runId: directProofErasureHostedRunId
		, producerCommit: directProofErasureHostedProducer
		, workflow: directProofErasureMatrixWorkflow
		, steps: laneSteps(lane)
		, jobConclusion: lane.key === "language-perl" ? "failure" : "success"
		, failedSteps: Object.freeze(lane.key === "language-perl" ? [
			"Preserve HostNull scripting acceptance"
			, "Upload this configuration's real-Lean corpus report"
			, "Enforce scripting HostNull support"
		] : [])
	}))
);

/**
 * Parse the one canonical input root holding ten lanes and one refusal.
 *
 * @param args - Command arguments after the script name.
 */
export const parseDirectProofErasureHostedArchiveArgs = args => {
	const usage = "Usage: archive-direct-proof-erasure-hosted.mjs --input-root /absolute/hosted-input";
	assert.deepEqual(Array.isArray(args) ? args.length : null, 2, usage);
	assert.equal(args[0], "--input-root", usage);
	assert.ok(typeof args[1] === "string" && args[1].length > 0
		&& !/[\0\r\n]/u.test(args[1]) && isAbsolute(args[1])
		&& resolve(args[1]) === args[1], usage);
	return args[1];
};

/**
 * Select the original hosted bytes for one consumer lane.
 *
 * @param root - Canonical input root.
 * @param lane - Closed consumer lane.
 */
export const directProofErasureHostedInputs = (root, lane) => {
	assert.ok(directProofErasureHostedLanes.includes(lane));
	const prefix = `${root}/${lane.key}`;
	return {
		"artifact-zip": `${prefix}/artifact.zip`
		, "run-json": `${prefix}/run.json`
		, "job-json": `${prefix}/job.json`
		, "artifact-json": `${prefix}/artifact.json`
		, "job-log": `${prefix}/job.log`
	};
};

/**
 * Bind one artifact to the exact producer run and job.
 *
 * @param selected - Original API, log and ZIP paths.
 * @param lane - Closed consumer lane.
 * @param runConclusion - Exact terminal workflow conclusion.
 */
export const inspectDirectProofErasureHostedArtifact = async (
	selected, lane, runConclusion = "success"
) => {
	assert.ok(directProofErasureHostedLanes.includes(lane));
	assert.ok(["failure", "success"].includes(runConclusion));
	const hosted = await inspectCheckedRecordValueIndexHostedArtifact(
		selected, {
			workflow: lane.workflow, jobName: lane.job
			, artifactPrefix: lane.artifactPrefix
			, conclusions: { run: runConclusion, job: lane.jobConclusion }
		}
	);
	assert.equal(hosted.hostedRun.runId, lane.runId, lane.key);
	assert.equal(hosted.revision, lane.producerCommit, lane.key);
	return hosted;
};

/**
 * Require the direct acceptance/upload pair and skipped failure guard.
 *
 * @param lane - Closed consumer lane.
 * @param jobBytes - Original job API bytes.
 */
export const assertDirectProofErasureHostedSteps = (lane, jobBytes) => {
	assert.ok(directProofErasureHostedLanes.includes(lane));
	const job = JSON.parse(jobBytes), named = name => {
		const matches = job.steps.filter(step => step.name === name);
		assert.equal(matches.length, 1, `${lane.key}:${name}`);
		return matches[0];
	};
	assert.equal(named(lane.steps.acceptance).conclusion, "success");
	assert.equal(named(lane.steps.upload).conclusion, "success");
	assert.equal(named(lane.steps.enforce).conclusion, "skipped");
	assert.deepEqual(job.steps.filter(step => step.conclusion === "failure")
		.map(step => step.name), lane.failedSteps);
	return true;
};

const checker = Object.freeze({
	npm: "scripts/check-direct-proof-erasure-npm-ci.mjs"
	, native: "scripts/check-direct-proof-erasure-native-ci.mjs"
	, php: "scripts/check-direct-proof-erasure-php-ci.mjs"
	, language: "scripts/check-direct-proof-erasure-language-ci.mjs"
	, managed: "scripts/check-direct-proof-erasure-managed-ci.mjs"
	, wit: "scripts/check-direct-proof-erasure-wit-ci.mjs"
});

/**
 * Independently replay one extracted route with the original checker.
 *
 * @param lane - Closed consumer lane.
 * @param route - Ordinary or reviewed route.
 * @param extractedRoot - Path-safe extracted artifact root.
 */
export const replayDirectProofErasureHostedRoute = (
	lane, route, extractedRoot
) => {
	assert.ok(directProofErasureHostedLanes.includes(lane));
	assert.ok(directProofErasureMatrixRoutes.some(item =>
		item.reportRoute === route));
	const prefix = `${extractedRoot}/${route}`;
	const arguments_ = [checker[lane.checker]];
	if(lane.profile) arguments_.push("--profile", lane.profile);
	if(lane.group) arguments_.push("--group", lane.group);
	arguments_.push(
		"--route", route, "--producer", lane.producerCommit
		, "--directory", `${prefix}/records`, "--tap", `${prefix}/run.tap`
	);
	const bytes = execFileSync(process.execPath, arguments_, {
		maxBuffer: 128 * 1024 * 1024
	});
	const result = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(result));
	return Object.freeze({
		lane: lane.key, route, producerCommit: lane.producerCommit
		, profiles: lane.profiles, result
	});
};

const sourceCache = new Map();
/**
 * Read an immutable source blob.
 *
 * @param revision - Exact source revision.
 * @param path - Repository-relative source path.
 */
export const directProofErasureHostedOriginal = (revision, path) => {
	const key = `${revision}:${path}`;
	if(!sourceCache.has(key)) sourceCache.set(key, execFileSync(
		"git", ["show", key], { maxBuffer: 256 * 1024 ** 2 }
	));
	return sourceCache.get(key);
};
const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = directProofErasureHostedOriginal(revision, path);
		paths.add(path);
		if(!/\.[cm]?js$/u.test(path)) return;
		for(const specifier of moduleSpecifiers(bytes.toString(), path))
		{
			const joined = posix.normalize(posix.join(
				posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...paths].sort();
};
const tree = (revision, prefix) => execFileSync("git", [
	"ls-tree", "-r", "--name-only", revision, "--", prefix
], { encoding: "utf8" }).trim().split("\n").filter(Boolean);

const producerEntries = Object.freeze([
	directProofErasureMatrixWorkflow, ".github/workflows/perl-consumer.yml"
	, ...Object.values(checker)
	, ...["npm", "native", "php", "language", "managed", "wit"]
		.map(name => `scripts/run-direct-proof-erasure-${name}-ci.sh`)
	, "tests/direct-proof-erasure-npm-installed.test.mjs"
	, "tests/direct-proof-erasure-native-installed.test.mjs"
	, "tests/direct-proof-erasure-php-installed.test.mjs"
	, "tests/direct-proof-erasure-language-installed.test.mjs"
	, "tests/direct-proof-erasure-managed-installed.test.mjs"
	, "tests/direct-proof-erasure-wit-installed.test.mjs"
	, "tests/elaborated-metadata.test.mjs"
	, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
	, "lean-toolchain", "package.json", "package-lock.json"
	, "docs/evidence/proof-erasure-retained-audit-20261028.json"
]);

/**
 * Select exact producer, checker and archiver source closures.
 *
 * @param revisions - Exact producer, checker and archiver commits.
 */
export const directProofErasureHostedSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort()
		, ["archiver", "checker", "producer"]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.equal(revisions.producer, directProofErasureHostedProducer);
	const selected = new Map();
	const add = (revision, path) => selected.set(`${revision}:${path}`
		, Object.freeze({ revision, path }));
	for(const path of closure(revisions.producer, producerEntries))
		add(revisions.producer, path);
	for(const prefix of [
		"tests/fixtures/onboarding/direct-proof-erasure"
		, "tests/fixtures/direct-proof-erasure-consumers"
	]) for(const path of tree(revisions.producer, prefix))
		add(revisions.producer, path);
	for(const path of closure(revisions.checker, [
		"tests/helpers/direct-proof-erasure-hosted-archive.mjs"
		, "tests/helpers/direct-proof-erasure-matrix.mjs"
	])) add(revisions.checker, path);
	for(const path of closure(revisions.archiver, [
		"scripts/archive-direct-proof-erasure-hosted.mjs"
		, "scripts/download-direct-proof-erasure-hosted-inputs.mjs"
	])) add(revisions.archiver, path);
	return Object.freeze([...selected.values()].sort((left, right) =>
		`${left.revision}:${left.path}`.localeCompare(
			`${right.revision}:${right.path}`)));
};

/**
 * Map an exact retained source to a collision-free archive path.
 *
 * @param source - Revision and repository path.
 */
export const directProofErasureHostedSourcePath = source => {
	assert.match(source.revision, /^[a-f0-9]{40}$/u);
	assert.ok(!source.path.startsWith("/") && source.path.split("/")
		.every(part => part && part !== "." && part !== ".."));
	return `sources/${source.revision}/${source.path}`;
};

/**
 * Require every selected local source to equal its immutable Git blob.
 *
 * @param revisions - Exact producer, checker and archiver commits.
 */
export const assertDirectProofErasureHostedLocalSources = async revisions => {
	for(const source of directProofErasureHostedSources(revisions))
		if(source.revision === revisions.checker
			|| source.revision === revisions.archiver)
			assert.deepEqual(await readFile(source.path)
				, directProofErasureHostedOriginal(
					source.revision, source.path), source.path);
	return true;
};
