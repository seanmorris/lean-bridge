/**
 * Closed hosted inputs and source closures for installed specialization signatures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, posix, resolve } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	inspectCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";

export const signatureSpecializationHostedProducer
	= "6e0d941e796db8813ee58bc8fda00e126e0a232c";
export const signatureSpecializationHostedRepairProducer
	= "50bd783fd9ec4a7a2d3eec4a807e788891d09446";
export const signatureSpecializationHostedPerlProducer
	= "60f6c69a5a9de9969715e0333d72d0a73588c876";
export const signatureSpecializationHostedEvidenceDirectory
	= "docs/evidence/signature-specializations-hosted-20261028";

const workflows = {
	languages: ".github/workflows/generic-subtype-languages.yml"
	, managed: ".github/workflows/generic-subtype-managed-wit.yml"
	, perl: ".github/workflows/generic-subtype-native-perl.yml"
	, browser: ".github/workflows/generic-subtype-npm-browser.yml"
	, phpWasm: ".github/workflows/nominal-subtype-php-wasm.yml"
};
const native = ({
	id, profiles, runId, workflow, jobName, artifactPrefix, outputRoot
	, producerCommit = signatureSpecializationHostedProducer
}) => Object.freeze({
	id, profiles: Object.freeze(profiles), runId, kind: "native"
	, workflow, jobName, artifactPrefix, producerCommit
	, reportPath: `${outputRoot}/reviewed-specializations.json`
	, tapPath: `${outputRoot}/reviewed-specializations.tap`
	, acceptanceStep: {
		python: "Execute installed Python acceptance"
		, ruby: "Execute installed Ruby acceptance"
		, rust: "Execute source-free Rust acceptance"
		, dotnet: "Execute installed .NET acceptance"
		, jvm: "Execute installed JVM acceptance"
		, "php-native": "Execute installed native PHP acceptance"
		, "wit-wasi": "Execute installed WIT acceptance"
		, perl: "Execute source-free CPAN acceptance"
	}[id]
	, uploadStep: {
		python: "Preserve complete and partial Python records"
		, ruby: "Preserve complete and partial Ruby records"
		, rust: "Preserve complete and partial Rust records"
		, dotnet: "Preserve complete and partial .NET records"
		, jvm: "Preserve complete and partial JVM records"
		, "php-native": "Preserve complete and partial PHP records"
		, "wit-wasi": "Preserve complete and partial WIT records"
		, perl: "Preserve complete and partial Perl records"
	}[id]
	, enforceStep: {
		python: "Enforce installed Python acceptance"
		, ruby: "Enforce installed Ruby acceptance"
		, rust: "Enforce installed Rust acceptance"
		, dotnet: "Enforce installed .NET acceptance"
		, jvm: "Enforce installed JVM acceptance"
		, "php-native": "Enforce installed native PHP acceptance"
		, "wit-wasi": "Enforce installed WIT acceptance"
		, perl: "Enforce installed Perl acceptance"
	}[id]
});

export const signatureSpecializationHostedLanes = Object.freeze([
	native({ id: "python", profiles: ["python"], runId: 40660579136
		, workflow: workflows.languages
		, jobName: "Ordinary and reviewed generic Subtypes on Python 3.11 and 3.12"
		, artifactPrefix: "generic-subtype-python"
		, outputRoot: "generic-subtype-python-ci" })
	, native({ id: "ruby", profiles: ["ruby"], runId: 40660579136
		, workflow: workflows.languages
		, jobName: "Ordinary and reviewed generic Subtypes on Ruby 3.3"
		, artifactPrefix: "generic-subtype-ruby"
		, outputRoot: "generic-subtype-ruby-ci" })
	, native({ id: "rust", profiles: ["rust"], runId: 40660579136
		, workflow: workflows.languages
		, jobName: "Ordinary and reviewed generic Subtypes on Rust 1.90"
		, artifactPrefix: "generic-subtype-rust"
		, outputRoot: "generic-subtype-rust-ci" })
	, native({ id: "dotnet", profiles: ["dotnet"], runId: 40660583267
		, workflow: workflows.managed, jobName: "Generic Subtypes in .NET"
		, artifactPrefix: "generic-subtype-dotnet"
		, outputRoot: "generic-subtype-dotnet-ci" })
	, native({ id: "jvm", profiles: ["java", "kotlin"]
		, runId: 40660583267, workflow: workflows.managed
		, jobName: "Generic Subtypes in Java and Kotlin"
		, artifactPrefix: "generic-subtype-jvm"
		, outputRoot: "generic-subtype-jvm-ci" })
	, native({ id: "php-native", profiles: ["php-native"]
		, runId: 40660583267, workflow: workflows.managed
		, jobName: "Generic Subtypes in native PHP"
		, artifactPrefix: "generic-subtype-php"
		, outputRoot: "generic-subtype-php-ci" })
	, native({ id: "wit-wasi", profiles: ["wit-wasi"]
		, runId: 40660583267, workflow: workflows.managed
		, jobName: "Generic Subtypes in WIT and WASI components"
		, artifactPrefix: "generic-subtype-wit"
		, outputRoot: "generic-subtype-wit-ci" })
	, native({ id: "perl", profiles: ["perl"], runId: 40674033403
		, workflow: workflows.perl
		, jobName: "Ordinary and reviewed generic Subtypes across four Perl ABIs"
		, artifactPrefix: "generic-subtype-perl"
		, outputRoot: "generic-subtype-perl-ci"
		, producerCommit: signatureSpecializationHostedPerlProducer })
	, Object.freeze({
		id: "browser"
		, profiles: Object.freeze([
			"browser-javascript"
			, "browser-react"
			, "browser-worker"
		])
		, runId: 40660590469, kind: "browser"
		, producerCommit: signatureSpecializationHostedProducer
		, workflow: workflows.browser
		, jobName: "reviewed generic Subtypes in Node and browsers"
		, artifactPrefix: "signature-specializations-browser"
		, reportPath: "browser.json", tapPath: null
		, acceptanceStep: "Exercise ordinary and reviewed finite specializations in every browser realm"
		, uploadStep: "Preserve finite-specialization browser observations"
		, enforceStep: "Enforce generic Subtype acceptance"
	})
	, Object.freeze({
		id: "php-wasm", profiles: Object.freeze(["php-wasm"])
		, runId: 40673140281, kind: "php-wasm"
		, producerCommit: signatureSpecializationHostedRepairProducer
		, workflow: workflows.phpWasm
		, jobName: "Four nominal Subtype selections in PHP-Wasm"
		, artifactPrefix: "nominal-subtype-php-wasm"
		, reportPath: "nominal-subtype-php-wasm-ci/signature-specializations.json"
		, tapPath: null
		, acceptanceStep: "Require ordinary, reviewed and both result-only installed packages"
		, uploadStep: "Preserve original and partial installed records"
		, enforceStep: "Enforce installed PHP-Wasm acceptance"
	})
]);

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

const producerEntries = Object.freeze([
	...Object.values(workflows)
	, "scripts/run-generic-subtype-python-ci.sh"
	, "scripts/run-generic-subtype-ruby-ci.sh"
	, "scripts/run-generic-subtype-rust-ci.sh"
	, "scripts/run-generic-subtype-dotnet-ci.sh"
	, "scripts/run-generic-subtype-jvm-ci.sh"
	, "scripts/run-generic-subtype-php-ci.sh"
	, "scripts/run-generic-subtype-wit-ci.sh"
	, "scripts/run-generic-subtype-perl-ci.sh"
	, "tests/reviewed-specializations.test.mjs"
	, ".github/actions/bounded-apt/action.yml"
	, "scripts/bootstrap-toolchains.sh", "scripts/bootstrap-rust-ci.sh"
	, "scripts/bootstrap-php-wasm-ci.sh"
	, "scripts/install-playwright-browsers.sh", "scripts/env.sh"
	, "lean-toolchain", "package.json", "package-lock.json"
	, "flake.lock", "flake.nix", "nix/wasm-toolchain.nix"
]);

/**
 * Parse the one canonical input root holding all ten lane captures.
 *
 * @param args - Command arguments following the script name.
 */
export const parseSignatureSpecializationHostedArchiveArgs = args => {
	const usage = "Usage: archive-signature-specialization-hosted.mjs --input-root /absolute/hosted-input";
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
 * @param root - Canonical hosted-input directory.
 * @param lane - Closed hosted lane.
 */
export const signatureSpecializationHostedInputs = (root, lane) => {
	assert.ok(signatureSpecializationHostedLanes.includes(lane));
	const prefix = `${root}/${lane.id}`;
	return {
		"artifact-zip": `${prefix}/artifact.zip`
		, "run-json": `${prefix}/run.json`
		, "job-json": `${prefix}/job.json`
		, "artifact-json": `${prefix}/artifact.json`
		, "job-log": `${prefix}/job.log`
	};
};

/**
 * Bind one artifact to its exact successful run, job and producer revision.
 *
 * @param selected - Exact ZIP, API and log inputs.
 * @param lane - Closed hosted lane.
 */
export const inspectSignatureSpecializationHostedArtifact = async (
	selected, lane
) => {
	assert.ok(signatureSpecializationHostedLanes.includes(lane));
	const hosted = await inspectCheckedRecordValueIndexHostedArtifact(selected, {
		workflow: lane.workflow, jobName: lane.jobName
		, artifactPrefix: lane.artifactPrefix
	});
	assert.equal(hosted.hostedRun.runId, lane.runId, lane.id);
	assert.equal(hosted.revision, lane.producerCommit, lane.id);
	return hosted;
};

/**
 * Require the successful acceptance and artifact steps and skipped enforcement.
 *
 * @param lane - Closed hosted lane.
 * @param jobBytes - Exact GitHub job API bytes.
 */
export const assertSignatureSpecializationHostedSteps = (lane, jobBytes) => {
	assert.ok(signatureSpecializationHostedLanes.includes(lane));
	const job = JSON.parse(jobBytes), named = name => {
		const matches = job.steps.filter(step => step.name === name);
		assert.equal(matches.length, 1, `${lane.id}:${name}`); return matches[0];
	};
	const acceptance = named(lane.acceptanceStep);
	const upload = named(lane.uploadStep), enforce = named(lane.enforceStep);
	assert.equal(acceptance.conclusion, "success");
	assert.equal(upload.conclusion, "success");
	assert.equal(enforce.conclusion, "skipped");
	assert.ok(upload.number > acceptance.number && enforce.number > upload.number);
	for(const step of job.steps)
		assert.ok(["success", "skipped"].includes(step.conclusion)
			, `${lane.id}:${step.name}:${step.conclusion}`);
};

/**
 * Select exact immutable source snapshots for all three evidence roles.
 *
 * @param revisions - Producer, checker and archiver Git identities.
 */
export const signatureSpecializationHostedSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort()
		, ["archiver", "checker", "producers"]);
	assert.ok(Array.isArray(revisions.producers)
		&& revisions.producers.length > 0);
	assert.deepEqual(revisions.producers
		, [...new Set(revisions.producers)].sort());
	for(const revision of [
		...revisions.producers, revisions.checker, revisions.archiver
	])
		assert.match(revision, /^[a-f0-9]{40}$/u);
	const producers = revisions.producers.map(revision => [
		revision
		, [
			...closure(revision, producerEntries)
			, ...tree(revision
				, "tests/fixtures/onboarding/native-specializations")
			, ...tree(revision
				, "tests/fixtures/specialization-consumers")
		]
	]);
	const roles = [
		...producers.map(([revision, paths]) => ["producer", revision, paths])
		, [
			"checker"
			, revisions.checker
			, closure(revisions.checker, [
				"tests/helpers/signature-specialization-hosted-evidence.mjs"
			])
		]
		, [
			"archiver"
			, revisions.archiver
			, closure(revisions.archiver, [
				"scripts/archive-signature-specialization-hosted.mjs"
			])
		]
	];
	return roles.flatMap(([role, revision, paths]) =>
		[...new Set(paths)].sort().map(path =>
			Object.freeze({ role, revision, path })));
};

/**
 * Return the collision-free retained path for one selected source.
 *
 * @param source - Selected source identity.
 */
export const signatureSpecializationHostedSourcePath = source => {
	assert.ok(source && typeof source === "object");
	assert.ok(["producer", "checker", "archiver"].includes(source.role));
	assert.match(source.revision, /^[a-f0-9]{40}$/u);
	return source.role === "producer"
		? `sources/producer/${source.revision}/${source.path}`
		: `sources/${source.role}/${source.path}`;
};

/**
 * Read one exact immutable Git object.
 *
 * @param revision - Exact Git revision.
 * @param path - Repository-relative path.
 */
export const signatureSpecializationHostedOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(typeof path === "string" && path.length > 0
		&& !path.startsWith("/") && !path.includes("\\")
		&& path.split("/").every(part => part && part !== "." && part !== ".."));
	return original(revision, path);
};

/**
 * Require current checker and archiver bytes to equal their sealed Git objects.
 *
 * @param revisions - Producer, checker and archiver Git identities.
 */
export const assertSignatureSpecializationHostedLocalSources = async (
	revisions
) => {
	for(const source of signatureSpecializationHostedSources(revisions)
		.filter(item => item.role !== "producer"))
		assert.deepEqual(await readFile(source.path)
			, signatureSpecializationHostedOriginal(source.revision, source.path)
			, `${source.role} differs from ${source.revision}: ${source.path}`);
};

/**
 * Hash a historical consumer fixture without checking it out.
 *
 * @param revision - Exact Git revision.
 * @param path - Repository-relative consumer path.
 */
export const signatureSpecializationHostedConsumerSha256 = (
	revision, path
) => sha256(signatureSpecializationHostedOriginal(revision, path));

/**
 * Hash the exact PHP-Wasm caller after its installed-package adapter removes
 * the Composer autoload line supplied separately by the copied runtime.
 *
 * @param revision - Exact producer revision.
 */
export const signatureSpecializationHostedPhpWasmConsumerSha256 = revision => {
	const source = signatureSpecializationHostedOriginal(revision
		, "tests/fixtures/specialization-consumers/php-wasm.php").toString();
	const consumer = source.replace("require 'vendor/autoload.php';", "");
	assert.notEqual(consumer, source);
	return sha256(consumer);
};
