/**
 * Bind Python startup to a fresh, harness-created venv and the original package receipt.
 * The selected base interpreter and its standard library are trusted toolchain inputs.
 * No post-install tree is accepted as a new baseline. Normal site initialization stays enabled.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, readdir, readlink, realpath, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";

const fileIdentity = bytes => ({ kind: "file", bytes: bytes.length, sha256: sha256(bytes) });
const safePath = path => assert.ok(typeof path === "string" && !/[\\\0\r\n]/u.test(path)
	&& !isAbsolute(path) && path.split("/").every(part => part && part !== "." && part !== ".."), `unsafe Python closure path: ${path}`);
const freezeEntries = entries => Object.freeze(Object.fromEntries(Object.entries(entries).map(([path, entry]) => [path, Object.freeze(entry)])));

/**
 * Keep site initialization but redirect all bytecode reads to a fresh, empty prefix.
 *
 * @param cache - Absolute, exclusively owned empty directory.
 */
export const finContainerEdgePythonFlags = cache => {
	assert.ok(isAbsolute(cache) && !cache.includes("\0"));
	return ["-I", "-B", "-X", `pycache_prefix=${cache}`];
};

const inventory = async (root, prefix = "", entries = Object.create(null)) => {
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		safePath(path);
		if(entry.isDirectory())
		{
			entries[path] = { kind: "directory" }; await inventory(root, path, entries);
		}
		else if(entry.isFile()) entries[path] = fileIdentity(await readFile(join(root, path)));
		else if(entry.isSymbolicLink()) entries[path] = { kind: "symlink", target: await readlink(join(root, path)) };
		else assert.fail(`unsupported Python environment entry: ${path}`);
	}
	return entries;
};

const runUncached = async (command, args, cwd, environment) => {
	const cache = await mkdtemp(join(cwd, ".fin-edge-python-bytecode-"));
	try
	{
		assert.deepEqual(await readdir(cache), []);
		try
		{ return await runCopied(command, [...finContainerEdgePythonFlags(cache), ...args], cwd, environment); }
		finally
		{ assert.deepEqual(await readdir(cache), [], "Python must not write the isolated bytecode cache"); }
	}
	finally
	{ await rm(cache, { recursive: true, force: true }); }
};

/**
 * Create a new venv before any package is present and record the exact trusted bootstrap output.
 *
 * @param options - Selected interpreter and exclusively owned new venv location.
 * @param options.baseCommand - Absolute trusted base Python executable.
 * @param options.venv - New venv path; any existing entry is refused.
 * @param options.cwd - Existing directory outside the venv for process and temporary-cache files.
 * @param options.withPip - Include the interpreter's bundled pip; false is only for source fixtures.
 */
export const createFinContainerEdgePythonEnvironment = async ({ baseCommand, venv, cwd, withPip = true }) => {
	assert.ok(isAbsolute(baseCommand) && isAbsolute(venv));
	assert.equal(typeof withPip, "boolean");
	await assert.rejects(lstat(venv), { code: "ENOENT" }, "refuse any pre-existing Python environment");
	const binary = await realpath(baseCommand), interpreter = fileIdentity(await readFile(binary));
	const version = await runUncached(binary, ["-S", "-c", "import sys; print(sys.version.split()[0])"], cwd, copiedCleanEnvironment);
	assert.equal(version.stderr, ""); assert.match(version.stdout, /^3\.(?:1[1-9]|[2-9][0-9])\.[0-9]+\n$/u);
	await runUncached(binary, ["-S", "-m", "venv", ...(withPip ? [] : ["--without-pip"]), venv], cwd, copiedCleanEnvironment);
	assert.equal(await realpath(venv), resolve(venv));
	const python = version.stdout.trim(), site = `lib/python${python.split(".").slice(0, 2).join(".")}/site-packages`;
	const config = await readFile(join(venv, "pyvenv.cfg"), "utf8");
	assert.match(config, /^include-system-site-packages = false$/mu);
	assert.equal(await realpath(join(venv, "bin/python")), binary);
	assert.equal(await realpath(join(venv, site)), join(venv, site));
	const entries = freezeEntries(await inventory(venv)), baselineSha256 = sha256(canonicalJson(entries));
	const context = Object.freeze({ venv, site, python, binary
		, interpreter: Object.freeze(interpreter)
		, entries, baselineSha256, expectedSha256: baselineSha256 });
	await verifyFinContainerEdgePythonEnvironment(context);
	return context;
};

/**
 * Check all environment files, directories and links without starting the interpreter.
 *
 * @param context - Original in-memory baseline, or that baseline plus an authenticated package.
 */
export const verifyFinContainerEdgePythonEnvironment = async context => {
	assert.equal(await realpath(context.venv), resolve(context.venv), "Python venv must not traverse a symlink");
	assert.equal(await realpath(join(context.venv, "bin/python")), context.binary, "Python interpreter target drift");
	assert.deepEqual(fileIdentity(await readFile(context.binary)), context.interpreter, "Python interpreter bytes drift");
	assert.equal(sha256(canonicalJson(context.entries)), context.expectedSha256, "Python environment inventory drift");
	const actual = await inventory(context.venv);
	assert.deepEqual(Object.keys(actual).sort(), Object.keys(context.entries).sort(), "unrecorded or missing Python environment entry");
	for(const [path, expected] of Object.entries(context.entries))
		assert.deepEqual(actual[path], expected, `Python environment drift: ${path}`);
	return { baselineSha256: context.baselineSha256
		, environmentSha256: context.expectedSha256
		, interpreterSha256: context.interpreter.sha256, python: context.python };
};

const addFile = (entries, path, identity) => {
	safePath(path); assert.ok(!Object.hasOwn(entries, path), `package must not replace bootstrap input: ${path}`);
	entries[path] = identity;
	for(let parent = dirname(path); parent !== "."; parent = dirname(parent))
	{
		if(Object.hasOwn(entries, parent)) assert.equal(entries[parent].kind, "directory");
		else entries[parent] = { kind: "directory" };
	}
};

/**
 * Add only receipt-authenticated files and named non-executable pip metadata to the bootstrap closure.
 * Source tests may attach an explicitly synthetic receipt to a no-pip venv through the same check.
 *
 * @param context - Pre-install baseline, never a post-install recapture.
 * @param options - Receipt already authenticated against the original wheel, or marked source fixture.
 * @param options.receiptPath - Receipt path relative to site-packages.
 * @param options.receiptBytes - Exact original receipt bytes.
 */
export const attachFinContainerEdgePythonPackage = async (context, { receiptPath, receiptBytes }) => {
	assert.equal(context.expectedSha256, context.baselineSha256, "attach a Python package only once");
	safePath(receiptPath);
	const installed = join(context.venv, context.site), bytes = Buffer.from(receiptBytes), receipt = JSON.parse(bytes);
	assert.deepEqual(await readFile(join(installed, receiptPath)), bytes, "Python receipt must equal the original archive member");
	await verifyNativeFiles(installed, receipt.files);
	const entries = structuredClone(context.entries);
	for(const [path, value] of Object.entries(receipt.files)) addFile(entries, `${context.site}/${path}`, { kind: "file", ...value });
	addFile(entries, `${context.site}/${receiptPath}`, fileIdentity(bytes));
	const metadata = Object.keys(receipt.files).filter(path => /^[A-Za-z0-9_.+-]+\.dist-info\/METADATA$/u.test(path));
	assert.ok(metadata.length <= 1, "one component distribution at most");
	if(metadata.length) for(const name of ["RECORD", "INSTALLER", "REQUESTED", "direct_url.json"])
	{
		const path = `${dirname(metadata[0])}/${name}`;
		if(Object.hasOwn(receipt.files, path)) continue;
		try
		{
			assert.ok((await lstat(join(installed, path))).isFile(), `pip metadata must be a regular file: ${path}`);
			addFile(entries, `${context.site}/${path}`, fileIdentity(await readFile(join(installed, path))));
		}
		catch(error)
		{ if(error.code !== "ENOENT") throw error; }
	}
	const attached = Object.freeze({ ...context, entries: freezeEntries(entries)
		, expectedSha256: sha256(canonicalJson(entries))
		, receiptSha256: sha256(bytes) });
	await verifyFinContainerEdgePythonEnvironment(attached);
	return attached;
};

/**
 * Run with normal site initialization, isolated imports and an empty bytecode prefix, checking both sides.
 *
 * @param context - Authenticated environment, with its current venv path after any relocation.
 * @param args - Program, -c or -m arguments, without interpreter flags that could change this policy.
 * @param cwd - Existing working directory outside the venv.
 * @param environment - Explicit subprocess environment, optionally including the entry instrument.
 */
export const runFinContainerEdgePython = async (context, args, cwd, environment = copiedCleanEnvironment) => {
	assert.ok(args.length && (args[0] === "-c" || args[0] === "-m" || !args[0].startsWith("-")));
	const location = relative(await realpath(context.venv), await realpath(cwd));
	assert.ok(location === ".." || location.startsWith("../") || isAbsolute(location), "Python working directory must be outside the venv");
	await verifyFinContainerEdgePythonEnvironment(context);
	try
	{ return await runUncached(join(context.venv, "bin/python"), args, cwd, environment); }
	finally
	{ await verifyFinContainerEdgePythonEnvironment(context); }
};

/**
 * Install with normal pip before the first package-influenced Python startup, then freeze its allowed inputs.
 *
 * @param options - Original wheel and independently selected toolchain.
 * @param options.baseCommand - Trusted interpreter used to create the fresh environment.
 * @param options.root - Existing consumer directory, with a not-yet-created venv child.
 * @param options.archive - Original wheel path.
 * @param options.archiveSha256 - Package-set digest of that wheel.
 */
export const installFinContainerEdgePython = async ({ baseCommand, root, archive, archiveSha256 }) => {
	assert.equal(sha256(await readFile(archive)), archiveSha256, "original Python wheel drift");
	const receiptPath = "lean_fincontainers/lean_bridge/package-receipt.json";
	const member = await runCopied("/usr/bin/unzip", ["-p", archive, receiptPath], root);
	assert.equal(member.stderr, "");
	const context = await createFinContainerEdgePythonEnvironment({ baseCommand, venv: join(root, "venv"), cwd: root });
	await verifyFinContainerEdgePythonEnvironment(context);
	await runUncached(join(context.venv, "bin/python"), ["-m", "pip", "--isolated", "install", "--no-index", "--no-deps", "--no-cache-dir", "--no-compile", archive], root, copiedCleanEnvironment);
	assert.equal(sha256(await readFile(archive)), archiveSha256, "Python wheel must not change during installation");
	const installed = await attachFinContainerEdgePythonPackage(context, { receiptPath, receiptBytes: member.stdout });
	return { context: installed, run: (args, cwd, environment) => runFinContainerEdgePython(installed, args, cwd, environment) };
};
