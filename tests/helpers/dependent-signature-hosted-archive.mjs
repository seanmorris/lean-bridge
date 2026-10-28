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
import { moduleSpecifiers } from "./module-closure.mjs";

export const dependentSignatureHostedProducer
	= "8984bf53578ce36adde659c9ac6008bb893c59b2";
export const dependentSignatureConsumerRun = 40697329977;
export const dependentSignaturePerlRun = 40697334600;
export const dependentSignatureHostedRunConclusions = Object.freeze({
	[String(dependentSignatureConsumerRun)]: "failure"
	, [String(dependentSignaturePerlRun)]: "success"
});
export const dependentSignatureHostedEvidenceDirectory
	= "docs/evidence/dependent-signatures-hosted-20261028";

const consumerWorkflow = ".github/workflows/consumer-matrix.yml";
const perlWorkflow = ".github/workflows/perl-consumer.yml";
const native = ({
	id, profiles, jobName, artifactPrefix, reportStem, acceptanceStep, uploadStep
	, jobConclusion = "success"
}) => Object.freeze({
	id, profiles: Object.freeze(profiles), runId: dependentSignatureConsumerRun
	, workflow: consumerWorkflow, jobName, artifactPrefix
	, jobConclusion
	, kind: "managed"
	, reportPaths: Object.freeze([
		`managed-dependent-fin/${reportStem}.json`
		, `managed-dependent-fin/reviewed-${reportStem}.json`
	])
	, acceptanceStep, uploadStep
});
const perl = configuration => Object.freeze({
	id: `perl-${configuration}`, profiles: Object.freeze(["perl"])
	, runId: dependentSignaturePerlRun, workflow: perlWorkflow
	, jobName: `Perl XS (${configuration})`
	, artifactPrefix: `type-corpus-perl-${configuration}`
	, kind: "managed"
	, jobConclusion: "success"
	, reportPaths: Object.freeze([
		"managed-dependent-fin/perl.json"
		, "managed-dependent-fin/reviewed-perl.json"
	])
	, acceptanceStep: "Compare installed Perl corpus packages with fresh Lean results"
	, uploadStep: "Upload this configuration's real-Lean corpus report"
});

export const dependentSignatureHostedLanes = Object.freeze([
	Object.freeze({
		id: "javascript"
		, profiles: Object.freeze([
			"node-javascript", "node-typescript", "browser-javascript"
			, "browser-react", "browser-worker"
		])
		, runId: dependentSignatureConsumerRun, workflow: consumerWorkflow
		, jobName: "Node and browser npm consumers"
		, artifactPrefix: "dependent-fin-npm", kind: "javascript"
		, jobConclusion: "success"
		, reportPaths: Object.freeze(["ordinary-source.json", "reviewed-ir.json"])
		, acceptanceStep: "Check ordinary and reviewed dependent Fin in Node, TypeScript and browsers"
		, uploadStep: "Preserve ordinary and reviewed dependent Fin npm observations"
	})
	, native({
		id: "c-family", profiles: ["c", "cpp"]
		, jobName: "Native consumer (c-family)"
		, artifactPrefix: "type-corpus-c-family", reportStem: "c-cpp"
		, acceptanceStep: "Compare relocated C and C++ corpus consumers with fresh Lean"
		, uploadStep: "Upload installed C and C++ corpus observations"
		, jobConclusion: "failure"
	})
	, native({
		id: "python", profiles: ["python"], jobName: "Native consumer (python)"
		, artifactPrefix: "type-corpus-python", reportStem: "python"
		, acceptanceStep: "Compare installed Python corpus packages with fresh Lean results"
		, uploadStep: "Upload the real-Lean type corpus report"
		, jobConclusion: "failure"
	})
	, native({
		id: "rust", profiles: ["rust"], jobName: "Native consumer (rust)"
		, artifactPrefix: "type-corpus-rust", reportStem: "rust"
		, acceptanceStep: "Compare isolated Cargo corpus consumers with fresh Lean"
		, uploadStep: "Upload installed Rust corpus observations"
		, jobConclusion: "failure"
	})
	, native({
		id: "dotnet", profiles: ["dotnet"], jobName: "Managed consumer (dotnet)"
		, artifactPrefix: "type-corpus-dotnet", reportStem: "dotnet"
		, acceptanceStep: "Compare installed NuGet corpus packages with fresh Lean results"
		, uploadStep: "Upload the .NET real-Lean type corpus report"
	})
	, native({
		id: "jvm", profiles: ["java", "kotlin"], jobName: "Managed consumer (jvm)"
		, artifactPrefix: "type-corpus-jvm", reportStem: "java-kotlin"
		, acceptanceStep: "Compare isolated Java and Kotlin corpus consumers with fresh Lean"
		, uploadStep: "Upload installed Java and Kotlin corpus observations"
	})
	, native({
		id: "ruby", profiles: ["ruby"], jobName: "Managed consumer (ruby)"
		, artifactPrefix: "type-corpus-ruby", reportStem: "ruby"
		, acceptanceStep: "Compare installed Ruby corpus packages with fresh Lean results"
		, uploadStep: "Upload the Ruby real-Lean type corpus report"
	})
	, native({
		id: "php-native", profiles: ["php-native"], jobName: "Native PHP"
		, artifactPrefix: "type-corpus-php-native", reportStem: "php-native"
		, acceptanceStep: "Compare weak and strict installed Composer callers with fresh Lean"
		, uploadStep: "Upload installed PHP corpus observations"
	})
	, native({
		id: "php-wasm", profiles: ["php-wasm"]
		, jobName: "PHP-Wasm corpus (refinements)"
		, artifactPrefix: "type-corpus-php-wasm-refinements"
		, reportStem: "php-wasm"
		, acceptanceStep: "Compare installed PHP-Wasm refinements with the shared Lean corpus"
		, uploadStep: "Upload PHP-Wasm refinement corpus evidence"
	})
	, native({
		id: "wit-wasi", profiles: ["wit-wasi"]
		, jobName: "WIT and WASI Component Model"
		, artifactPrefix: "type-corpus-wit-wasi", reportStem: "wit-wasi"
		, acceptanceStep: "Compile ordinary Lean APIs and consume relocated WIT packages"
		, uploadStep: "Upload WIT shared corpus evidence"
	})
	, ...[
		"5.36.3-threaded", "5.36.3-unthreaded"
		, "5.38.2-threaded", "5.38.2-unthreaded"
	].map(perl)
]);

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
 * @param lane - Closed hosted lane.
 */
export const dependentSignatureHostedInputs = (root, lane) => {
	assert.ok(dependentSignatureHostedLanes.includes(lane));
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
 * Bind one downloaded artifact to the exact run, job and producer.
 *
 * @param selected - Exact ZIP, API and log paths.
 * @param lane - Closed hosted lane.
 */
export const inspectDependentSignatureHostedArtifact = async (
	selected, lane
) => {
	assert.ok(dependentSignatureHostedLanes.includes(lane));
	const runConclusion
		= dependentSignatureHostedRunConclusions[String(lane.runId)];
	assert.ok(["failure", "success"].includes(runConclusion));
	const hosted = await inspectCheckedRecordValueIndexHostedArtifact(selected, {
		workflow: lane.workflow, jobName: lane.jobName
		, artifactPrefix: lane.artifactPrefix
		, conclusions: { run: runConclusion, job: lane.jobConclusion }
	});
	assert.equal(hosted.hostedRun.runId, lane.runId, lane.id);
	assert.equal(hosted.revision, dependentSignatureHostedProducer, lane.id);
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
const producerEntries = Object.freeze([
	consumerWorkflow, perlWorkflow
	, "tests/dependent-fin-javascript.test.mjs"
	, "tests/managed-dependent-fin.test.mjs"
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
	const roles = [
		["producer", revisions.producer, [
			...closure(revisions.producer, producerEntries)
			, ...tree(revisions.producer
				, "tests/fixtures/onboarding/native-dependent-fin")
			, ...tree(revisions.producer
				, "tests/fixtures/dependent-fin-consumers")
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
