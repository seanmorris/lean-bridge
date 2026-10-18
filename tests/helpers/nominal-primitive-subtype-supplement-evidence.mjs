/**
 * Authenticate the hosted supplemental primitive-base replay without rerunning
 * browsers, package installation or Lean. The retained GitHub ZIP is the root
 * of every checked record below.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { inflateRawSync } from "node:zlib";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

export const nominalPrimitiveSupplementEvidence
	= "docs/evidence/nominal-primitive-subtype-supplement-20261018";
export const nominalPrimitiveSupplementProducer
	= "bee9e875e1bc9bcbc6c164b32c038035c6f72951";
export const nominalPrimitiveSupplementChecker
	= "bee9e875e1bc9bcbc6c164b32c038035c6f72951";
/** Pinned only after the one-shot archiver is committed and executed. */
export const nominalPrimitiveSupplementArchiver = null;
/** Pinned only after every retained byte has been independently checked. */
export const nominalPrimitiveSupplementEvidenceSha256 = null;

export const nominalPrimitiveSupplementHosted = Object.freeze({
	repository: "seanmorris/lean-bridge"
	, runId: 39090071203, jobId: 117564752324, artifactId: 12122167697
	, artifactName: "nominal-primitive-subtype-supplement-bee9e875e1bc9bcbc6c164b32c038035c6f72951"
	, artifactBytes: 411539
	, artifactDigest: "sha256:b3401331a1054482a2420ec1d9f8d30e969237472ee4a803fb869ed47afabb74"
});

const counts = Object.freeze({
	checks: 126, rejections: 23, strictValues: 17, variantRefusals: 6
});
const routes = Object.freeze(["ordinary", "reviewed"]);
const engines = Object.freeze(["chromium", "firefox", "webkit"]);
const profiles = Object.freeze([
	"browser-javascript", "browser-react", "browser-worker"
]);
const npmArchive = Object.freeze({
	producerCommit: "caff60b7f6acf60e06988f003b2823c0d2e0319e"
	, archiveSha256: "302238528cb14b32f5b6c6cff5c621244e2948a4d04a33a7d4549c6cd48fc576"
});
const pythonArchive = Object.freeze({
	producerCommit: "b1be97044c7dd9f21f58c8b63bd6a4518c145f04"
	, archiveSha256: "6ca71a8845f0025aad297334f8c72dd4e6b90228697e02bde65c84b2ff36aa7b"
});

const producerSources = Object.freeze([
	".github/workflows/nominal-primitive-subtype-supplement.yml"
	, "package-lock.json"
	, "scripts/install-playwright-browsers.sh"
	, "src/build/native-artifacts.mjs"
	, "src/release/component-package-receipt.mjs"
	, "tests/nominal-primitive-subtype-supplement-ci.test.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-container-edge-python-closure.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-fixture.mjs"
	, "tests/helpers/nominal-primitive-subtype-fixture.mjs"
	, "tests/helpers/nominal-primitive-subtype-npm-archive.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-archive.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-fixture.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-supplement-model.py"
	, "tests/helpers/nominal-primitive-subtype-python-wheel.mjs"
	, "tests/helpers/nominal-primitive-subtype-supplement-caller-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-supplement-installed-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-supplement-installed.mjs"
	, "tests/helpers/type-corpus-browser.mjs"
	, "tests/helpers/type-corpus.mjs"
	, "tests/fixtures/nominal-primitive-subtype-consumers/browser-supplement.mjs"
	, "tests/fixtures/nominal-primitive-subtype-consumers/javascript-supplement.mjs"
	, "tests/fixtures/nominal-primitive-subtype-consumers/javascript.mjs"
	, "tests/fixtures/nominal-primitive-subtype-consumers/python-supplement.py"
	, ...["plain", "react", "worker", "worker-main"].map(name =>
		`tests/fixtures/type-corpus/consumers/browser/${name}.mjs`)
].sort());
const archiverSources = Object.freeze([
	"scripts/archive-nominal-primitive-subtype-supplement-evidence.mjs"
	, "src/capsule/node.mjs"
	, "tests/helpers/nominal-primitive-subtype-supplement-evidence.mjs"
].sort());

/** Require all source identities before accepting the archive. */
export const nominalPrimitiveSupplementPinnedRevisions = () => {
	const revisions = {
		producer: nominalPrimitiveSupplementProducer
		, checker: nominalPrimitiveSupplementChecker
		, archiver: nominalPrimitiveSupplementArchiver
	};
	for(const [role, revision] of Object.entries(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, `Pin the supplemental primitive-base ${role} revision first`);
	return revisions;
};

/**
 * Exact selected source snapshots retained by the one-shot archiver.
 *
 * @param revisions - Producer, checker, and archiver Git identities.
 */
export const nominalPrimitiveSupplementSelectedSources = revisions => [
	...producerSources.map(path => ({ role: "producer", revision: revisions.producer, path }))
	, ...archiverSources.map(path => ({ role: "archiver", revision: revisions.archiver, path }))
];

/**
 * Read one original Git object without consulting mutable worktree bytes.
 *
 * @param revision - Full immutable Git revision.
 * @param path - Repository-relative source path.
 */
export const nominalPrimitiveSupplementOriginal = (revision, path) =>
	execFileSync("git", ["show", `${revision}:${path}`], {
		maxBuffer: 32 * 1024 * 1024
	});

const safePath = path => typeof path === "string" && path.length > 0
	&& !path.startsWith("/") && !path.includes("\\")
	&& posix.normalize(path) === path
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path, canonical = true) => {
	const value = JSON.parse(bytes.toString());
	if(canonical) assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
const exactKeys = (value, expected, label) =>
	assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
const artifact = (files, path) => {
	const bytes = files.get(path); assert.ok(Buffer.isBuffer(bytes), path); return bytes;
};

const crcTable = Array.from({ length: 256 }, (_, input) => {
	let value = input;
	for(let bit = 0; bit < 8; bit++)
		value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
	return value >>> 0;
});
const crc32 = bytes => {
	let value = 0xffffffff;
	for(const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8;
	return (value ^ 0xffffffff) >>> 0;
};

/**
 * Parse the original actions/upload-artifact ZIP without writing or executing it.
 * Only stored and deflated regular members with safe UTF-8 paths are accepted.
 *
 * @param bytes - Complete original GitHub artifact ZIP.
 */
export const nominalPrimitiveSupplementZipMembers = bytes => {
	assert.ok(Buffer.isBuffer(bytes));
	assert.equal(bytes.length, nominalPrimitiveSupplementHosted.artifactBytes);
	assert.equal(`sha256:${sha256(bytes)}`
		, nominalPrimitiveSupplementHosted.artifactDigest);
	const end = bytes.length - 22;
	assert.equal(bytes.readUInt32LE(end), 0x06054b50);
	assert.equal(bytes.readUInt16LE(end + 4), 0);
	assert.equal(bytes.readUInt16LE(end + 20), 0);
	const count = bytes.readUInt16LE(end + 8);
	assert.ok(count > 0 && count < 512);
	assert.equal(bytes.readUInt16LE(end + 10), count);
	const centralSize = bytes.readUInt32LE(end + 12);
	let central = bytes.readUInt32LE(end + 16);
	assert.equal(central + centralSize, end);
	const members = new Map(); let total = 0;
	for(let index = 0; index < count; index++)
	{
		assert.equal(bytes.readUInt32LE(central), 0x02014b50);
		const flags = bytes.readUInt16LE(central + 8);
		const method = bytes.readUInt16LE(central + 10);
		assert.equal(flags & 1, 0, "encrypted ZIP member");
		assert.ok([0, 8].includes(method), `ZIP method ${method}`);
		const expectedCrc = bytes.readUInt32LE(central + 16);
		const packed = bytes.readUInt32LE(central + 20);
		const size = bytes.readUInt32LE(central + 24);
		const nameSize = bytes.readUInt16LE(central + 28);
		const extraSize = bytes.readUInt16LE(central + 30);
		const commentSize = bytes.readUInt16LE(central + 32);
		const local = bytes.readUInt32LE(central + 42);
		assert.ok(size > 0 && size <= 2 * 1024 ** 2);
		assert.equal(bytes.readUInt32LE(local), 0x04034b50);
		assert.equal(bytes.readUInt16LE(local + 8), method);
		const localNameSize = bytes.readUInt16LE(local + 26);
		const localExtraSize = bytes.readUInt16LE(local + 28);
		assert.equal(localNameSize, nameSize);
		const nameBytes = bytes.subarray(central + 46, central + 46 + nameSize);
		const name = nameBytes.toString("utf8");
		assert.deepEqual(Buffer.from(name), nameBytes);
		assert.ok(safePath(name) && !name.endsWith("/") && !members.has(name), name);
		assert.deepEqual(bytes.subarray(local + 30, local + 30 + nameSize), nameBytes);
		const start = local + 30 + localNameSize + localExtraSize;
		const packedBytes = bytes.subarray(start, start + packed);
		assert.equal(packedBytes.length, packed);
		const content = method === 0 ? Buffer.from(packedBytes)
			: inflateRawSync(packedBytes, { maxOutputLength: size });
		assert.equal(content.length, size); assert.equal(crc32(content), expectedCrc);
		members.set(name, content); total += size;
		assert.ok(total <= 8 * 1024 ** 2);
		central += 46 + nameSize + extraSize + commentSize;
	}
	assert.equal(central, end);
	return members;
};

const output = run => {
	assert.deepEqual([run.code, run.stderr], [0, ""]);
	assert.deepEqual(JSON.parse(run.stdout), counts);
};
const assertObservation = (value, profile, route) => {
	assert.equal(typeof value.hostVersion, "string"); assert.ok(value.hostVersion);
	assert.deepEqual(value, {
		schemaVersion: 1, profile, module: "nominalprimitivesubtypes"
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: {
			module: "nominalprimitivesubtypes", route, mode: "full"
			, resultOnly: false, ...counts
		}
		, hostVersion: value.hostVersion
	});
};
const phases = profile => profile === "browser-react"
	? ["first", "remount-1", "remount-2", "failure-recovery", "pending-unmount"]
	: profile === "browser-worker"
		? ["first", "rerun", "worker-restart", "failure-recovery"]
		: ["first", "rerun", "failure-recovery"];
const variants = profile => profile === "browser-react"
	? ["production", "strict"] : ["production"];

const npmFiles = [
	"callers/fixtures/javascript-supplement.mjs"
	, "callers/fixtures/javascript.mjs", "callers/index.mjs"
	, "install.json", "installed.json", "relocated.json", "report.json"
];
const pythonFiles = [
	"baseline.json", "callers/consumer.py", "installed.json", "pip.json"
	, "relocated.json", "report.json"
];
const commonBrowserFiles = [
	"fixtures/nominal-primitive-subtype-consumers/browser-supplement.mjs"
	, "fixtures/nominal-primitive-subtype-consumers/javascript-supplement.mjs"
	, "fixtures/nominal-primitive-subtype-consumers/javascript.mjs"
	, "index.html", "inputs.json", "install.json", "javascript.mjs"
	, "observations.json", "package-lock.json", "package.json", "package.mjs"
	, "report.json", "request.json"
];
const browserFiles = profile => [
	...commonBrowserFiles
	, ...profile === "browser-javascript" ? ["plain.mjs"] : []
	, ...profile === "browser-react" ? ["react.mjs"] : []
	, ...profile === "browser-worker" ? ["worker-main.mjs", "worker.mjs"] : []
];

const assertNpm = (files, source) => {
	const reports = [], receipts = new Map();
	for(const route of routes)
	{
		const root = `npm/${route}/`, report = json(artifact(files, root + "report.json"), root + "report.json");
		exactKeys(report, [
			"archiveSha256", "callers", "counts", "host", "leanBuild", "mode"
			, "observations", "offlineInstall", "originalPackage", "producerCommit"
			, "receipt", "relocatedInstallation", "route", "schemaVersion"
		], root + "report keys");
		assert.deepEqual({
			schemaVersion: report.schemaVersion, host: report.host, route: report.route
			, mode: report.mode, archiveSha256: report.archiveSha256
			, producerCommit: report.producerCommit, counts: report.counts
			, originalPackage: report.originalPackage, leanBuild: report.leanBuild
			, offlineInstall: report.offlineInstall
			, relocatedInstallation: report.relocatedInstallation
		}, {
			schemaVersion: 1, host: "npm", route, mode: "full"
			, ...npmArchive, counts, originalPackage: true, leanBuild: false
			, offlineInstall: true, relocatedInstallation: true
		});
		assert.deepEqual(report.observations.map(item => item.relocated), [false, true]);
		for(const item of report.observations) output(item.run);
		assert.deepEqual(json(artifact(files, root + "installed.json"), root + "installed.json"), report.observations[0]);
		assert.deepEqual(json(artifact(files, root + "relocated.json"), root + "relocated.json"), report.observations[1]);
		const install = json(artifact(files, root + "install.json"), root + "install.json");
		assert.equal(install.code, 0); assert.match(install.stdout, /added 2 packages/u);
		for(const [path, digest] of Object.entries(report.callers))
			assert.equal(sha256(artifact(files, root + "callers/" + path)), digest, path);
		assert.deepEqual(artifact(files, root + "callers/fixtures/javascript-supplement.mjs"), source("tests/fixtures/nominal-primitive-subtype-consumers/javascript-supplement.mjs"));
		assert.deepEqual(artifact(files, root + "callers/fixtures/javascript.mjs"), source("tests/fixtures/nominal-primitive-subtype-consumers/javascript.mjs"));
		receipts.set(route, report.receipt); reports.push(report);
	}
	return { reports, receipts };
};

const assertPython = (files, source, tools) => {
	const reports = [];
	for(const minor of ["3.11", "3.12"]) for(const route of routes)
	{
		const root = `python/${minor}/${route}/`;
		const report = json(artifact(files, root + "report.json"), root + "report.json");
		exactKeys(report, [
			"archiveSha256", "consumerSha256", "counts", "host", "leanBuild"
			, "minor", "mode", "observations", "offlineInstall", "originalPackage"
			, "producerCommit", "python", "receiptSha256", "relocatedInstallation"
			, "route", "schemaVersion", "wheelSha256"
		], root + "report keys");
		assert.deepEqual({
			schemaVersion: report.schemaVersion, host: report.host, route: report.route
			, mode: report.mode, minor: report.minor, archiveSha256: report.archiveSha256
			, producerCommit: report.producerCommit, counts: report.counts
			, originalPackage: report.originalPackage, leanBuild: report.leanBuild
			, offlineInstall: report.offlineInstall
			, relocatedInstallation: report.relocatedInstallation
		}, {
			schemaVersion: 1, host: "python", route, mode: "full", minor
			, ...pythonArchive, counts, originalPackage: true, leanBuild: false
			, offlineInstall: true, relocatedInstallation: true
		});
		assert.equal(report.python, tools[`python-${minor}`].slice(7));
		for(const key of ["wheelSha256", "receiptSha256", "consumerSha256"])
			assert.match(report[key], /^[a-f0-9]{64}$/u);
		const consumer = artifact(files, root + "callers/consumer.py");
		assert.equal(sha256(consumer), report.consumerSha256);
		assert.deepEqual(consumer, source("tests/fixtures/nominal-primitive-subtype-consumers/python-supplement.py"));
		assert.deepEqual(report.observations.map(item => item.relocated), [false, true]);
		for(const item of report.observations)
		{
			assert.deepEqual(item.arguments, ["consumer.py", ...route === "reviewed" ? ["--reviewed"] : []]);
			output(item.run);
		}
		assert.deepEqual(json(artifact(files, root + "installed.json"), root + "installed.json"), report.observations[0]);
		assert.deepEqual(json(artifact(files, root + "relocated.json"), root + "relocated.json"), report.observations[1]);
		const baseline = json(artifact(files, root + "baseline.json"), root + "baseline.json");
		assert.equal(baseline.python, report.python); assert.match(baseline.baselineSha256, /^[a-f0-9]{64}$/u);
		const pip = json(artifact(files, root + "pip.json"), root + "pip.json");
		for(const flag of ["--isolated", "--no-index", "--no-deps", "--no-cache-dir", "--no-compile"])
			assert.ok(pip.arguments.includes(flag), flag);
		assert.deepEqual([pip.run.code, pip.run.stderr], [0, ""]);
		reports.push(report);
	}
	return reports;
};

const assertBrowsers = (files, source, npm) => {
	const reports = [];
	for(const route of routes)
	{
		const aggregatePath = `browser/${route}/browser.json`;
		const aggregate = json(artifact(files, aggregatePath), aggregatePath);
		assert.deepEqual([aggregate.schemaVersion, aggregate.route, aggregate.engines]
			, [1, route, engines]);
		assert.deepEqual(aggregate.reports.map(report => report.profile), profiles);
		for(const profile of profiles)
		{
			const root = `browser/${route}/${profile}/`;
			const report = json(artifact(files, root + "report.json"), root + "report.json");
			assert.deepEqual(report, aggregate.reports.find(item => item.profile === profile));
			assert.deepEqual({
				schemaVersion: report.schemaVersion
				, host: report.host
				, profile: report.profile
				, route: report.route
				, mode: report.mode
				, producerCommit: report.producerCommit
				, engines: report.engines, counts: report.counts
				, originalPackage: report.originalPackage, leanBuild: report.leanBuild
				, offlineInstall: report.offlineInstall
			}, {
				schemaVersion: 1, host: "browser", profile, route, mode: "full"
				, producerCommit: npmArchive.producerCommit, engines, counts
				, originalPackage: true, leanBuild: false, offlineInstall: true
			});
			assert.deepEqual(report.receipt, npm.receipts.get(route));
			assert.deepEqual(report.browser.requestedEngines, engines);
			assert.equal(report.browser.externalNetworkBlocked, true);
			assert.equal(report.browser.installedSourcesRemoved, true);
			assert.equal(report.browser.deployments.length, variants(profile).length);
			assert.equal(report.browser.executions.length
				, engines.length * variants(profile).length);
			assert.equal(report.browser.installedAssets.length, 2);
			if(profile === "browser-react")
			{
				assert.deepEqual(report.browser.framework.map(item => [
					item.name, item.version, item.archive
				]), [
					["react", "19.2.8", "framework/react-19.2.8.tgz"]
					, ["react-dom", "19.2.8", "framework/react-dom-19.2.8.tgz"]
					, ["scheduler", "0.27.0", "framework/scheduler-0.27.0.tgz"]
				]);
				for(const item of report.browser.framework)
					assert.match(item.sha256, /^[a-f0-9]{64}$/u);
			}
			else assert.deepEqual(report.browser.framework, []);
			const expectedPhases = engines.flatMap(engine => variants(profile).flatMap(variant =>
				phases(profile).map(phase => ({ engine, variant, phase }))));
			assert.deepEqual(report.observations.map(({ engine, variant, phase }) => ({ engine, variant, phase })), expectedPhases);
			for(const item of report.observations) assertObservation(item.observation, profile, route);
			assert.deepEqual(json(artifact(files, root + "observations.json"), root + "observations.json"), report.observations);
			assertObservation(report.observation, profile, route);
			const inputs = json(artifact(files, root + "inputs.json"), root + "inputs.json");
			assert.deepEqual(inputs, report.inputs);
			for(const [path, identity] of Object.entries(inputs))
			{
				const bytes = artifact(files, root + path);
				assert.deepEqual(identity, { bytes: bytes.length, sha256: sha256(bytes) }, path);
			}
			for(const name of ["browser-supplement.mjs", "javascript-supplement.mjs", "javascript.mjs"])
				assert.deepEqual(artifact(files, root + `fixtures/nominal-primitive-subtype-consumers/${name}`), source(`tests/fixtures/nominal-primitive-subtype-consumers/${name}`));
			const install = json(artifact(files, root + "install.json"), root + "install.json");
			assert.equal(install.code, 0); assert.match(install.stdout, /added [235] packages/u);
			reports.push(report);
		}
	}
	return reports;
};

const expectedArtifactPaths = () => {
	const paths = ["run.tap", "tools.txt"];
	for(const route of routes) for(const path of npmFiles) paths.push(`npm/${route}/${path}`);
	for(const minor of ["3.11", "3.12"]) for(const route of routes)
		for(const path of pythonFiles) paths.push(`python/${minor}/${route}/${path}`);
	for(const route of routes)
	{
		paths.push(`browser/${route}/browser.json`);
		for(const profile of profiles) for(const path of browserFiles(profile))
			paths.push(`browser/${route}/${profile}/${path}`);
	}
	return paths.sort();
};

/**
 * Validate all original artifact members and return the derived receipt summary.
 *
 * @param files - Artifact members keyed by their original safe path.
 * @param source - Reader for exact producer-revision source snapshots.
 */
export const checkNominalPrimitiveSupplementArtifact = (files, source) => {
	assert.deepEqual([...files.keys()].sort(), expectedArtifactPaths());
	const tap = artifact(files, "run.tap").toString();
	assert.ok(tap.startsWith("TAP version 13\n"));
	assert.equal([...tap.matchAll(/^ok [0-9]+ - /gmu)].length, 11);
	assert.doesNotMatch(tap, /^not ok /mu);
	for(const line of ["1..11", "# tests 11", "# pass 11", "# fail 0", "# cancelled 0", "# skipped 0", "# todo 0"])
		assert.ok(tap.split("\n").includes(line), line);
	const toolLines = artifact(files, "tools.txt").toString().trim().split("\n");
	assert.equal(toolLines.length, 6);
	const tools = Object.fromEntries(toolLines.map(line => {
		const position = line.indexOf("="); assert.ok(position > 0); return [line.slice(0, position), line.slice(position + 1)];
	}));
	assert.equal(tools.revision, nominalPrimitiveSupplementProducer);
	assert.match(tools.node, /^v22\.[0-9]+\.[0-9]+$/u);
	assert.match(tools.npm, /^10\.[0-9]+\.[0-9]+$/u);
	assert.match(tools["python-3.11"], /^Python 3\.11\.[0-9]+$/u);
	assert.match(tools["python-3.12"], /^Python 3\.12\.[0-9]+$/u);
	assert.match(tools.glibc, / 2\.39$/u);
	const npm = assertNpm(files, source);
	const python = assertPython(files, source, tools);
	const browser = assertBrowsers(files, source, npm);
	return {
		tests: 11, npm: npm.reports.length, python: python.length
		, browser: browser.length
		, browserObservations: browser.reduce((sum, report) => sum + report.observations.length, 0)
		, counts
		, tools
		, sourceArchives: {
			npm: {
				directory: "docs/evidence/nominal-primitive-subtype-npm-20261014"
				, kind: "nominal-primitive-subtype-npm-installed-v1"
				, producerCommit: npmArchive.producerCommit
				, indexSha256: npmArchive.archiveSha256
				, selections: ["ordinary/full", "reviewed/full"]
				, reusedByBrowsers: true
			}
			, python: {
				directory: "docs/evidence/nominal-primitive-subtype-python-20261014"
				, kind: "nominal-primitive-subtype-python-installed-v1"
				, producerCommit: pythonArchive.producerCommit
				, indexSha256: pythonArchive.archiveSha256
				, selections: ["ordinary/full", "reviewed/full"]
				, interpreterFloors: ["3.11", "3.12"]
			}
		}
	};
};

/**
 * Authenticate the original GitHub run, job, log and artifact metadata.
 *
 * @param index - Staged immutable evidence index.
 * @param files - Staged evidence members keyed by archive-relative path.
 */
export const assertNominalPrimitiveSupplementHostedCapture = (index, files) => {
	const run = json(artifact(files, "api/run.json"), "api/run.json", false);
	const job = json(artifact(files, "api/job.json"), "api/job.json", false);
	const hostedArtifact = json(artifact(files, "api/artifact.json"), "api/artifact.json", false);
	assert.deepEqual([run.id, run.event, run.status, run.conclusion, run.head_sha, run.path, run.run_attempt]
		, [nominalPrimitiveSupplementHosted.runId, "push", "completed", "success"
			, nominalPrimitiveSupplementProducer
			, ".github/workflows/nominal-primitive-subtype-supplement.yml"
			, 1]);
	assert.deepEqual([job.id, job.run_id, job.head_sha, job.status, job.conclusion, job.name, job.labels]
		, [nominalPrimitiveSupplementHosted.jobId
			, nominalPrimitiveSupplementHosted.runId
			, nominalPrimitiveSupplementProducer, "completed", "success"
			, "Replay strict constructors and variant refusals from archived packages"
			, ["ubuntu-24.04"]]);
	const acceptance = job.steps.find(step => step.name === "Replay the supplemental callers from authenticated archives");
	const upload = job.steps.find(step => step.name === "Preserve original and partial supplemental records");
	const enforce = job.steps.find(step => step.name === "Enforce the supplemental installed replay");
	assert.equal(acceptance?.conclusion, "success"); assert.equal(upload?.conclusion, "success");
	assert.equal(enforce?.conclusion, "skipped");
	assert.deepEqual([
		hostedArtifact.id, hostedArtifact.name, hostedArtifact.size_in_bytes
		, hostedArtifact.digest
		, hostedArtifact.expired
		, hostedArtifact.workflow_run.id
		, hostedArtifact.workflow_run.head_sha
	], [
		nominalPrimitiveSupplementHosted.artifactId
		, nominalPrimitiveSupplementHosted.artifactName
		, nominalPrimitiveSupplementHosted.artifactBytes
		, nominalPrimitiveSupplementHosted.artifactDigest, false
		, nominalPrimitiveSupplementHosted.runId, nominalPrimitiveSupplementProducer
	]);
	const log = artifact(files, "api/job.log").toString();
	assert.ok(log.includes("Complete job name: Replay strict constructors and variant refusals from archived packages"));
	assert.ok(log.includes("tests/helpers/nominal-primitive-subtype-supplement-installed-tests.mjs"));
	assert.ok(log.includes("# pass 11")); assert.ok(log.includes("# fail 0"));
	assert.deepEqual(index.hostedRun, {
		repository: nominalPrimitiveSupplementHosted.repository
		, runId: nominalPrimitiveSupplementHosted.runId
		, jobId: nominalPrimitiveSupplementHosted.jobId
		, url: `https://github.com/${nominalPrimitiveSupplementHosted.repository}/actions/runs/${nominalPrimitiveSupplementHosted.runId}`
		, artifact: {
			id: nominalPrimitiveSupplementHosted.artifactId
			, name: nominalPrimitiveSupplementHosted.artifactName
			, bytes: nominalPrimitiveSupplementHosted.artifactBytes
			, digest: nominalPrimitiveSupplementHosted.artifactDigest
		}
	});
};

const cache = new Map();
/**
 * Authenticate the immutable hosted archive and every semantic record.
 *
 * @param read - Repository-relative immutable evidence reader.
 */
export const checkNominalPrimitiveSupplementEvidence = async (read = readFile) => {
	if(read === readFile && cache.has("default")) return cache.get("default");
	const checking = (async () => {
		const revisions = nominalPrimitiveSupplementPinnedRevisions();
		assert.match(nominalPrimitiveSupplementEvidenceSha256 ?? ""
			, /^[a-f0-9]{64}$/u, "Pin the supplemental primitive-base evidence index first");
		const indexBytes = Buffer.from(await read(`${nominalPrimitiveSupplementEvidence}/index.json`));
		assert.equal(sha256(indexBytes), nominalPrimitiveSupplementEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		exactKeys(index, [
			"archiveCommit", "checkerCommit", "files", "hostedRun", "kind"
			, "limitations", "producerCommit", "records", "schemaVersion"
			, "selectedSources"
		], "index keys");
		assert.deepEqual({
			schemaVersion: index.schemaVersion, kind: index.kind
			, producerCommit: index.producerCommit, checkerCommit: index.checkerCommit
			, archiveCommit: index.archiveCommit
		}, {
			schemaVersion: 1, kind: "nominal-primitive-subtype-supplement-hosted-v1"
			, producerCommit: revisions.producer, checkerCommit: revisions.checker
			, archiveCommit: revisions.archiver
		});
		let previous = "";
		for(const entry of index.files)
		{
			exactKeys(entry, ["bytes", "path", "sha256"], entry.path);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(!previous || previous.localeCompare(entry.path) < 0); previous = entry.path;
			const bytes = Buffer.from(await read(`${nominalPrimitiveSupplementEvidence}/${entry.path}`));
			assert.equal(bytes.length, entry.bytes, entry.path); assert.equal(sha256(bytes), entry.sha256, entry.path);
			files.set(entry.path, bytes);
		}
		const selectedSources = nominalPrimitiveSupplementSelectedSources(revisions);
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const selected of selectedSources)
		{
			const path = `sources/${selected.role}/${selected.path}`;
			assert.deepEqual(artifact(files, path), nominalPrimitiveSupplementOriginal(selected.revision, selected.path), path);
		}
		assertNominalPrimitiveSupplementHostedCapture(index, files);
		const zip = nominalPrimitiveSupplementZipMembers(artifact(files, "api/artifact.zip"));
		const retained = new Map([...files].filter(([path]) => path.startsWith("artifact/"))
			.map(([path, bytes]) => [path.slice(9), bytes]));
		assert.deepEqual([...retained.keys()].sort(), [...zip.keys()].sort());
		for(const [path, bytes] of zip) assert.deepEqual(retained.get(path), bytes, path);
		const source = path => artifact(files, `sources/producer/${path}`);
		const records = checkNominalPrimitiveSupplementArtifact(retained, source);
		assert.deepEqual(index.records, records);
		const expectedPaths = [
			...retained.keys().map(path => `artifact/${path}`)
			, "api/artifact.json"
			, "api/artifact.zip"
			, "api/job.json"
			, "api/job.log"
			, "api/run.json"
			, ...selectedSources.map(source => `sources/${source.role}/${source.path}`)
		].sort();
		assert.deepEqual([...files.keys()].sort(), expectedPaths);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item));
		return { ...revisions, hostedRun: index.hostedRun, records, files: index.files };
	})();
	if(read === readFile) cache.set("default", checking);
	return checking;
};
