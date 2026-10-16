/**
 * Independently check retained recursive checked-record Python acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { pythonTypingWheels } from "./python-wheel-install.mjs";
import { checkRecursiveCheckedRecordPythonEnvironment } from "./recursive-checked-record-python-environment-records.mjs";
import { checkRecursiveCheckedRecordPythonModels } from "./recursive-checked-record-python-model-records.mjs";
import {
	parseRecursiveCheckedRecordPythonResult, recursiveCheckedRecordPythonCaller
	, recursiveCheckedRecordPythonCallerArgs
	, recursiveCheckedRecordPythonCounts, recursiveCheckedRecordPythonFixtures
	, recursiveCheckedRecordPythonMinors, recursiveCheckedRecordPythonPackage
	, recursiveCheckedRecordPythonRoutes
} from "./recursive-checked-record-python-fixture.mjs";
import { recursiveCheckedRecordPythonInstalls } from "./recursive-checked-record-python-install.mjs";
import {
	assertRecursiveCheckedRecordPythonResources, recursiveCheckedRecordPythonLoadCeilings
} from "./recursive-checked-record-python-resources.mjs";

/**
 * Read every member of an original wheel without trusting recorded member identities.
 *
 * @param bytes - Original archive bytes.
 */
const unpacked = new Map();
const archiveMembers = async bytes => {
	const key = sha256(bytes);
	if(!unpacked.has(key)) unpacked.set(key, unpack(bytes));
	return new Map(await unpacked.get(key));
};
const unpack = async bytes => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-python-wheel-"));
	try
	{
		const path = join(root, "original.whl");
		await writeFile(path, bytes);
		const listing = execFileSync("/usr/bin/unzip", ["-Z1", path], { encoding: "utf8" })
			.trimEnd().split("\n").filter(name => !name.endsWith("/"));
		assert.equal(new Set(listing).size, listing.length, "Duplicate wheel members");
		const member = name => execFileSync("/usr/bin/unzip", ["-p", path, name], {
			maxBuffer: 256 * 1024 * 1024
		});
		return new Map(listing.map(name => [name, member(name)]));
	}
	finally
	{
		await rm(root, { recursive: true, force: true });
	}
};
const originals = new Map();
const original = (commit, path) => {
	const key = `${commit}:${path}`;
	if(!originals.has(key))
		originals.set(key, execFileSync("git", ["show", key], { maxBuffer: 64 * 1024 * 1024 }));
	return Buffer.from(originals.get(key));
};
const keys = (value, expected, label) =>
	assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
const reportKeys = [
	"authorInputsUnchanged", "builds", "declaredGlibcFloor"
	, "expectedBindingIrSha256", "fixture", "independentBuilds", "installs"
	, "interpreters", "loadCeiling", "minors", "producerCommit", "reports"
	, "reproducible", "resourceChecks", "route", "runtime", "schemaVersion"
	, "sourceRemovedBeforeInstallation", "wheelReceiptSha256"
];
const installKeys = [
	"archiveSha256", "arguments", "compilerFreeExecution", "consumerSha256"
	, "dependency", "fixture", "installedBytesUnchanged", "interpreter"
	, "inventorySha256", "minor", "observations", "offlineInstall"
	, "receiptSha256", "relocatedInstallation", "route", "selection"
	, "sourceUnchangedAfterReplay", "typingVersion"
];
const installFlags = [
	"offlineInstall", "compilerFreeExecution", "relocatedInstallation"
	, "installedBytesUnchanged", "sourceUnchangedAfterReplay"
];
const buildRecords = [
	"model.json", "package-set-receipt.json", "author-inputs.json"
	, "lean-bridge.exports.json"
];
const installRecords = [
	"environment.json", "install.json", "pip-install.json", "report.json"
	, "installed.json", "relocated.json", "installed-process.json"
	, "relocated-process.json"
];

/**
 * Enumerate every retained text record for one selection.
 *
 * @param route - Ordinary or reviewed author route.
 * @param fixture - Recursive or mutual module.
 * @param wheel - Authenticated original wheel record.
 */
export const recursiveCheckedRecordPythonRecords = (route, fixture, wheel) => {
	const { leanModule } = recursiveCheckedRecordPythonPackage(fixture);
	const build = [...buildRecords, `${leanModule}.lean`
		, ...route === "reviewed" ? ["api.binding-ir.json"] : []];
	return [
		"report.json", "runtime.json", "resources.json"
		, "expected.binding-ir.json", "configuration.json", "consumer.py"
		, "wheel.json", "handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256"
		, `handoff/${wheel.archive.path}`
		, ...[0, 1].flatMap(index => build.map(path => `build-${index}/${path}`))
		, ...wheel.retained.map(path => `package/${path}`)
		, ...recursiveCheckedRecordPythonInstalls.flatMap(({ name }) =>
			installRecords.map(path => `${name}/${path}`))
	].sort();
};

/**
 * Check original sources, both independent builds, the wheel and every installed replay.
 *
 * @param read - Original record byte reader, relative to one route/fixture selection.
 * @param options - Independently chosen producer and execution scope.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.fixture - Recursive or mutual module.
 * @param options.producerCommit - Full immutable producer revision.
 * @param options.runtime - Observed platform, architecture and glibc version.
 * @param options.floor - Explicit package glibc floor.
 */
export const checkRecursiveCheckedRecordPythonReport = async (read, { route, fixture, producerCommit, runtime, floor }) => {
	assert.ok(recursiveCheckedRecordPythonRoutes.includes(route));
	assert.ok(recursiveCheckedRecordPythonFixtures.includes(fixture));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	keys(runtime, ["arch", "glibc", "platform"], "runtime");
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= Number(floor.split(".")[1]));
	const { name, version } = recursiveCheckedRecordPythonPackage(fixture);
	const json = async path => {
		const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Noncanonical record: ${path}`);
		return value;
	};
	const report = await json("report.json");
	keys(report, reportKeys, "report");
	assert.equal(report.schemaVersion, 1); assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.route, route); assert.equal(report.fixture, fixture);
	assert.equal(report.declaredGlibcFloor, floor); assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation"])
		assert.equal(report[key], true, key);
	assert.deepEqual(report.minors, recursiveCheckedRecordPythonMinors);
	assert.deepEqual(report.installs, recursiveCheckedRecordPythonInstalls.map(item => item.name));
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch
		, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, runtimeRecord); assert.deepEqual(await json("runtime.json"), runtimeRecord);
	assert.ok(recursiveCheckedRecordPythonLoadCeilings.includes(report.loadCeiling), "Unrecorded load ceiling");
	const resources = await json("resources.json");
	// Start, both author roots and wheel inspection, then one admission per install.
	assert.equal(resources.length, 4 + recursiveCheckedRecordPythonInstalls.length);
	assert.deepEqual(report.resourceChecks, resources);
	for(const resource of resources) assertRecursiveCheckedRecordPythonResources(resource, report.loadCeiling);
	assert.deepEqual(report.interpreters.map(item => item.minor), recursiveCheckedRecordPythonMinors);
	assert.equal(new Set(report.interpreters.map(item => item.interpreter.sha256)).size, 2);
	for(const item of report.interpreters)
	{
		keys(item, ["binary", "identity", "interpreter", "minor", "run"], "interpreter");
		assert.deepEqual(item.identity, { implementation: "cpython", pointerBits: 64, python: item.identity.python });
		assert.equal(item.identity.python.split(".").slice(0, 2).join("."), item.minor);
		assert.deepEqual(item.run, { code: 0, stderr: "", stdout: `${JSON.stringify(item.identity).replaceAll(",", ", ").replaceAll(":", ": ")}\n` });
	}

	// Author inputs come from the producer commit, never from the checker's checkout.
	const { model, receipt } = await checkRecursiveCheckedRecordPythonModels({
		report, read, json, route, fixture, producerCommit
	});
	assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role, pkg.name, pkg.version])
		, [["pypi", "component", name, version]]);
	const caller = original(producerCommit, recursiveCheckedRecordPythonCaller);
	assert.equal(Buffer.compare(Buffer.from(await read("consumer.py")), caller), 0);
	const pkg = receipt.packages[0], artifact = pkg.artifacts[0];
	assert.equal(artifact.path, `archives/${name}-${version}-py3-none-manylinux_${floor.replace(".", "_")}_x86_64.whl`);
	const archive = Buffer.from(await read(`handoff/${artifact.path}`));
	assert.deepEqual({ bytes: archive.length, sha256: sha256(archive) }, { bytes: artifact.bytes, sha256: artifact.sha256 });
	const handoffReceipt = Buffer.from(await read("handoff/package-set-receipt.json"));
	assert.equal(sha256(handoffReceipt), report.builds[0].receiptSha256);
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString()
		, `${sha256(handoffReceipt)}  package-set-receipt.json\n`);

	const wheel = await json("wheel.json");
	keys(wheel, ["archive", "evidence", "files", "receiptSha256", "retained"], "wheel");
	assert.deepEqual(wheel.archive, artifact); assert.equal(report.wheelReceiptSha256, wheel.receiptSha256);
	assert.deepEqual(wheel.evidence.copiedGraph?.schemaVersion, 1);
	// Every recorded member identity and retained text comes from the original archive itself.
	const members = await archiveMembers(archive);
	assert.deepEqual(Object.keys(wheel.files).sort(), [...members.keys()].sort());
	for(const [path, bytes] of members)
		assert.deepEqual(wheel.files[path], { bytes: bytes.length, sha256: sha256(bytes) }, path);
	for(const path of wheel.retained)
		assert.equal(Buffer.compare(Buffer.from(await read(`package/${path}`)), members.get(path)), 0, path);
	assert.deepEqual(wheel.retained, Object.keys(wheel.files).filter(path =>
		!path.startsWith(`lean_${name}/native/`)).sort());
	assert.equal(model.bindingIrSha256, JSON.parse(members.get(`lean_${name}/lean_bridge/package-receipt.json`)).bindingIrSha256);
	const receiptPath = `lean_${name}/lean_bridge/package-receipt.json`;
	assert.equal(sha256(Buffer.from(await read(`package/${receiptPath}`))), wheel.receiptSha256);

	const counts = recursiveCheckedRecordPythonCounts[fixture];
	assert.deepEqual(report.reports.map(item => item.selection), report.installs);
	for(const item of report.reports)
	{
		const selection = recursiveCheckedRecordPythonInstalls.find(value => value.name === item.selection);
		const prefix = `${selection.name}/`;
		assert.deepEqual(await json(prefix + "report.json"), item);
		keys(item, installKeys, "install report");
		assert.equal(item.route, route); assert.equal(item.fixture, fixture);
		assert.equal(item.minor, selection.minor); assert.equal(item.typingVersion, selection.typingVersion);
		assert.deepEqual(item.interpreter, report.interpreters.find(value => value.minor === selection.minor));
		assert.equal(item.consumerSha256, sha256(caller)); assert.equal(item.archiveSha256, artifact.sha256);
		assert.equal(item.receiptSha256, wheel.receiptSha256);
		const callerArgs = recursiveCheckedRecordPythonCallerArgs(fixture);
		assert.deepEqual(item.arguments, ["-I", "-B", "consumer.py", ...callerArgs]);
		for(const key of installFlags) assert.equal(item[key], true, key);
		const install = await json(prefix + "install.json");
		assert.deepEqual(install.dependency, item.dependency);
		assert.deepEqual(install.requires, ['typing_extensions (<5,>=4.6); python_version < "3.12"']);
		assert.equal(install.resolvedOffline, true); assert.equal(install.python, item.interpreter.identity.python);
		const pip = JSON.parse(await read(prefix + "pip-install.json"));
		const resolved = pip.install.map(entry => [
			entry.metadata.name.replaceAll("-", "_"), entry.metadata.version
			, entry.requested, entry.download_info.archive_info.hashes.sha256
		]);
		const typing = selection.typingVersion;
		const pinned = [[name, version, true, artifact.sha256]];
		if(typing === null) assert.equal(item.dependency, null);
		else
		{
			assert.deepEqual(item.dependency, {
				archive: `typing_extensions-${typing}-py3-none-any.whl`
				, bytes: item.dependency.bytes, name: "typing_extensions"
				, sha256: pythonTypingWheels[typing], version: typing
			});
			pinned.push(["typing_extensions", typing, false, pythonTypingWheels[typing]]);
		}
		assert.deepEqual(resolved.sort(), pinned.sort());
		const inventory = await json(prefix + "environment.json");
		assert.equal(sha256(Buffer.from(await read(prefix + "environment.json"))), item.inventorySha256);
		checkRecursiveCheckedRecordPythonEnvironment({ inventory, wheel, selection
			, interpreter: item.interpreter, name, version });
		assert.equal(item.observations.length, 2);
		for(const [index, position] of ["installed", "relocated"].entries())
		{
			const observation = await json(`${prefix}${position}.json`);
			assert.deepEqual(observation, item.observations[index]);
			keys(observation, ["arguments", "counts", "environment", "inventorySha256", "relocated", "run"], "observation");
			assert.equal(observation.relocated, Boolean(index)); assert.deepEqual(observation.arguments, item.arguments);
			assert.deepEqual(observation.environment, copiedCleanEnvironment);
			assert.equal(observation.inventorySha256, item.inventorySha256);
			assert.deepEqual(observation.counts, counts);
			const run = await json(`${prefix}${position}-process.json`);
			assert.deepEqual(observation.run, run); keys(run, ["code", "stderr", "stdout"], "run");
			assert.equal(run.code, 0); assert.equal(run.stderr, "");
			assert.deepEqual(parseRecursiveCheckedRecordPythonResult(run.stdout, fixture), counts);
		}
	}
	const recordPaths = recursiveCheckedRecordPythonRecords(route, fixture, wheel);
	const reportSha256 = sha256(Buffer.from(await read("report.json")));
	return {
		route, fixture, producerCommit, runtime, floor, counts
		, installs: report.installs, loadCeiling: report.loadCeiling
		, executions: 2 * report.installs.length
		, records: recordPaths.length, recordPaths
		, archiveSha256: artifact.sha256, reportSha256
	};
};
