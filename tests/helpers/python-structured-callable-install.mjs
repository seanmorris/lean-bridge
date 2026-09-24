/**
 * Execute original structured callback wheels from relocated, compiler-free installs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, rename, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { installPythonWheel } from "./python-wheel-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const shapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias"];
export const pythonStructuredInvalidCalls = {
	argument: 'api.call_array([1], lambda value: value)'
	, "callback-argument": 'def wrong(value: str) -> tuple[api.Option[str], ...]:\n    return ()\napi.call_array([], wrong)'
	, "callback-result": 'api.call_array([], lambda value: 42)'
	, "nested-option": 'api.call_option(api.Some(api.Some(1)), lambda value: value)'
	, "list-payload": 'api.call_list([api.Ok((1, b"wrong"))], lambda value: value)'
	, "result-payload": 'api.call_result(api.Err([1]), lambda value: value)'
	, "tuple-payload": 'api.call_tuple(("a", ("wrong", 1)), lambda value: value)'
	, "record-payload": 'api.call_record(api.Payload("a", [api.Some(1)], 0, None), lambda value: value)'
	, "variant-payload": 'api.call_variant(api.PacketPayload("a", [api.Some(1)]), lambda value: value)'
	, "alias-payload": 'api.call_alias(api.Payload("a", [], "wrong", None), lambda value: value)'
	, "closure-argument": 'with api.make_array([]) as closure:\n    closure(False, [1])'
	, "closure-result": 'with api.make_array([]) as closure:\n    result: list[api.Option[str]] = closure(False, [])'
	, "async-callback": 'async def wrong(value: tuple[api.Option[str], ...]) -> tuple[api.Option[str], ...]:\n    return value\napi.call_array([], wrong)'
};

/**
 * Require every shape and every fault path, not just an aggregate success marker.
 *
 * @param value - Parsed stdout from the isolated installed failure probe.
 */
export const assertPythonStructuredFaults = value => {
	assert.deepEqual(value.shapes.map(item => item.shape), shapes);
	assert.ok(value.checks > 1000 && value.faults > 1000 && value.clears > 1000 && value.closes > 1000);
	assert.ok(value.malformed >= 10);
	for(const shape of value.shapes)
	{
		assert.deepEqual(Object.keys(shape.paths).sort(), ["callback", "create", "create-call", "held-call", "repeated"]);
		for(const count of Object.values(shape.paths)) assert.ok(Number.isSafeInteger(count) && count > 0);
		assert.equal(shape.faults, 2 * Object.values(shape.paths).reduce((a, b) => a + b, 0));
	}
	assert.equal(value.faults, value.shapes.reduce((sum, item) => sum + item.faults, 0));
};

const checkTypes = async (checker, command, root) => {
	const files = Object.keys(pythonStructuredInvalidCalls).map(name => `invalid-${name}.py`);
	for(const [name, source] of Object.entries(pythonStructuredInvalidCalls))
		await saveLakeFile(root, `invalid-${name}.py`, `import lean_structured as api\n${source}\n`);
	const check = args => processBuildRunner.capture({ command: checker
		, cwd: root, env: copiedCleanEnvironment, timeoutMs: 30_000
		, args: ["-I", "-c"
			, 'import resource, runpy, sys; resource.setrlimit(resource.RLIMIT_AS, (1024**3, 1024**3)); sys.argv = ["mypy", *sys.argv[1:]]; runpy.run_module("mypy", run_name="__main__")'
			, "--strict", "--no-incremental", "--cache-dir=/dev/null"
			, "--python-executable", command, ...args] });
	const positive = await check(["python-typed.py", "documentation.py"]);
	assert.equal(positive.stderr, ""); assert.equal(positive.stdout.trim(), "Success: no issues found in 2 source files");
	let rejected;
	await assert.rejects(() => check(files), error => {
		assert.equal(error.details.stderr, "");
		const diagnostics = error.details.stdout.split("\n").filter(line => /^invalid-.*\.py:\d+: error:/.test(line));
		rejected = Object.entries(pythonStructuredInvalidCalls).map(([name, source]) => {
			const errors = diagnostics.filter(line => line.startsWith(`invalid-${name}.py:`));
			assert.ok(errors.length > 0, `Strict checker must reject ${name} at its own call site`);
			return { name, errors: errors.length, sourceSha256: sha256(`import lean_structured as api\n${source}\n`) };
		});
		assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any|syntax error/i);
		assert.equal(diagnostics.length, rejected.reduce((sum, item) => sum + item.errors, 0));
		return true;
	});
	return { rejected, memoryLimitMiB: 1024, timeoutSeconds: 30, checked: true, executed: true };
};

/**
 * Install and verify the wheel on both supported standard Python branches.
 *
 * @param options - Verified archives, independent interpreters and pinned checker.
 * @param options.consumer - Task-owned consumer root.
 * @param options.handoff - Original package-set handoff, removed before execution.
 * @param options.packages - Original package inventory.
 * @param options.interpreters - Absolute Python 3.11 and 3.12 executables.
 * @param options.checker - Pinned independent mypy interpreter.
 */
export const installPythonStructuredCallables = async ({ consumer, handoff, packages, interpreters, checker }) => {
	assert.equal(packages.length, 1);
	const pkg = packages[0]; assert.equal(pkg.ecosystem, "pypi"); assert.equal(pkg.role, "component");
	const artifact = pkg.artifacts[0], archive = join(handoff, artifact.path);
	assert.equal(sha256(await readFile(archive)), artifact.sha256);
	const sources = Object.fromEntries(await Promise.all(["python", "python-values", "python-typed", "python-faults"]
		.map(async name => [name, await readFile(`tests/fixtures/structured-callable-consumers/${name}.py`, "utf8")])));
	const guide = await readFile("docs/consume/python.md", "utf8");
	const documentation = guide.match(/### Structured callback values\n[\s\S]*?```python\n([\s\S]*?)\n```/)?.[1];
	assert.ok(documentation, "Execute the exact published structured Python example");
	const staged = [];
	for(const [index, python] of interpreters.entries())
	{
		const name = index === 0 ? "3.11" : "3.12", root = join(consumer, name);
		const installation = await installPythonWheel({ root, archive, python });
		assert.ok(installation.python.startsWith(name + "."));
		const site = (await runCopied(installation.command, ["-I", "-B", "-c", 'import sysconfig; print(sysconfig.get_paths()["purelib"])'], root)).stdout.trim();
		assert.ok(site.startsWith(`${root}/venv/`));
		const receiptBytes = await readFile(join(site, "lean_structured/lean_bridge/package-receipt.json"));
		const receipt = JSON.parse(receiptBytes); assert.equal(receipt.kind, "lean-bridge-ordinary-python-package");
		await verifyNativeFiles(site, receipt.files);
		const paths = await nativeArtifactPaths(join(site, "lean_structured"));
		for(const [name, source] of Object.entries(sources)) await saveLakeFile(root, `${name}.py`, source);
		await saveLakeFile(root, "documentation.py", documentation + "\n");
		const relocated = join(consumer, name + "-relocated"); await rename(root, relocated);
		staged.push({ name, root: relocated, installation, receipt, paths
			, receiptSha256: sha256(receiptBytes)
			, command: join(relocated, relative(root, installation.command))
			, site: join(relocated, relative(root, site)) });
	}
	await rm(handoff, { recursive: true, force: true });
	const reports = [];
	for(const { name, root, installation, receipt, paths, receiptSha256, command, site } of staged)
	{
		const { command: oldCommand, ...runtime } = installation; void oldCommand;
		const execute = async file => {
			const result = await runCopied(command, ["-I", "-B", file], root);
			assert.equal(result.stderr, ""); return result.stdout;
		};
		const first = JSON.parse(await execute("python.py"));
		assert.deepEqual(first.shapes, shapes); assert.ok(first.checks > 10000 && first.calls >= 1500 && first.rejected > 100);
		const strictTypecheck = await checkTypes(checker, command, root);
		assert.equal(await execute("python-typed.py"), "");
		assert.equal(await execute("documentation.py"), "");
		const faults = JSON.parse(await execute("python-faults.py")); assertPythonStructuredFaults(faults);
		assert.deepEqual(JSON.parse(await execute("python.py")), first);
		await verifyNativeFiles(site, receipt.files);
		assert.equal(sha256(await readFile(join(site, "lean_structured/lean_bridge/package-receipt.json"))), receiptSha256);
		assert.deepEqual(await nativeArtifactPaths(join(site, "lean_structured")), paths);
		reports.push({ name, ...runtime, public: first, faults, strictTypecheck
			, installedFiles: receipt.files, installedReceiptSha256: receiptSha256
			, sourceHashes: Object.fromEntries(Object.entries(sources).map(([name, source]) => [`${name}.py`, sha256(source)]))
			, documentation: { sourceSha256: sha256(documentation), checked: true, executed: true }
			, offlineInstall: true, compilerFreeExecution: true
			, relocatedInstallation: true, producerHandoffRemoved: true
			, repeatExecution: true, installedFilesUnchanged: true
			, isolatedInMemoryFaultProbe: true });
		await rm(root, { recursive: true, force: true });
	}
	assert.deepEqual(reports[0].public, reports[1].public);
	assert.deepEqual(reports[0].faults, reports[1].faults);
	return reports;
};
