/**
 * Install one original wheel in a fresh Python environment, then physically move it.
 * Preserve the pre-install baseline, authenticated files and original process output.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { createFinContainerEdgePythonEnvironment, attachFinContainerEdgePythonPackage, finContainerEdgePythonFlags, runFinContainerEdgePython, verifyFinContainerEdgePythonEnvironment } from "./fin-container-edge-python-closure.mjs";
import { nominalSubtypePythonCaller, nominalSubtypePythonMinors, nominalSubtypePythonModes, parseNominalSubtypePythonResult } from "./nominal-subtype-python-fixture.mjs";
import { nominalSubtypePythonReceipt } from "./nominal-subtype-python-wheel.mjs";
import { genericSubtypeLanguageCaller, parseGenericSubtypeLanguageResult } from "./generic-subtype-languages.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Bind the selected floor to the actual executable before compiling packages.
 *
 * @param minor - Independently selected supported Python minor.
 * @param command - Explicit absolute interpreter path.
 * @param cwd - Existing task directory.
 */
export const probeNominalSubtypePython = async (minor, command, cwd) => {
	assert.ok(nominalSubtypePythonMinors.includes(minor)); assert.ok(isAbsolute(command));
	const binary = await realpath(command), bytes = await readFile(binary);
	const run = await runCopied(binary, ["-I", "-B", "-S", "-c"
		, "import json, struct, sys; print(json.dumps({'python': sys.version.split()[0], 'implementation': sys.implementation.name, 'pointerBits': struct.calcsize('P') * 8}, sort_keys=True))"], cwd);
	assert.equal(run.stderr, ""); const identity = JSON.parse(run.stdout);
	assert.match(identity.python, /^3\.(?:11|12)\.[0-9]+$/u);
	assert.equal(identity.python.split(".").slice(0, 2).join("."), minor);
	assert.equal(identity.implementation, "cpython"); assert.equal(identity.pointerBits, 64);
	return { minor, binary, interpreter: { kind: "file", bytes: bytes.length, sha256: sha256(bytes) }, identity, run };
};

/**
 * Execute the unchanged independent caller before and after relocation.
 *
 * @param options - Original archive, receipt and exact interpreter selection.
 * @param options.minor - Python floor, checked against the actual process.
 * @param options.command - Absolute interpreter path.
 * @param options.route - Ordinary or reviewed parameter labels.
 * @param options.mode - Full or constructor-free result-only API.
 * @param options.root - Fresh consumer directory.
 * @param options.archive - Original verified wheel.
 * @param options.artifact - Package-set wheel size and digest.
 * @param options.receiptBytes - Exact original wheel receipt bytes.
 * @param options.output - Original-record destination.
 * @param options.genericCompositions - Exercise the closed generic composition surface.
 */
export const installNominalSubtypePython = async ({ minor, command, route, mode, root, archive, artifact, receiptBytes, output, genericCompositions = false }) => {
	assert.ok(nominalSubtypePythonModes.includes(mode));
	assert.equal(typeof genericCompositions, "boolean");
	if(genericCompositions) assert.equal(mode, "full");
	await assert.rejects(access(root), { code: "ENOENT" }); await mkdir(root, { recursive: true });
	const interpreter = await probeNominalSubtypePython(minor, command, root);
	const source = genericCompositions
		? await genericSubtypeLanguageCaller("python", route)
		: await nominalSubtypePythonCaller(route);
	const args = ["consumer.py", ...!genericCompositions && mode === "result-only" ? ["--result-only"] : []];
	await saveLakeFile(root, "consumer.py", source);
	const verifyArchive = async () => {
		const bytes = await readFile(archive); assert.equal(bytes.length, artifact.bytes); assert.equal(sha256(bytes), artifact.sha256);
	};
	await verifyArchive();
	const member = await runCopied("/usr/bin/unzip", ["-p", archive, nominalSubtypePythonReceipt], root);
	assert.equal(member.stderr, ""); assert.equal(member.stdout, receiptBytes.toString());
	const baseline = await createFinContainerEdgePythonEnvironment({ baseCommand: command, venv: join(root, "venv"), cwd: root });
	assert.equal(baseline.python, interpreter.identity.python); assert.deepEqual(baseline.interpreter, interpreter.interpreter);
	await saveLakeFile(output, "baseline.json", canonicalJson(baseline));
	const cache = await mkdtemp(join(root, ".nominal-python-pip-bytecode-")); let install;
	try
	{
		assert.deepEqual(await readdir(cache), []); await verifyFinContainerEdgePythonEnvironment(baseline);
		const arguments_ = [
			...finContainerEdgePythonFlags(cache), "-m", "pip", "--isolated", "install"
			, "--no-index", "--no-deps", "--no-cache-dir", "--no-compile", archive];
		const run = await runCopied(join(baseline.venv, "bin/python"), arguments_, root);
		install = { arguments: arguments_, environment: copiedCleanEnvironment, run };
		await saveLakeFile(output, "pip.json", canonicalJson(install));
	}
	finally
	{
		assert.deepEqual(await readdir(cache), []); await rm(cache, { recursive: true });
	}
	await verifyArchive();
	const installed = await attachFinContainerEdgePythonPackage(baseline, { receiptPath: nominalSubtypePythonReceipt, receiptBytes });
	await saveLakeFile(output, "environment.json", canonicalJson(installed));
	const pipMetadata = {};
	for(const name of ["RECORD", "INSTALLER", "REQUESTED", "direct_url.json"])
	{
		const path = `${installed.site}/nominalsubtypes-1.0.0.dist-info/${name}`;
		if(Object.hasOwn(installed.entries, path)) pipMetadata[path] = await readFile(join(installed.venv, path), "utf8");
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
		assert.equal(run.stderr, "");
		const counts = genericCompositions
			? parseGenericSubtypeLanguageResult(run.stdout)
			: parseNominalSubtypePythonResult(run.stdout, mode);
		assert.deepEqual(await verifyFinContainerEdgePythonEnvironment(context), before);
		assert.equal(await readFile(join(location, "consumer.py"), "utf8"), source);
		const observation = { relocated: Boolean(position), arguments: args, environment: copiedCleanEnvironment, run, counts, closure: before };
		observations.push(observation);
		await saveLakeFile(output, `${position ? "relocated" : "installed"}.json`, canonicalJson(observation));
	}
	await verifyArchive();
	const report = { minor, route, mode, interpreter, arguments: args, observations
		, ...genericCompositions ? { genericCompositions: true } : {}
		, consumerSha256: sha256(source), archiveSha256: artifact.sha256
		, baselineSha256: baseline.baselineSha256
		, environmentSha256: installed.expectedSha256
		, receiptSha256: sha256(receiptBytes), offlineInstall: true
		, compilerFreeExecution: true, relocatedInstallation: true
		, installedBytesUnchanged: true, sourceUnchangedAfterReplay: true
		, dispatch: { observed: false, reason: "Separate constructor/source entry probe remains required" } };
	await saveLakeFile(output, "report.json", canonicalJson(report));
	return report;
};
