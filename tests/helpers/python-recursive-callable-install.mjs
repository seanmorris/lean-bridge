/**
 * Execute original recursive callable wheels after producer removal and relocation.
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
import { pythonRecursiveCallableDocumentation } from "./python-recursive-callable-docs.mjs";

const shapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias", "recursive"];
export const pythonRecursiveConsumerNames = [
	"python", "python-values", "python-typed"
	, "python-recursive", "python-recursive-faults", "python-recursive-typed"
	, "python-recursive-invalid", "python-recursive-poison"
	, "python-recursive-lifetimes"];

/**
 * Require failures at every conversion boundary in every callable execution path.
 *
 * @param result - Observations from the original installed adapter in memory.
 */
export const assertPythonRecursiveFaults = result => {
	assert.deepEqual(result.shapes.map(row => row.shape), shapes);
	assert.equal(result.identities, 0);
	assert.ok(result.faults > 5000 && result.clears > 1000 && result.closes > result.faults);
	assert.ok(result.checks > 10000 && result.malformed >= 20);
	for(const row of result.shapes)
	{
		assert.deepEqual(Object.keys(row.paths).sort(), ["callback", "create", "create-call", "held-call", "repeated"]);
		for(const count of Object.values(row.paths)) assert.ok(Number.isSafeInteger(count) && count > 0);
		assert.equal(row.faults, 2 * Object.values(row.paths).reduce((sum, count) => sum + count, 0));
	}
	assert.equal(result.faults, result.shapes.reduce((sum, row) => sum + row.faults, 0));
};

const checkTypes = async (checker, command, root, source) => {
	const check = files => processBuildRunner.capture({ command: checker
		, cwd: root, env: copiedCleanEnvironment, timeoutMs: 30_000
		, args: ["-I", "-c"
			, 'import resource, runpy, sys; resource.setrlimit(resource.RLIMIT_AS, (1024**3, 1024**3)); sys.argv = ["mypy", *sys.argv[1:]]; runpy.run_module("mypy", run_name="__main__")'
			, "--strict", "--no-incremental", "--cache-dir=/dev/null"
			, "--python-executable", command, ...files] });
	const positive = await check(["python-typed.py", "python-recursive-typed.py", "documentation.py"]);
	assert.equal(positive.stderr, ""); assert.equal(positive.stdout.trim(), "Success: no issues found in 3 source files");
	const statements = [
		'api.call_recursive(42, lambda value: value)'
		, 'api.call_recursive(tree, wrong_argument)'
		, 'api.call_recursive(tree, lambda value: 42)'
		, "api.TreeBranch(['wrong'])"
		, "closure(True, 'wrong')"
		, 'value: str = closure(False, tree)'
		, 'api.call_recursive(tree, asynchronous)'
		, 'api.call_nested_alias(seed, lambda rows: [api.Some(42)])'
		, "nested([api.Some('wrong')])"
	];
	const lines = source.split("\n").map(line => line.trim());
	let rejected;
	await assert.rejects(() => check(["python-recursive-invalid.py"]), error => {
		assert.equal(error.details.stderr, "");
		const diagnostics = error.details.stdout.split("\n").filter(line => /^python-recursive-invalid\.py:\d+: error:/u.test(line));
		rejected = statements.map(statement => {
			const line = lines.indexOf(statement) + 1;
			assert.ok(line > 0); assert.equal(lines.lastIndexOf(statement) + 1, line);
			const errors = diagnostics.filter(text => text.startsWith(`python-recursive-invalid.py:${line}:`)).length;
			assert.ok(errors > 0, `Strict checker must reject ${statement}`);
			return { line, statement, errors };
		});
		assert.equal(diagnostics.length, rejected.reduce((sum, entry) => sum + entry.errors, 0));
		assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any|syntax error/iu);
		return true;
	});
	return { rejected, sourceSha256: sha256(source), memoryLimitMiB: 1024, timeoutSeconds: 30, checked: true, executed: true };
};

/**
 * Install original platform wheels with pinned minimum/current typing dependencies.
 *
 * @param options - Producer-free handoff and independently installed tools.
 * @param options.consumer - Task-owned consumer workspace.
 * @param options.handoff - Original package-set handoff, removed before execution.
 * @param options.packages - Verified package-set inventory.
 * @param options.interpreters - Absolute Python 3.11 and 3.12 interpreter paths.
 * @param options.checker - Pinned independent strict mypy environment.
 */
export const installPythonRecursiveCallables = async ({ consumer, handoff, packages, interpreters, checker }) => {
	assert.equal(packages.length, 1);
	const pkg = packages[0]; assert.equal(pkg.ecosystem, "pypi"); assert.equal(pkg.role, "component");
	const artifact = pkg.artifacts[0], archive = join(handoff, artifact.path);
	assert.equal(sha256(await readFile(archive)), artifact.sha256);
	const sources = Object.fromEntries(await Promise.all(pythonRecursiveConsumerNames.map(async name =>
		[name, await readFile(`tests/fixtures/structured-callable-consumers/${name}.py`, "utf8")])));
	const { consumer: documentation } = await pythonRecursiveCallableDocumentation();
	const staged = [];
	for(const [name, python, typingVersion] of [
		["3.11-minimum", interpreters[0], "4.6.0"]
		, ["3.11-current", interpreters[0], "4.16.0"]
		, ["3.12-standard", interpreters[1], "4.16.0"]
	]) {
		const root = join(consumer, name);
		const installation = await installPythonWheel({ root, archive, python, typingVersion });
		assert.ok(installation.python.startsWith(name.slice(0, 4) + "."));
		assert.equal(installation.dependency?.version ?? null, name === "3.12-standard" ? null : typingVersion);
		const site = (await runCopied(installation.command, ["-I", "-B", "-c", 'import sysconfig; print(sysconfig.get_paths()["purelib"])'], root)).stdout.trim();
		assert.ok(site.startsWith(`${root}/venv/`));
		const receiptBytes = await readFile(join(site, "lean_structured/lean_bridge/package-receipt.json"));
		const receipt = JSON.parse(receiptBytes); assert.equal(receipt.kind, "lean-bridge-ordinary-python-package");
		await verifyNativeFiles(site, receipt.files);
		const paths = await nativeArtifactPaths(join(site, "lean_structured"));
		assert.ok(paths.includes("lean_bridge/include/detail/structured-callable-borrows.h"));
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
		const { command: previousCommand, ...runtime } = installation; void previousCommand;
		const execute = async file => {
			const result = await runCopied(command, ["-I", "-B", file], root);
			assert.equal(result.stderr, ""); return result.stdout;
		};
		const publicValues = JSON.parse(await execute("python-recursive.py"));
		assert.ok(publicValues.checks >= 925 && publicValues.calls >= 720 && publicValues.rejected >= 508);
		const acyclic = JSON.parse(await execute("python.py"));
		assert.deepEqual(acyclic.shapes, shapes.slice(0, -1)); assert.ok(acyclic.checks > 30000 && acyclic.calls >= 1500 && acyclic.rejected >= 300);
		const typing = await checkTypes(checker, command, root, sources["python-recursive-invalid"]);
		assert.equal(await execute("python-typed.py"), "");
		assert.equal(await execute("python-recursive-typed.py"), "");
		assert.equal(await execute("documentation.py"), "");
		const faults = JSON.parse(await execute("python-recursive-faults.py")); assertPythonRecursiveFaults(faults);
		const lifetimes = JSON.parse(await execute("python-recursive-lifetimes.py"));
		assert.deepEqual({ ...lifetimes, recycledThreadIds: undefined }, {
			creatorExitRejections: 16, recycledThreadIds: undefined
			, capacity: 4096, overflowRejected: true, replacementUsable: true
			, finalizationReleased: true, identities: 0
		});
		assert.ok(Number.isSafeInteger(lifetimes.recycledThreadIds) && lifetimes.recycledThreadIds >= 0 && lifetimes.recycledThreadIds <= 16);
		assert.equal(await execute("python-recursive-poison.py"), "malformed-output-retires-runtime\n");
		assert.deepEqual(JSON.parse(await execute("python-recursive.py")), publicValues);
		await verifyNativeFiles(site, receipt.files);
		assert.equal(sha256(await readFile(join(site, "lean_structured/lean_bridge/package-receipt.json"))), receiptSha256);
		assert.deepEqual(await nativeArtifactPaths(join(site, "lean_structured")), paths);
		reports.push({ name, ...runtime, public: publicValues, acyclic
			, faults, typing, lifetimes
			, documentation: { sourceSha256: sha256(documentation), checked: true, executed: true }
			, installedFiles: receipt.files, installedReceiptSha256: receiptSha256
			, sourceHashes: Object.fromEntries(Object.entries(sources).map(([name, source]) => [`${name}.py`, sha256(source)]))
			, offlineInstall: true, compilerFreeExecution: true
			, relocatedInstallation: true, producerHandoffRemoved: true
			, repeatExecution: true, installedFilesUnchanged: true
			, malformedOutputRetiresRuntime: true, isolatedInMemoryFaultProbe: true });
		await rm(root, { recursive: true, force: true });
	}
	for(const report of reports.slice(1))
	{
		assert.deepEqual(report.public, reports[0].public);
		assert.deepEqual(report.acyclic, reports[0].acyclic);
		assert.deepEqual(report.faults, reports[0].faults);
	}
	return reports;
};
