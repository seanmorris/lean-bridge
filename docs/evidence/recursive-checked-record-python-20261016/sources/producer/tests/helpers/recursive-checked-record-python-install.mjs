/**
 * Install one original recursive wheel offline in a fresh venv, replay the unchanged
 * caller, then physically move the consumer and replay it again compiler-free.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, lstat, mkdir, readFile, readdir, readlink, realpath, rename } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { installPythonWheel, pythonTypingWheels } from "./python-wheel-install.mjs";
import {
	loadRecursiveCheckedRecordPythonCaller, parseRecursiveCheckedRecordPythonResult
	, recursiveCheckedRecordPythonCallerArgs, recursiveCheckedRecordPythonFixtures
	, recursiveCheckedRecordPythonMinors, recursiveCheckedRecordPythonPackage
} from "./recursive-checked-record-python-fixture.mjs";

/** Interpreter and declared typing_extensions selections for each installed wheel. */
export const recursiveCheckedRecordPythonInstalls = Object.freeze([
	Object.freeze({ name: "3.11-minimum", minor: "3.11", typingVersion: "4.6.0" })
	, Object.freeze({ name: "3.11-current", minor: "3.11", typingVersion: "4.16.0" })
	, Object.freeze({ name: "3.12-standard", minor: "3.12", typingVersion: null })
]);

/**
 * Bind the selected floor to the actual executable before compiling packages.
 *
 * @param minor - Independently selected supported Python minor.
 * @param command - Explicit absolute interpreter path.
 * @param cwd - Existing task directory.
 */
export const probeRecursiveCheckedRecordPython = async (minor, command, cwd) => {
	assert.ok(recursiveCheckedRecordPythonMinors.includes(minor)); assert.ok(isAbsolute(command));
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
 * Inventory every venv entry so replays and relocation provably change no installed byte.
 *
 * @param venv - Consumer-owned venv root.
 */
export const recursiveCheckedRecordPythonVenvInventory = async venv => {
	const entries = {};
	const walk = async directory => {
		const children = await readdir(directory, { withFileTypes: true });
		children.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
		for(const entry of children)
		{
			const path = join(directory, entry.name), key = relative(venv, path);
			if(entry.isSymbolicLink()) entries[key] = { kind: "symlink", target: await readlink(path) };
			else if(entry.isDirectory())
			{
				entries[key] = { kind: "directory" };
				await walk(path);
			}
			else
			{
				assert.ok(entry.isFile(), `Unexpected venv entry: ${key}`);
				const bytes = await readFile(path), mode = (await lstat(path)).mode & 0o777;
				entries[key] = { kind: "file", bytes: bytes.length, sha256: sha256(bytes), mode };
			}
		}
	};
	await walk(venv);
	return entries;
};

/**
 * Execute the unchanged independent caller before and after relocation.
 *
 * @param options - Original archive, receipt and exact interpreter selection.
 * @param options.selection - One recursiveCheckedRecordPythonInstalls entry.
 * @param options.command - Absolute interpreter path for its minor.
 * @param options.route - Ordinary or reviewed author route, recorded only.
 * @param options.fixture - Recursive or mutual module.
 * @param options.root - Fresh consumer directory.
 * @param options.archive - Original verified wheel.
 * @param options.artifact - Package-set wheel size and digest.
 * @param options.receiptBytes - Exact original wheel receipt bytes.
 * @param options.output - Original-record destination.
 */
export const installRecursiveCheckedRecordPython = async ({ selection, command, route, fixture, root, archive, artifact, receiptBytes, output }) => {
	assert.ok(recursiveCheckedRecordPythonInstalls.includes(selection));
	assert.ok(recursiveCheckedRecordPythonFixtures.includes(fixture));
	await assert.rejects(access(root), { code: "ENOENT" }); await mkdir(root, { recursive: true });
	const interpreter = await probeRecursiveCheckedRecordPython(selection.minor, command, root);
	const source = await loadRecursiveCheckedRecordPythonCaller();
	const args = ["-I", "-B", "consumer.py", ...recursiveCheckedRecordPythonCallerArgs(fixture)];
	await saveLakeFile(root, "consumer.py", source);
	const verifyArchive = async () => {
		const bytes = await readFile(archive); assert.equal(bytes.length, artifact.bytes); assert.equal(sha256(bytes), artifact.sha256);
	};
	await verifyArchive();
	const { moduleName } = recursiveCheckedRecordPythonPackage(fixture);
	const member = await runCopied("/usr/bin/unzip", ["-p", archive, `${moduleName}/lean_bridge/package-receipt.json`], root);
	assert.equal(member.stderr, ""); assert.equal(member.stdout, receiptBytes.toString());
	const install = await installPythonWheel({
		root, archive, python: interpreter.binary
		, typingVersion: selection.typingVersion ?? "4.16.0"
	});
	assert.equal(install.python, interpreter.identity.python);
	assert.deepEqual(install.requires, ['typing_extensions (<5,>=4.6); python_version < "3.12"']);
	if(selection.typingVersion === null) assert.equal(install.dependency, null);
	else assert.deepEqual(install.dependency, {
		name: "typing_extensions", version: selection.typingVersion
		, archive: `typing_extensions-${selection.typingVersion}-py3-none-any.whl`
		, bytes: install.dependency.bytes
		, sha256: pythonTypingWheels[selection.typingVersion]
	});
	await saveLakeFile(output, "pip-install.json", await readFile(join(root, "pip-install.json")));
	await saveLakeFile(output, "install.json", canonicalJson(install));
	await verifyArchive();
	const inventory = await recursiveCheckedRecordPythonVenvInventory(join(root, "venv"));
	const inventorySha256 = sha256(canonicalJson(inventory));
	await saveLakeFile(output, "environment.json", canonicalJson(inventory));
	const observations = [];
	for(const [position, location] of [root, root + "-relocated"].entries())
	{
		if(position)
		{ await rename(root, location); await assert.rejects(access(root), { code: "ENOENT" }); }
		const venv = join(location, "venv");
		assert.equal(sha256(canonicalJson(await recursiveCheckedRecordPythonVenvInventory(venv))), inventorySha256);
		assert.equal(await readFile(join(location, "consumer.py"), "utf8"), source);
		const run = await runCopied(join(venv, "bin/python"), args, location, copiedCleanEnvironment);
		await saveLakeFile(output, `${position ? "relocated" : "installed"}-process.json`, canonicalJson(run));
		assert.equal(run.stderr, ""); const counts = parseRecursiveCheckedRecordPythonResult(run.stdout, fixture);
		assert.equal(sha256(canonicalJson(await recursiveCheckedRecordPythonVenvInventory(venv))), inventorySha256
			, "Replay leaves every installed byte unchanged");
		assert.equal(await readFile(join(location, "consumer.py"), "utf8"), source);
		const observation = {
			relocated: Boolean(position), arguments: args
			, environment: copiedCleanEnvironment, run, counts, inventorySha256
		};
		observations.push(observation);
		await saveLakeFile(output, `${position ? "relocated" : "installed"}.json`, canonicalJson(observation));
	}
	await verifyArchive();
	const report = {
		selection: selection.name, minor: selection.minor
		, typingVersion: selection.typingVersion
		, route, fixture, interpreter, arguments: args, observations
		, consumerSha256: sha256(source), archiveSha256: artifact.sha256
		, dependency: install.dependency, inventorySha256
		, receiptSha256: sha256(receiptBytes), offlineInstall: true
		, compilerFreeExecution: true, relocatedInstallation: true
		, installedBytesUnchanged: true, sourceUnchangedAfterReplay: true
	};
	await saveLakeFile(output, "report.json", canonicalJson(report));
	return report;
};
