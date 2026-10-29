/**
 * Closed same-run inputs for the complete installed HostNull matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, posix, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	verifyComponentPackageReceipt
} from "../../src/release/component-package-receipt.mjs";
import {
	verifyPackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";
import {
	inspectCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
import {
	checkHostNullJavaScriptHostedReport
} from "./host-null-javascript-hosted-report.mjs";
import { assertHostNullPhpReport } from "./host-null-php-report.mjs";
import { hostNullPhpHostedPolicy } from "./host-null-php-hosted-policy.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";

export const hostNullCompleteWorkflow
	= ".github/workflows/consumer-matrix.yml";
export const hostNullCompleteRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const hostNullCompletePositions = Object.freeze([
	"parameter", "result", "field", "callback-parameter", "callback-result"
]);

const lane = (id, profiles, jobName, artifactPrefix) => Object.freeze({
	id, profiles: Object.freeze(profiles), workflow: hostNullCompleteWorkflow
	, jobName, artifactPrefix
});

export const hostNullCompleteHostedLanes = Object.freeze([
	lane("javascript-browser", [
		"node-javascript", "node-typescript", "browser-javascript"
		, "browser-react", "browser-worker"
	], "Node and browser npm consumers", "host-null-node-browser")
	, lane("php-native", ["php-native"], "Native PHP", "host-null-php-native")
	, lane("php-wasm", ["php-wasm"], "PHP-Wasm corpus (values-graph)"
		, "host-null-php-wasm")
	, lane("dotnet", ["dotnet"], "Managed consumer (dotnet)"
		, "host-null-managed-dotnet")
	, lane("jvm", ["java", "kotlin"], "Managed consumer (jvm)"
		, "host-null-managed-jvm")
	, lane("scripting", ["perl", "python", "ruby"]
		, "Perl / Perl XS (5.38.2-threaded)", "host-null-scripting")
	, lane("systems", ["c", "cpp", "rust", "wit-wasi"]
		, "Systems HostNull acceptance", "host-null-systems")
]);

export const hostNullCompleteProfiles = Object.freeze(
	hostNullCompleteHostedLanes.flatMap(item => item.profiles)
);
const completeCells = [];
for(const route of hostNullCompleteRoutes)
	for(const profile of hostNullCompleteProfiles)
		for(const position of hostNullCompletePositions)
			completeCells.push(Object.freeze({ route, profile, position }));
export const hostNullCompleteCells = Object.freeze(completeCells);

/**
 * Parse the sole canonical hosted-input root.
 *
 * @param args - Command arguments following the script name.
 */
export const parseHostNullCompleteHostedArchiveArgs = args => {
	const usage = "Usage: archive-host-null-complete-evidence.mjs --input-root /absolute/hosted-input";
	assert.deepEqual(Array.isArray(args) ? args.length : null, 2, usage);
	assert.equal(args[0], "--input-root", usage);
	assert.ok(typeof args[1] === "string" && args[1].length > 0
		&& !/[\0\r\n]/u.test(args[1]) && isAbsolute(args[1])
		&& resolve(args[1]) === args[1], usage);
	return args[1];
};

/**
 * Select the four original GitHub inputs for one lane.
 *
 * @param root - Canonical hosted-input directory.
 * @param selectedLane - One closed HostNull artifact lane.
 */
export const hostNullCompleteHostedInputs = (root, selectedLane) => {
	assert.ok(hostNullCompleteHostedLanes.includes(selectedLane));
	const prefix = `${root}/${selectedLane.id}`;
	return {
		"artifact-zip": `${prefix}/artifact.zip`
		, "run-json": `${prefix}/run.json`
		, "job-json": `${prefix}/job.json`
		, "artifact-json": `${prefix}/artifact.json`
	};
};

/**
 * Bind all seven artifacts to one exact run and revision before any byte can
 * enter the aggregate evidence archive.
 *
 * @param root - Canonical hosted-input directory.
 * @param expectedProducer - Optional exact producer revision.
 */
export const inspectHostNullCompleteHostedArtifacts = async (
	root, expectedProducer = null
) => {
	assert.ok(typeof root === "string" && isAbsolute(root)
		&& resolve(root) === root);
	if(expectedProducer !== null)
		assert.match(expectedProducer, /^[a-f0-9]{40}$/u);
	const captures = [];
	for(const selectedLane of hostNullCompleteHostedLanes)
	{
		const selected = hostNullCompleteHostedInputs(root, selectedLane);
		const run = JSON.parse(await readFile(selected["run-json"]));
		assert.ok(["failure", "success"].includes(run.conclusion));
		const hosted = await inspectCheckedRecordValueIndexHostedArtifact(
			selected, {
				workflow: selectedLane.workflow, jobName: selectedLane.jobName
				, artifactPrefix: selectedLane.artifactPrefix
				, conclusions: { run: run.conclusion, job: "success" }
			}
		);
		captures.push(Object.freeze({
			lane: selectedLane.id, profiles: selectedLane.profiles
			, revision: hosted.revision, hostedRun: hosted.hostedRun
		}));
	}
	assert.equal(new Set(captures.map(item => item.revision)).size, 1
		, "Every HostNull artifact must use one producer revision");
	assert.equal(new Set(captures.map(item => item.hostedRun.runId)).size, 1
		, "Every HostNull artifact must come from one workflow run");
	assert.equal(new Set(captures.map(item => item.hostedRun.job.id)).size
		, captures.length, "HostNull lane jobs must be distinct");
	assert.equal(new Set(captures.map(item => item.hostedRun.artifact.id)).size
		, captures.length, "HostNull lane artifacts must be distinct");
	const producerCommit = captures[0].revision;
	if(expectedProducer !== null) assert.equal(producerCommit, expectedProducer);
	assert.equal(hostNullCompleteProfiles.length, 17);
	assert.equal(new Set(hostNullCompleteProfiles).size, 17);
	assert.equal(hostNullCompleteCells.length, 170);
	assert.equal(new Set(hostNullCompleteCells.map(cell =>
		`${cell.route}:${cell.profile}:${cell.position}`)).size, 170);
	return Object.freeze({
		schemaVersion: 1, producerCommit
		, runId: captures[0].hostedRun.runId
		, captures: Object.freeze(captures), cells: hostNullCompleteCells
	});
};

const repository = resolve(import.meta.dirname, "../..");
const normalizedRoute = value => {
	assert.ok(["ordinary", "ordinary-source", "reviewed", "reviewed-ir"]
		.includes(value), value);
	return value.startsWith("ordinary") ? "ordinary" : "reviewed";
};
const canonicalFile = async (root, path) => {
	assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
	assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
	const bytes = await readFile(join(root, path));
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path);
	return { bytes, value };
};
const packageSetRoute = async (root, route, sourceRoute, receiptPath) => {
	const receipt = await canonicalFile(root, receiptPath);
	await verifyPackageSetReceipt({ receiptPath: join(root, receiptPath) });
	return Object.freeze({
		route: normalizedRoute(route), sourceRoute, receiptPath
		, receiptSha256: sha256(receipt.bytes)
		, packages: Object.freeze(receipt.value.packages)
	});
};
const checker = (script, args) => {
	const output = execFileSync(process.execPath, [
		join(repository, "scripts", script), ...args
	], {
		cwd: repository, encoding: "utf8", maxBuffer: 16 * 1024 ** 2
	});
	const value = JSON.parse(output);
	assert.equal(output, canonicalJson(value), script);
	return value;
};
const laneCells = (selectedLane, routes) => {
	assert.deepEqual(routes.map(item => item.route), hostNullCompleteRoutes);
	const cells = [];
	for(const route of routes)
		for(const profile of selectedLane.profiles)
			for(const position of hostNullCompletePositions)
				cells.push(Object.freeze({
					lane: selectedLane.id, route: route.route, profile, position
					, receiptSha256: route.receiptSha256
				}));
	assert.equal(cells.length, selectedLane.profiles.length * 10);
	assert.equal(new Set(cells.map(cell =>
		`${cell.route}:${cell.profile}:${cell.position}`)).size, cells.length);
	return Object.freeze(cells);
};

const verifyJavaScriptLane = async root => {
	const reportFile = await canonicalFile(root, "report.json");
	const semantic = checkHostNullJavaScriptHostedReport(reportFile.value);
	const routes = [];
	for(const run of reportFile.value.runs)
	{
		const receiptPath = `${run.path}/component-package-receipt.json`;
		const receipt = await canonicalFile(root, receiptPath);
		assert.deepEqual(receipt.value, run.receipt);
		const verified = await verifyComponentPackageReceipt({
			receiptPath: join(root, receiptPath)
		});
		assert.equal(verified.verified, true);
		routes.push(Object.freeze({
			route: normalizedRoute(run.path), sourceRoute: run.path
			, receiptPath, receiptSha256: sha256(receipt.bytes)
			, packages: Object.freeze([run.receipt.package, run.receipt.runtime])
		}));
	}
	return { semantic, routes: Object.freeze(routes) };
};

const verifyPhpLane = async (root, selectedLane) => {
	const policy = hostNullPhpHostedPolicy(selectedLane.id);
	const reportFile = await canonicalFile(root, policy.reportPath);
	const semantic = await assertHostNullPhpReport(
		reportFile.value, selectedLane.id, join(root, policy.packagesPath)
	);
	const routes = [];
	for(const report of reportFile.value.reports)
	{
		const receiptPath = `${policy.packagesPath}/${report.path}/package-set-receipt.json`;
		const route = await packageSetRoute(
			root, report.path, report.path, receiptPath
		);
		assert.equal(route.receiptSha256, report.receiptSha256);
		assert.deepEqual(route.packages, report.packages);
		routes.push(route);
	}
	return { semantic, routes: Object.freeze(routes) };
};

const verifyManagedLane = async (root, selectedLane, producerCommit) => {
	const semantic = checker("check-host-null-managed-ci.mjs", [
		"--group", selectedLane.id, "--producer", producerCommit
		, "--directory", root, "--tap", join(root, "run.tap")
	]);
	const summary = await canonicalFile(root, "summary.json");
	const routes = [];
	for(const report of summary.value.routes)
	{
		const route = await packageSetRoute(root, report.route, report.route
			, `${report.route}/handoff/package-set-receipt.json`);
		assert.equal(route.receiptSha256, report.receiptSha256);
		assert.deepEqual(route.packages, report.packages);
		routes.push(route);
	}
	return { semantic, routes: Object.freeze(routes) };
};

const verifyScriptingLane = async (root, producerCommit) => {
	const semantic = checker("check-host-null-scripting-ci.mjs", [
		"--producer", producerCommit, "--directory", root
		, "--tap", join(root, "run.tap")
	]);
	const summary = await canonicalFile(root, "summary.json");
	const routes = [];
	for(const report of summary.value.routes)
	{
		const route = await packageSetRoute(root, report.route, report.route
			, `packages/${report.route}/package-set-receipt.json`);
		assert.equal(route.receiptSha256, report.receiptSha256);
		assert.deepEqual(route.packages, report.packages);
		routes.push(route);
	}
	return { semantic, routes: Object.freeze(routes) };
};

const verifySystemsLane = async (root, producerCommit) => {
	const semantic = checker("check-host-null-systems-ci.mjs", [
		"--producer", producerCommit, "--directory", root
		, "--tap", join(root, "run.tap")
	]);
	const summary = await canonicalFile(root, "summary.json");
	const routes = [];
	for(const report of summary.value.routes)
	{
		const route = await packageSetRoute(root, report.route, report.route
			, `${report.route}/handoff/package-set-receipt.json`);
		assert.equal(route.receiptSha256, report.receiptSha256);
		assert.deepEqual(route.packages, report.packages);
		const dependency = await readFile(join(root, report.route
			, "dependency-handoff", report.rustDependencies.archive));
		assert.equal(sha256(dependency), report.rustDependencies.sha256);
		routes.push(Object.freeze({
			...route, rustDependenciesSha256: report.rustDependencies.sha256
		}));
	}
	return { semantic, routes: Object.freeze(routes) };
};

/**
 * Independently replay one extracted artifact and bind all of its cells to
 * exact package receipts.
 *
 * @param selectedLane - Closed HostNull artifact lane.
 * @param root - Extracted artifact root.
 * @param producerCommit - Exact hosted producer revision.
 */
export const verifyHostNullCompleteExtractedLane = async (
	selectedLane, root, producerCommit
) => {
	assert.ok(hostNullCompleteHostedLanes.includes(selectedLane));
	assert.ok(isAbsolute(root) && resolve(root) === root);
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	let accepted;
	if(selectedLane.id === "javascript-browser")
		accepted = await verifyJavaScriptLane(root);
	else if(["php-native", "php-wasm"].includes(selectedLane.id))
		accepted = await verifyPhpLane(root, selectedLane);
	else if(["dotnet", "jvm"].includes(selectedLane.id))
		accepted = await verifyManagedLane(root, selectedLane, producerCommit);
	else if(selectedLane.id === "scripting")
		accepted = await verifyScriptingLane(root, producerCommit);
	else
		accepted = await verifySystemsLane(root, producerCommit);
	const cells = laneCells(selectedLane, accepted.routes);
	return Object.freeze({
		lane: selectedLane.id, profiles: selectedLane.profiles
		, producerCommit, semantic: accepted.semantic
		, routes: accepted.routes, cells
	});
};

const sourceCache = new Map();
/**
 * Read one immutable Git object.
 *
 * @param revision - Exact Git revision.
 * @param path - Repository-relative source path.
 */
export const hostNullCompleteHostedOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
	const key = `${revision}:${path}`;
	if(!sourceCache.has(key)) sourceCache.set(key, execFileSync(
		"git", ["show", key], {
			cwd: repository, maxBuffer: 256 * 1024 ** 2
		}
	));
	return sourceCache.get(key);
};
const moduleClosure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = hostNullCompleteHostedOriginal(revision, path);
		paths.add(path);
		if(!/\.[cm]?js$/u.test(path)) return;
		for(const specifier of moduleSpecifiers(bytes.toString(), path))
		{
			const joined = posix.normalize(posix.join(
				posix.dirname(path), specifier
			));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...paths].sort();
};
const sourceTree = (revision, prefix) => execFileSync("git", [
	"ls-tree", "-r", "--name-only", revision, "--", prefix
], {
	cwd: repository, encoding: "utf8"
}).trim().split("\n").filter(Boolean);
const producerEntries = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, ".github/actions/bounded-apt/action.yml"
	, "scripts/run-host-null-managed-ci.sh"
	, "scripts/run-host-null-scripting-ci.sh"
	, "scripts/run-host-null-systems-ci.sh"
	, "scripts/check-host-null-managed-ci.mjs"
	, "scripts/check-host-null-scripting-ci.mjs"
	, "scripts/check-host-null-systems-ci.mjs"
	, "scripts/check-host-null-php-reports.mjs"
	, "tests/host-null-npm-installed.test.mjs"
	, "tests/php-host-null.test.mjs"
	, "tests/php-wasm-host-null.test.mjs"
	, "tests/dotnet-host-null-contract.test.mjs"
	, "tests/jvm-host-null-contract.test.mjs"
	, "tests/scripting-host-null.test.mjs"
	, "tests/systems-host-null.test.mjs"
	, "scripts/bootstrap-toolchains.sh", "scripts/bootstrap-rust-ci.sh"
	, "scripts/bootstrap-php-wasm-ci.sh", "scripts/install-playwright-browsers.sh"
	, "scripts/env.sh", "lean-toolchain", "package.json", "package-lock.json"
	, "flake.lock", "flake.nix", "nix/wasm-toolchain.nix"
]);

/**
 * Select exact producer, checker and archiver sources for reproducible replay.
 *
 * @param revisions - Immutable Git revisions by evidence role.
 */
export const hostNullCompleteHostedSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	const checkerPaths = moduleClosure(revisions.checker, [
		"tests/helpers/host-null-complete-hosted-archive.mjs"
		, "tests/helpers/host-null-complete-hosted-evidence.mjs"
	]);
	const archiverPaths = moduleClosure(revisions.archiver, [
		"scripts/archive-host-null-complete-evidence.mjs"
		, "scripts/download-host-null-complete-inputs.mjs"
	]);
	const roles = [
		["producer", revisions.producer, [
			...moduleClosure(revisions.producer, producerEntries)
			, ...sourceTree(revisions.producer
				, "tests/fixtures/onboarding/host-null")
			, ...sourceTree(revisions.producer
				, "tests/fixtures/host-null-consumers")
		]]
		, ["checker", revisions.checker, checkerPaths]
		, ["archiver", revisions.archiver, archiverPaths]
	];
	const sources = [];
	for(const [role, revision, paths] of roles)
		for(const path of [...new Set(paths)].sort())
			sources.push(Object.freeze({ role, revision, path }));
	return sources;
};

/**
 * Return one collision-free retained source path.
 *
 * @param source - Selected source identity.
 */
export const hostNullCompleteHostedSourcePath = source => {
	assert.ok(source && ["producer", "checker", "archiver"]
		.includes(source.role));
	assert.match(source.revision, /^[a-f0-9]{40}$/u);
	return `sources/${source.role}/${source.path}`;
};
