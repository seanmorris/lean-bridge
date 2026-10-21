/**
 * Install and relocate one authenticated dependent checked-record Python wheel offline.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import {
	attachFinContainerEdgePythonPackage, createFinContainerEdgePythonEnvironment
	, finContainerEdgePythonFlags, runFinContainerEdgePython
	, verifyFinContainerEdgePythonEnvironment
} from "./fin-container-edge-python-closure.mjs";
import {
	dependentCheckedRecordPythonCaller, dependentCheckedRecordPythonCallerArgs
	, dependentCheckedRecordPythonMinors, dependentCheckedRecordPythonPackage
	, dependentCheckedRecordPythonRoutes, parseDependentCheckedRecordPythonResult
} from "./dependent-checked-record-python-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const dependentCheckedRecordPythonReceipt
	= `${dependentCheckedRecordPythonPackage}/lean_bridge/package-receipt.json`;

/**
 * Bind one declared CPython floor to its actual executable and architecture.
 *
 * @param minor - Declared CPython minor floor.
 * @param command - Explicit absolute executable path.
 * @param cwd - Existing record directory.
 */
export const probeDependentCheckedRecordPython = async (minor, command, cwd) => {
	assert.ok(dependentCheckedRecordPythonMinors.includes(minor));
	assert.ok(isAbsolute(command));
	const binary = await realpath(command), bytes = await readFile(binary);
	const run = await runCopied(binary, ["-I", "-B", "-S", "-c"
		, "import json, struct, sys; print(json.dumps({'python': sys.version.split()[0], 'implementation': sys.implementation.name, 'pointerBits': struct.calcsize('P') * 8}, sort_keys=True))"
	], cwd);
	assert.equal(run.stderr, ""); const identity = JSON.parse(run.stdout);
	assert.match(identity.python, new RegExp(`^${minor.replace(".", "\\.")}\\.[0-9]+$`, "u"));
	assert.equal(identity.implementation, "cpython"); assert.equal(identity.pointerBits, 64);
	return {
		minor, binary
		, interpreter: { kind: "file", bytes: bytes.length, sha256: sha256(bytes) }
		, identity, run
	};
};

/**
 * Install the verified wheel without a package index, then replay the unchanged
 * caller before and after physically relocating its entire consumer root.
 *
 * @param options - Selected route, floor and verified package inputs.
 * @param options.minor - Declared CPython minor.
 * @param options.command - Absolute selected interpreter.
 * @param options.route - Exact author/API route.
 * @param options.root - Fresh consumer root.
 * @param options.archive - Original wheel path in the source-free handoff.
 * @param options.artifact - Receipt-controlled wheel artifact descriptor.
 * @param options.receiptBytes - Exact wheel-internal receipt bytes.
 * @param options.output - Original record destination.
 */
export const installDependentCheckedRecordPython = async ({
	minor, command, route, root, archive, artifact, receiptBytes, output
}) => {
	assert.ok(dependentCheckedRecordPythonMinors.includes(minor));
	assert.ok(dependentCheckedRecordPythonRoutes.includes(route));
	await assert.rejects(access(root), { code: "ENOENT" }); await mkdir(root, { recursive: true });
	const interpreter = await probeDependentCheckedRecordPython(minor, command, root);
	const source = await dependentCheckedRecordPythonCaller();
	const args = ["consumer.py", ...dependentCheckedRecordPythonCallerArgs(route)];
	await saveLakeFile(root, "consumer.py", source);
	const verifyArchive = async () => {
		const bytes = await readFile(archive);
		assert.equal(bytes.length, artifact.bytes); assert.equal(sha256(bytes), artifact.sha256);
	};
	await verifyArchive();
	const member = await runCopied("/usr/bin/unzip", ["-p", archive
		, dependentCheckedRecordPythonReceipt], root);
	assert.equal(member.stderr, ""); assert.equal(member.stdout, receiptBytes.toString());
	const wheelReceipt = JSON.parse(member.stdout);
	assert.equal(member.stdout, canonicalJson(wheelReceipt));
	assert.equal(wheelReceipt.moduleName, dependentCheckedRecordPythonPackage);
	const baseline = await createFinContainerEdgePythonEnvironment({
		baseCommand: command, venv: join(root, "venv"), cwd: root
	});
	assert.equal(baseline.python, interpreter.identity.python);
	assert.deepEqual(baseline.interpreter, interpreter.interpreter);
	await saveLakeFile(output, "baseline.json", canonicalJson(baseline));
	const cache = await mkdtemp(join(
		root, ".dependent-checked-record-python-pip-bytecode-"
	)); let install;
	try
	{
		assert.deepEqual(await readdir(cache), []);
		await verifyFinContainerEdgePythonEnvironment(baseline);
		const arguments_ = [...finContainerEdgePythonFlags(cache), "-m", "pip"
			, "--isolated", "install", "--no-index", "--no-deps", "--no-cache-dir"
			, "--no-compile", archive];
		const run = await runCopied(join(baseline.venv, "bin/python"), arguments_, root);
		install = { arguments: arguments_, environment: copiedCleanEnvironment, run };
		await saveLakeFile(output, "pip.json", canonicalJson(install));
	}
	finally
	{
		assert.deepEqual(await readdir(cache), []); await rm(cache, { recursive: true });
	}
	await verifyArchive();
	const installed = await attachFinContainerEdgePythonPackage(baseline, {
		receiptPath: dependentCheckedRecordPythonReceipt, receiptBytes
	});
	await saveLakeFile(output, "environment.json", canonicalJson(installed));
	const pipMetadata = {}, distribution = "dependentrecords-1.0.0.dist-info";
	for(const name of ["RECORD", "INSTALLER", "REQUESTED", "direct_url.json"])
	{
		const path = `${installed.site}/${distribution}/${name}`;
		if(Object.hasOwn(installed.entries, path))
			pipMetadata[path] = await readFile(join(installed.venv, path), "utf8");
	}
	await saveLakeFile(output, "pip-metadata.json", canonicalJson(pipMetadata));
	const observations = [];
	for(const [position, location] of [root, root + "-relocated"].entries())
	{
		if(position)
		{ await rename(root, location); await assert.rejects(access(root), { code: "ENOENT" }); }
		const context = { ...installed, venv: join(location, "venv") };
		const before = await verifyFinContainerEdgePythonEnvironment(context);
		assert.equal(await readFile(join(location, "consumer.py"), "utf8"), source);
		const run = await runFinContainerEdgePython(context, args, location);
		await saveLakeFile(output, `${position ? "relocated" : "installed"}-process.json`, canonicalJson(run));
		assert.equal(run.stderr, ""); const counts = parseDependentCheckedRecordPythonResult(run.stdout, route);
		assert.deepEqual(await verifyFinContainerEdgePythonEnvironment(context), before);
		assert.equal(await readFile(join(location, "consumer.py"), "utf8"), source);
		const observation = {
			relocated: Boolean(position), arguments: args
			, environment: copiedCleanEnvironment, run, counts, closure: before
		};
		observations.push(observation);
		await saveLakeFile(output, `${position ? "relocated" : "installed"}.json`, canonicalJson(observation));
	}
	await verifyArchive();
	const report = {
		minor, route, interpreter, arguments: args, observations
		, consumerSha256: sha256(source), archiveSha256: artifact.sha256
		, baselineSha256: baseline.baselineSha256
		, environmentSha256: installed.expectedSha256
		, receiptSha256: sha256(receiptBytes), offlineInstall: true
		, compilerFreeExecution: true, relocatedInstallation: true
		, installedBytesUnchanged: true, sourceUnchangedAfterReplay: true
		, dispatch: { observed: false, reason: "Separate constructor/source entry probe remains required" }
	};
	await saveLakeFile(output, "report.json", canonicalJson(report));
	return report;
};
