/**
 * Closed same-run hosted inputs and source closure for optional parameters.
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
	optionalParameterFocusedWorkflow, optionalParameterMatrixLanes
	, optionalParameterMatrixRoutes, validateOptionalParameterMatrixResults
} from "./optional-parameter-matrix.mjs";
import {
	validateOptionalParameterMatrixReceipt
} from "./optional-parameter-matrix-receipt.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";

export const optionalParameterHostedProducer
	= "496de9b6f22725da76e2fbe3aba9a2a1dd76ce06";
export const optionalParameterHostedRunId = 40891025339;
export const optionalParameterHostedWorkflow
	= ".github/workflows/dependent-checked-record-matrix.yml";
export const optionalParameterHostedEvidenceDirectory
	= "docs/evidence/optional-parameter-hosted-20261029";
export const optionalParameterHostedReceipt = Object.freeze({
	key: "matrix", artifactPrefix: "optional-parameter-matrix"
	, job: "Complete optional-parameter matrix / Reconcile the exact same-run receipt"
});

const contract = Object.freeze({
	npm: Object.freeze({
		job: "Complete optional-parameter matrix / Node and browser producer / reviewed generic Subtypes in Node and browsers"
		, acceptance: "Execute the complete optional-parameter Node and browser matrix"
		, upload: "Preserve optional-parameter Node and browser records"
		, enforce: "Enforce optional-parameter Node and browser acceptance"
	})
	, native: Object.freeze({
		job: "Complete optional-parameter matrix / Native and Perl producers / Ordinary and reviewed generic Subtypes in C and C++"
		, acceptance: "Execute optional parameters through prepared C and C++ packages"
		, upload: "Preserve optional-parameter C and C++ records"
		, enforce: "Enforce optional-parameter C and C++ acceptance"
	})
	, php: Object.freeze({
		job: "Complete optional-parameter matrix / PHP and PHP-Wasm producer / Four nominal Subtype selections in PHP-Wasm"
		, acceptance: "Execute optional parameters through native PHP and PHP-Wasm packages"
		, upload: "Preserve optional-parameter PHP records"
		, enforce: "Enforce optional-parameter PHP acceptance"
	})
	, "language-perl": Object.freeze({
		job: "Complete optional-parameter matrix / Native and Perl producers / Ordinary and reviewed generic Subtypes across four Perl ABIs"
		, acceptance: "Execute optional parameters through the prepared Perl package"
		, upload: "Preserve optional-parameter Perl records"
		, enforce: "Enforce optional-parameter Perl acceptance"
	})
	, "language-python": Object.freeze({
		job: "Complete optional-parameter matrix / Python, Ruby and Rust producers / Ordinary and reviewed generic Subtypes on Python 3.11 and 3.12"
		, acceptance: "Execute optional parameters through the prepared Python package"
		, upload: "Preserve optional-parameter Python records"
		, enforce: "Enforce optional-parameter Python acceptance"
	})
	, "language-ruby": Object.freeze({
		job: "Complete optional-parameter matrix / Python, Ruby and Rust producers / Ordinary and reviewed generic Subtypes on Ruby 3.3"
		, acceptance: "Execute optional parameters through the prepared Ruby package"
		, upload: "Preserve optional-parameter Ruby records"
		, enforce: "Enforce optional-parameter Ruby acceptance"
	})
	, "language-rust": Object.freeze({
		job: "Complete optional-parameter matrix / Python, Ruby and Rust producers / Ordinary and reviewed generic Subtypes on Rust 1.90"
		, acceptance: "Execute optional parameters through the prepared Rust package"
		, upload: "Preserve optional-parameter Rust records"
		, enforce: "Enforce optional-parameter Rust acceptance"
	})
	, "managed-dotnet": Object.freeze({
		job: "Complete optional-parameter matrix / Managed and WIT producers / Generic Subtypes in .NET"
		, acceptance: "Execute optional parameters through the prepared .NET package"
		, upload: "Preserve optional-parameter .NET records"
		, enforce: "Enforce optional-parameter .NET acceptance"
	})
	, "managed-jvm": Object.freeze({
		job: "Complete optional-parameter matrix / Managed and WIT producers / Generic Subtypes in Java and Kotlin"
		, acceptance: "Execute optional parameters through prepared Java and Kotlin packages"
		, upload: "Preserve optional-parameter JVM records"
		, enforce: "Enforce optional-parameter JVM acceptance"
	})
	, wit: Object.freeze({
		job: "Complete optional-parameter matrix / Managed and WIT producers / Generic Subtypes in WIT and WASI components"
		, acceptance: "Execute optional parameters through the prepared WIT package"
		, upload: "Preserve optional-parameter WIT records"
		, enforce: "Enforce optional-parameter WIT acceptance"
	})
});

export const optionalParameterHostedLanes = Object.freeze(
	optionalParameterMatrixLanes.map(lane => Object.freeze({
		...lane, ...contract[lane.key], runId: optionalParameterHostedRunId
		, producerCommit: optionalParameterHostedProducer
		, workflow: optionalParameterHostedWorkflow
	}))
);

/**
 * Parse the sole canonical hosted-input root.
 *
 * @param args - Command arguments following the script name.
 */
export const parseOptionalParameterHostedArchiveArgs = args => {
	const usage = "Usage: archive-optional-parameter-hosted.mjs --input-root /absolute/hosted-input";
	assert.deepEqual(Array.isArray(args) ? args.length : null, 2, usage);
	assert.equal(args[0], "--input-root", usage);
	assert.ok(typeof args[1] === "string" && args[1].length > 0
		&& !/[\0\r\n]/u.test(args[1]) && isAbsolute(args[1])
		&& resolve(args[1]) === args[1], usage);
	return args[1];
};

/**
 * Select the original GitHub inputs for one lane or the aggregate receipt.
 *
 * @param root - Canonical hosted-input root.
 * @param selected - One closed lane or aggregate receipt descriptor.
 */
export const optionalParameterHostedInputs = (root, selected) => {
	assert.ok(optionalParameterHostedLanes.includes(selected)
		|| selected === optionalParameterHostedReceipt);
	const prefix = `${root}/${selected.key}`;
	return {
		"artifact-zip": `${prefix}/artifact.zip`
		, "run-json": `${prefix}/run.json`
		, "job-json": `${prefix}/job.json`
		, "artifact-json": `${prefix}/artifact.json`
		, "job-log": `${prefix}/job.log`
	};
};

/**
 * Bind one lane artifact to the exact successful run, job and revision.
 *
 * @param selected - Exact ZIP, API and log paths.
 * @param lane - Closed optional-parameter lane.
 */
export const inspectOptionalParameterHostedArtifact = async (
	selected, lane
) => {
	assert.ok(optionalParameterHostedLanes.includes(lane));
	const hosted = await inspectCheckedRecordValueIndexHostedArtifact(
		selected, {
			workflow: lane.workflow, jobName: lane.job
			, artifactPrefix: lane.artifactPrefix
			, conclusions: { run: "success", job: "success" }
		}
	);
	assert.equal(hosted.hostedRun.runId, lane.runId, lane.key);
	assert.equal(hosted.revision, lane.producerCommit, lane.key);
	return hosted;
};

/**
 * Bind the aggregate receipt artifact to the same successful run.
 *
 * @param selected - Exact aggregate ZIP, API and log paths.
 */
export const inspectOptionalParameterHostedReceipt = async selected => {
	const hosted = await inspectCheckedRecordValueIndexHostedArtifact(
		selected, {
			workflow: optionalParameterHostedWorkflow
			, jobName: optionalParameterHostedReceipt.job
			, artifactPrefix: optionalParameterHostedReceipt.artifactPrefix
			, conclusions: { run: "success", job: "success" }
		}
	);
	assert.equal(hosted.hostedRun.runId, optionalParameterHostedRunId);
	assert.equal(hosted.revision, optionalParameterHostedProducer);
	return hosted;
};

/**
 * Require the successful acceptance/upload pair and skipped failure guard.
 *
 * @param lane - Closed optional-parameter lane.
 * @param jobBytes - Exact GitHub job API bytes.
 */
export const assertOptionalParameterHostedSteps = (lane, jobBytes) => {
	assert.ok(optionalParameterHostedLanes.includes(lane));
	const job = JSON.parse(jobBytes), named = name => {
		const matches = job.steps.filter(step => step.name === name);
		assert.equal(matches.length, 1, `${lane.key}:${name}`);
		return matches[0];
	};
	const acceptance = named(lane.acceptance), upload = named(lane.upload);
	assert.equal(acceptance.conclusion, "success", lane.key);
	assert.equal(upload.conclusion, "success", lane.key);
	assert.ok(upload.number > acceptance.number, lane.key);
	assert.equal(named(lane.enforce).conclusion, "skipped", lane.key);
	return true;
};

const checker = Object.freeze({
	npm: "scripts/check-optional-parameter-npm-ci.mjs"
	, native: "scripts/check-optional-parameter-native-ci.mjs"
	, php: "scripts/check-optional-parameter-php-ci.mjs"
	, language: "scripts/check-optional-parameter-language-ci.mjs"
	, managed: "scripts/check-optional-parameter-managed-ci.mjs"
	, wit: "scripts/check-optional-parameter-wit-ci.mjs"
});

/**
 * Independently replay one extracted ordinary or reviewed route.
 *
 * @param lane - Closed optional-parameter lane.
 * @param route - Ordinary or independently reviewed route.
 * @param extractedRoot - Path-safe extracted artifact root.
 */
export const replayOptionalParameterHostedRoute = (
	lane, route, extractedRoot
) => {
	assert.ok(optionalParameterHostedLanes.includes(lane));
	assert.ok(optionalParameterMatrixRoutes.some(item =>
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

/**
 * Authenticate the aggregate receipt against independently replayed results.
 *
 * @param receipt - Same-run aggregate receipt.
 * @param results - Independently replayed normalized results.
 */
export const validateOptionalParameterHostedReceipt = (
	receipt, results
) => {
	validateOptionalParameterMatrixReceipt(receipt);
	assert.equal(receipt.run.repository, "seanmorris/lean-bridge");
	assert.equal(receipt.run.workflow, optionalParameterFocusedWorkflow);
	assert.equal(receipt.run.runId, optionalParameterHostedRunId);
	assert.equal(receipt.run.producerCommit, optionalParameterHostedProducer);
	const normalized = results.map(item => item.result);
	assert.deepEqual(receipt.records.map(item => item.result), normalized);
	assert.deepEqual(validateOptionalParameterMatrixResults(
		normalized, optionalParameterHostedProducer), receipt.matrix);
	return receipt;
};

const sourceCache = new Map();
/**
 * Read one immutable source blob.
 *
 * @param revision - Exact source revision.
 * @param path - Repository-relative source path.
 */
export const optionalParameterHostedOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(typeof path === "string" && path.length > 0
		&& !path.startsWith("/") && !path.includes("\\")
		&& path.split("/").every(part => part && part !== "." && part !== ".."));
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
		const bytes = optionalParameterHostedOriginal(revision, path);
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
	optionalParameterHostedWorkflow, optionalParameterFocusedWorkflow
	, ".github/workflows/generic-subtype-npm-browser.yml"
	, ".github/workflows/generic-subtype-native-perl.yml"
	, ".github/workflows/generic-subtype-languages.yml"
	, ".github/workflows/generic-subtype-managed-wit.yml"
	, ".github/workflows/nominal-subtype-php-wasm.yml"
	, "scripts/reconcile-optional-parameter-matrix.mjs"
	, ...Object.values(checker)
	, ...["npm", "native", "php", "language", "managed", "wit"]
		.map(name => `scripts/run-optional-parameter-${name}-ci.sh`)
	, "tests/optional-parameter-npm-installed.test.mjs"
	, "tests/optional-parameter-native-installed.test.mjs"
	, "tests/optional-parameter-php-installed.test.mjs"
	, "tests/optional-parameter-language-installed.test.mjs"
	, "tests/optional-parameter-managed-installed.test.mjs"
	, "tests/optional-parameter-wit-installed.test.mjs"
	, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
	, "lean-toolchain", "package.json", "package-lock.json"
]);

/**
 * Select exact producer, checker and archiver source identities.
 *
 * @param revisions - Exact producer, checker and archiver revisions.
 */
export const optionalParameterHostedSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort()
		, ["archiver", "checker", "producer"]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.equal(revisions.producer, optionalParameterHostedProducer);
	const roles = [
		["producer", revisions.producer, [
			...closure(revisions.producer, producerEntries)
			, ...tree(revisions.producer
				, "tests/fixtures/onboarding/optional-parameters")
			, ...tree(revisions.producer
				, "tests/fixtures/optional-parameter-consumers")
		]]
		, [
			"checker"
			, revisions.checker
			, closure(revisions.checker, [
				"tests/helpers/optional-parameter-hosted-evidence.mjs"
			])
		]
		, [
			"archiver"
			, revisions.archiver
			, closure(revisions.archiver, [
				"scripts/archive-optional-parameter-hosted.mjs"
				, "scripts/download-optional-parameter-hosted-inputs.mjs"
			])
		]
	];
	return roles.flatMap(([role, revision, paths]) =>
		[...new Set(paths)].sort().map(path =>
			Object.freeze({ role, revision, path })));
};

/**
 * Return a collision-free retained source path.
 *
 * @param source - Selected immutable source identity.
 */
export const optionalParameterHostedSourcePath = source => {
	assert.ok(source && ["producer", "checker", "archiver"]
		.includes(source.role));
	return `sources/${source.role}/${source.path}`;
};

/**
 * Require current checker/archiver bytes to equal their Git identities.
 *
 * @param revisions - Exact producer, checker and archiver revisions.
 */
export const assertOptionalParameterHostedLocalSources = async revisions => {
	for(const source of optionalParameterHostedSources(revisions)
		.filter(item => item.role !== "producer"))
		assert.deepEqual(await readFile(source.path)
			, optionalParameterHostedOriginal(source.revision, source.path)
			, `${source.role} differs from ${source.revision}: ${source.path}`);
};
