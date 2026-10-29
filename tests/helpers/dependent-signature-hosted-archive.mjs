/**
 * Closed hosted inputs and immutable source closure for dependent signatures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, posix, resolve } from "node:path";
import {
	inspectCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
import {
	dependentSignatureFocusedWorkflow, dependentSignatureMatrixLanes
	, dependentSignatureMatrixRoutes
	, validateDependentSignatureMatrixReceipt
} from "./dependent-signature-matrix-receipt.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";

export const dependentSignatureHostedProducer
	= "7f206cdbf35d650c48917572e6344fdc0194aeb7";
export const dependentSignatureHostedRunId = 40927405318;
export const dependentSignatureHostedRunConclusions = Object.freeze({
	[String(dependentSignatureHostedRunId)]: "success"
});
export const dependentSignatureHostedEvidenceDirectory
	= "docs/evidence/dependent-signatures-hosted-20261028";
export const dependentSignatureHostedReceipt = Object.freeze({
	id: "matrix", artifactPrefix: "dependent-signature-matrix"
	, jobName: "Reconcile the exact same-run receipt"
});

const contracts = Object.freeze({
	javascript: Object.freeze({
		jobName: "JavaScript and browser producer / Four dependent-record routes in Node and three browsers"
		, acceptanceStep: "Run all dependent checked-record author routes"
		, uploadStep: "Preserve original and partial installed records"
		, enforceStep: "Enforce dependent checked-record acceptance"
	})
	, "c-family": Object.freeze({
		jobName: "C and C++ producer / Four dependent-record routes in C11/GMP and C++20/Boost"
		, acceptanceStep: "Require every dependent-record author route in C and C++"
		, uploadStep: "Preserve complete and partial installed records"
		, enforceStep: "Enforce dependent checked-record native acceptance"
	})
	, perl: Object.freeze({
		jobName: "Perl producer / Four ABI dependent checked-record CPAN matrix"
		, acceptanceStep: "Require every source route and API mode across each Perl ABI"
		, uploadStep: "Preserve original and partial installed records"
		, enforceStep: "Enforce installed dependent checked-record Perl acceptance"
	})
	, python: Object.freeze({
		jobName: "Python producer / Four dependent checked-record selections on both Python floors"
		, acceptanceStep: "Require every source route and API mode on both Python floors"
		, uploadStep: "Preserve original and partial installed records"
		, enforceStep: "Enforce installed dependent checked-record Python acceptance"
	})
	, rust: Object.freeze({
		jobName: "Rust producer / Four dependent checked-record selections in Rust"
		, acceptanceStep: "Require all four author and API routes in Rust"
		, uploadStep: "Preserve original and partial installed records"
		, enforceStep: "Enforce installed dependent checked-record Rust acceptance"
	})
	, dotnet: Object.freeze({
		jobName: ".NET producer / Four dependent checked-record checked-record routes in .NET"
		, acceptanceStep: "Require every source and API route"
		, uploadStep: "Preserve original and partial installed records"
		, enforceStep: "Enforce installed dependent checked-record .NET acceptance"
	})
	, jvm: Object.freeze({
		jobName: "Java and Kotlin producer / Four dependent checked-record routes in Java and Kotlin"
		, acceptanceStep: "Require every source and API route in Java and Kotlin"
		, uploadStep: "Preserve original and partial installed records"
		, enforceStep: "Enforce installed dependent checked-record Java and Kotlin acceptance"
	})
	, ruby: Object.freeze({
		jobName: "Ruby producer / Four dependent checked-record selections in Ruby"
		, acceptanceStep: "Require every source route and API mode in Ruby"
		, uploadStep: "Preserve original and partial installed records"
		, enforceStep: "Enforce installed dependent checked-record Ruby acceptance"
	})
	, "php-native": Object.freeze({
		jobName: "Native PHP producer / Four dependent checked-record checked-record routes in native PHP"
		, acceptanceStep: "Require every source route and API mode in native PHP"
		, uploadStep: "Preserve original and partial installed records"
		, enforceStep: "Enforce installed dependent checked-record native PHP acceptance"
	})
	, "php-wasm": Object.freeze({
		jobName: "PHP-Wasm producer / Four dependent checked-record routes in PHP-Wasm"
		, acceptanceStep: "Require ordinary, reviewed, and both result-only installed packages"
		, uploadStep: "Preserve original and partial installed records"
		, enforceStep: "Enforce installed dependent PHP-Wasm acceptance"
	})
	, "wit-wasi": Object.freeze({
		jobName: "WIT and WASI producer / Four dependent checked-record checked-record routes through Wasmtime"
		, acceptanceStep: "Require both source routes and API modes through Wasmtime"
		, uploadStep: "Preserve original and partial installed records"
		, enforceStep: "Enforce installed dependent checked-record checked-record WIT acceptance"
	})
});

export const dependentSignatureHostedLanes = Object.freeze(
	dependentSignatureMatrixLanes.map(lane => Object.freeze({
		...lane
		, id: lane.key, matrixLane: lane
		, ...contracts[lane.key]
		, runId: dependentSignatureHostedRunId
		, workflow: dependentSignatureFocusedWorkflow
		, artifactPrefix: `dependent-checked-record-${lane.workflowStem}`
	}))
);

/**
 * Parse the sole canonical hosted-input root.
 *
 * @param args - Command arguments following the script name.
 */
export const parseDependentSignatureHostedArchiveArgs = args => {
	const usage = "Usage: archive-dependent-signature-hosted.mjs --input-root /absolute/hosted-input";
	assert.deepEqual(Array.isArray(args) ? args.length : null, 2, usage);
	assert.equal(args[0], "--input-root", usage);
	assert.ok(typeof args[1] === "string" && args[1].length > 0
		&& !/[\0\r\n]/u.test(args[1]) && isAbsolute(args[1])
		&& resolve(args[1]) === args[1], usage);
	return args[1];
};

/**
 * Select the five original hosted inputs for one lane.
 *
 * @param root - Canonical input root.
 * @param selected - Closed hosted lane or aggregate receipt.
 */
export const dependentSignatureHostedInputs = (root, selected) => {
	assert.ok(dependentSignatureHostedLanes.includes(selected)
		|| selected === dependentSignatureHostedReceipt);
	const prefix = `${root}/${selected.id}`;
	return {
		"artifact-zip": `${prefix}/artifact.zip`
		, "run-json": `${prefix}/run.json`
		, "job-json": `${prefix}/job.json`
		, "artifact-json": `${prefix}/artifact.json`
		, "job-log": `${prefix}/job.log`
	};
};

/**
 * Bind one downloaded artifact to the exact run, job and producer.
 *
 * @param selected - Exact ZIP, API and log paths.
 * @param lane - Closed hosted lane.
 */
export const inspectDependentSignatureHostedArtifact = async (
	selected, lane
) => {
	assert.ok(dependentSignatureHostedLanes.includes(lane));
	const hosted = await inspectCheckedRecordValueIndexHostedArtifact(selected, {
		workflow: lane.workflow, jobName: lane.jobName
		, artifactPrefix: lane.artifactPrefix
		, conclusions: { run: "success", job: "success" }
	});
	assert.equal(hosted.hostedRun.runId, lane.runId, lane.id);
	assert.equal(hosted.revision, dependentSignatureHostedProducer, lane.id);
	return hosted;
};

/**
 * Bind the aggregate same-run receipt artifact to its successful job.
 *
 * @param selected - Exact ZIP, API and log paths.
 */
export const inspectDependentSignatureHostedReceipt = async selected => {
	const hosted = await inspectCheckedRecordValueIndexHostedArtifact(selected, {
		workflow: dependentSignatureFocusedWorkflow
		, jobName: dependentSignatureHostedReceipt.jobName
		, artifactPrefix: dependentSignatureHostedReceipt.artifactPrefix
		, conclusions: { run: "success", job: "success" }
	});
	assert.equal(hosted.hostedRun.runId, dependentSignatureHostedRunId);
	assert.equal(hosted.revision, dependentSignatureHostedProducer);
	return hosted;
};

/**
 * Require the exact successful acceptance and upload steps.
 *
 * @param lane - Closed hosted lane.
 * @param jobBytes - Exact GitHub job API bytes.
 */
export const assertDependentSignatureHostedSteps = (lane, jobBytes) => {
	assert.ok(dependentSignatureHostedLanes.includes(lane));
	const job = JSON.parse(jobBytes), named = name => {
		const matches = job.steps.filter(step => step.name === name);
		assert.equal(matches.length, 1, `${lane.id}:${name}`); return matches[0];
	};
	const acceptance = named(lane.acceptanceStep), upload = named(lane.uploadStep);
	assert.equal(acceptance.conclusion, "success", lane.id);
	assert.equal(upload.conclusion, "success", lane.id);
	assert.ok(upload.number > acceptance.number, lane.id);
	assert.equal(named(lane.enforceStep).conclusion, "skipped", lane.id);
	return true;
};

/**
 * Require the exact receipt download, reconciliation and preservation path.
 *
 * @param jobBytes - Exact GitHub job API bytes.
 */
export const assertDependentSignatureHostedReceiptSteps = jobBytes => {
	const job = JSON.parse(jobBytes), named = name => {
		const matches = job.steps.filter(step => step.name === name);
		assert.equal(matches.length, 1, `receipt:${name}`); return matches[0];
	};
	const download = named("Download every same-run dependent-signature artifact");
	const reconciliation = named("Reconcile every profile, author route, and API mode");
	const upload = named("Preserve the complete dependent-signature receipt");
	assert.equal(download.conclusion, "success");
	assert.equal(reconciliation.conclusion, "success");
	assert.equal(upload.conclusion, "success");
	assert.ok(reconciliation.number > download.number);
	assert.ok(upload.number > reconciliation.number);
	assert.equal(named(
		"Enforce every producer and exact receipt reconciliation"
	).conclusion, "skipped");
	return true;
};

/**
 * Validate the aggregate receipt against all retained canonical summaries.
 *
 * @param receipt - Same-run aggregate receipt.
 */
export const validateDependentSignatureHostedReceipt = receipt => {
	validateDependentSignatureMatrixReceipt(receipt);
	assert.equal(receipt.run.repository, "seanmorris/lean-bridge");
	assert.equal(receipt.run.workflow, dependentSignatureFocusedWorkflow);
	assert.equal(receipt.run.runId, dependentSignatureHostedRunId);
	assert.equal(receipt.run.producerCommit, dependentSignatureHostedProducer);
	assert.equal(receipt.records.length
		, dependentSignatureHostedLanes.length
			* dependentSignatureMatrixRoutes.length);
	return receipt;
};

const sourceCache = new Map();
const original = (revision, path) => {
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
		const bytes = original(revision, path); paths.add(path);
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
const producerStems = Object.freeze(
	dependentSignatureMatrixLanes.map(lane => lane.workflowStem));
const producerEntries = Object.freeze([
	dependentSignatureFocusedWorkflow
	, ...producerStems.map(stem =>
		`.github/workflows/dependent-checked-record-${stem}.yml`)
	, "scripts/reconcile-dependent-signature-matrix.mjs"
	, ...producerStems.map(stem =>
		`scripts/run-dependent-checked-record-${stem}-ci.sh`)
	, ...producerStems.map(stem =>
		`scripts/check-dependent-checked-record-${stem}-ci.mjs`)
	, "scripts/check-dependent-checked-record-php-wasm-compiler-ci.mjs"
	, "scripts/select-nominal-subtype-php-ci-tools.mjs"
	, "scripts/select-nominal-subtype-wit-ci-tools.mjs"
	, "tests/helpers/dependent-checked-record-browser-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-native-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-perl-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-python-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-rust-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-dotnet-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-jvm-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-ruby-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-php-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-php-wasm-lean-tests.mjs"
	, "tests/helpers/dependent-checked-record-php-wasm-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-wit-installed-tests.mjs"
	, ".github/actions/bounded-apt/action.yml", "scripts/env.sh"
	, "scripts/bootstrap-toolchains.sh", "scripts/bootstrap-rust-ci.sh"
	, "scripts/bootstrap-php-wasm-ci.sh"
	, "scripts/install-playwright-browsers.sh"
	, "lean-toolchain", "package.json", "package-lock.json"
	, "flake.lock", "flake.nix", "nix/wasm-toolchain.nix"
]);

/**
 * Select exact producer, checker and archiver source identities.
 *
 * @param revisions - Immutable source revisions by role.
 */
export const dependentSignatureHostedSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.equal(revisions.producer, dependentSignatureHostedProducer);
	const roles = [
		["producer", revisions.producer, [
			...closure(revisions.producer, producerEntries)
			, ...tree(revisions.producer
				, "tests/fixtures/onboarding/dependent-checked-records")
			, ...tree(revisions.producer
				, "tests/fixtures/dependent-checked-record-browser")
			, ...tree(revisions.producer
				, "tests/fixtures/dependent-checked-record-consumers")
		]]
		, [
			"checker"
			, revisions.checker
			, closure(revisions.checker, [
				"tests/helpers/dependent-signature-hosted-evidence.mjs"
			])
		]
		, [
			"archiver"
			, revisions.archiver
			, closure(revisions.archiver, [
				"scripts/archive-dependent-signature-hosted.mjs"
				, "scripts/download-dependent-signature-hosted-inputs.mjs"
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
 * @param source - Selected source identity.
 */
export const dependentSignatureHostedSourcePath = source => {
	assert.ok(source && ["producer", "checker", "archiver"]
		.includes(source.role));
	return `sources/${source.role}/${source.path}`;
};

/**
 * Read one immutable Git object.
 *
 * @param revision - Exact Git revision.
 * @param path - Repository-relative path.
 */
export const dependentSignatureHostedOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(typeof path === "string" && path.length > 0
		&& !path.startsWith("/") && !path.includes("\\")
		&& path.split("/").every(part => part && part !== "." && part !== ".."));
	return original(revision, path);
};

/**
 * Require current checker/archiver bytes to equal their Git identities.
 *
 * @param revisions - Immutable source revisions by role.
 */
export const assertDependentSignatureHostedLocalSources = async revisions => {
	for(const source of dependentSignatureHostedSources(revisions)
		.filter(item => item.role !== "producer"))
		assert.deepEqual(await readFile(source.path)
			, dependentSignatureHostedOriginal(source.revision, source.path)
			, `${source.role} differs from ${source.revision}: ${source.path}`);
};
