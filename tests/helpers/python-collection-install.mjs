/**
 * Verify original collection wheels across Python's standard and backported aliases.
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

const dependencyProgram = `import hashlib, importlib.metadata, importlib.util, json, pathlib, sysconfig
site = pathlib.Path(sysconfig.get_paths()['purelib'])
if importlib.util.find_spec('typing_extensions') is None:
    print('null')
else:
    distribution = importlib.metadata.distribution('typing_extensions')
    files = {}
    for file in distribution.files:
        path = pathlib.Path(distribution.locate_file(file)).resolve()
        assert path.is_relative_to(site) and path.is_file()
        data = path.read_bytes()
        files[str(path.relative_to(site))] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    print(json.dumps({'version': distribution.version, 'files': files}, sort_keys=True))
`;

/**
 * Check installed stubs with bounded strict positive and negative consumers.
 *
 * @param options - Isolated checker and installed package interpreter.
 * @param options.checker - Absolute pinned mypy interpreter.
 * @param options.command - Interpreter whose installed stubs mypy must discover.
 * @param options.root - Consumer directory containing both typing fixtures.
 */
export const checkPythonCollectionTypes = async ({ checker, command, root }) => {
	const check = file => processBuildRunner.capture({
		command: checker
		, cwd: root
		, env: copiedCleanEnvironment
		, timeoutMs: 30_000
		, args: [
			"-I", "-c"
			, 'import resource, runpy, sys; resource.setrlimit(resource.RLIMIT_AS, (1024**3, 1024**3)); sys.argv = ["mypy", *sys.argv[1:]]; runpy.run_module("mypy", run_name="__main__")'
			, "--strict", "--no-incremental", "--cache-dir=/dev/null"
			, "--python-executable", command, file
		]
	});
	const checked = await check("python-typed.py");
	assert.equal(checked.stderr, ""); assert.equal(checked.stdout.trim(), "Success: no issues found in 1 source file");
	let rejectedCalls;
	await assert.rejects(() => check("python-invalid.py"), error => {
		assert.equal(error.details.stderr, "");
		rejectedCalls = error.details.stdout.split("\n").filter(line => /^python-invalid\.py:\d+: error:/.test(line)).length;
		assert.equal(rejectedCalls, 13);
		assert.match(error.details.stdout, /Found 13 errors in 1 file/);
		assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any/); return true;
	});
	return { rejectedCalls, memoryLimitMiB: 1024, timeoutSeconds: 30 };
};

/**
 * Run public, strict-typing and in-memory fault consumers after producer removal.
 *
 * @param options - Original wheel, interpreter selection and private probe layout.
 * @param options.consumer - Task-owned deployment directory.
 * @param options.handoff - Verified original package-set handoff.
 * @param options.packages - Original publisher package entries.
 * @param options.interpreters - Python 3.11 and 3.12 executables, in that order.
 * @param options.checker - Independent pinned mypy interpreter.
 * @param options.projection - Private conversion indices for failure probes only.
 */
export const installPythonCollections = async ({ consumer, handoff, packages, interpreters, checker, projection }) => {
	assert.equal(packages.length, 1);
	const pkg = packages[0]; assert.equal(pkg.ecosystem, "pypi"); assert.equal(pkg.role, "component");
	const artifact = pkg.artifacts[0], archive = join(handoff, artifact.path);
	assert.equal(sha256(await readFile(archive)), artifact.sha256);
	const sources = Object.fromEntries(await Promise.all(["python", "python-hints", "python-typed", "python-invalid", "python-probe"]
		.map(async name => [name, await readFile(`tests/fixtures/collection-consumers/${name}.py`, "utf8")])));
	const staged = [];
	for(const [name, python, typingVersion] of [["3.11-minimum", interpreters[0], "4.6.0"], ["3.11-current", interpreters[0], "4.16.0"], ["3.12-standard", interpreters[1], "4.16.0"]])
	{
		const root = join(consumer, name);
		const installation = await installPythonWheel({ root, archive, python, typingVersion });
		assert.ok(installation.python.startsWith(name.slice(0, 4) + "."));
		assert.equal(installation.requires.length, 1);
		assert.equal(installation.dependency?.version ?? null, name === "3.12-standard" ? null : typingVersion);
		const site = (await runCopied(installation.command, ["-I", "-B", "-c", 'import sysconfig; print(sysconfig.get_paths()["purelib"])'], root)).stdout.trim();
		assert.ok(site.startsWith(`${root}/venv/`));
		const receiptBytes = await readFile(join(site, "lean_collections/lean_bridge/package-receipt.json"));
		const receipt = JSON.parse(receiptBytes);
		assert.equal(receipt.kind, "lean-bridge-ordinary-python-package");
		await verifyNativeFiles(site, receipt.files);
		const dependency = JSON.parse((await runCopied(installation.command, ["-I", "-B", "-c", dependencyProgram], root)).stdout);
		assert.equal(dependency?.version ?? null, installation.dependency?.version ?? null);
		const paths = await nativeArtifactPaths(join(site, "lean_collections"));
		for(const [name, source] of Object.entries(sources)) await saveLakeFile(root, `${name}.py`, source);
		const relocated = join(consumer, name + "-relocated"); await rename(root, relocated);
		staged.push({
			name
			, root: relocated
			, installation
			, receipt
			, dependency
			, paths
			, receiptSha256: sha256(receiptBytes)
			, command: join(relocated, relative(root, installation.command))
			, site: join(relocated, relative(root, site))
		});
	}
	await rm(handoff, { recursive: true, force: true });
	const reports = [];
	for(const { name, root, installation, receipt, dependency, paths, receiptSha256, command, site } of staged)
	{
		const { command: previousCommand, ...runtime } = installation; void previousCommand;
		const execute = async file => {
			const result = await runCopied(command, ["-I", "-B", file], root);
			assert.equal(result.stderr, ""); return JSON.parse(result.stdout);
		};
		const first = await execute("python.py");
		assert.ok(first.checks > 100000 && first.calls > 3000 && first.rejected > 100);
		assert.equal(first.primitives.length, 19); assert.equal(first.recordTypes.length, 7);
		assert.equal(first.loadedLibraries.length, 4);
		for(const { path, ...identity } of first.loadedLibraries) assert.deepEqual(identity, receipt.files[path]);
		const hints = await execute("python-hints.py");
		assert.equal(hints.depth, 24); assert.equal(hints.shallow_primitives, 19); assert.ok(hints.type_hints_ms < 2000);
		const strictTypecheck = await checkPythonCollectionTypes({ checker, command, root });
		await runCopied(command, ["-I", "-B", "python-typed.py"], root);
		const layout = { sequence: projection.surface.copies.find(copy => copy.element?.scalarName === "uint32").index
			, string: projection.surface.copies.find(copy => copy.scalarName === "string").index
			, char: projection.surface.copies.find(copy => copy.scalarName === "char").index };
		const probed = await runCopied(command, ["-I", "-B", "python-probe.py", JSON.stringify(layout)], root);
		assert.equal(probed.stderr, "");
		const faults = JSON.parse(probed.stdout);
		assert.ok(faults.allocationFailures > 20 && faults.conversionFailures > 100);
		assert.equal(faults.partialInputs, 64); assert.equal(faults.malformedValues, 7);
		assert.deepEqual(await execute("python.py"), first);
		await verifyNativeFiles(site, receipt.files);
		assert.equal(sha256(await readFile(join(site, "lean_collections/lean_bridge/package-receipt.json"))), receiptSha256);
		assert.deepEqual(await nativeArtifactPaths(join(site, "lean_collections")), paths);
		assert.deepEqual(JSON.parse((await runCopied(command, ["-I", "-B", "-c", dependencyProgram], root)).stdout), dependency);
		reports.push({
			name
			, ...runtime
			, public: first
			, hints
			, faults
			, installedFiles: receipt.files
			, installedReceiptSha256: receiptSha256
			, installedDependency: dependency
			, strictTypecheck: { ...strictTypecheck, executed: true }
			, sourceHashes: Object.fromEntries(Object.entries(sources).map(([name, source]) => [`${name}.py`, sha256(source)]))
			, offlineInstall: true
			, compilerFreeExecution: true
			, relocatedInstallation: true
			, producerHandoffRemoved: true
			, repeatExecution: true
			, installedFilesUnchanged: true
			, installedDependencyUnchanged: true
			, isolatedInMemoryFaultProbe: true
		});
		await rm(root, { recursive: true, force: true });
	}
	assert.deepEqual(reports[0].public, reports[1].public); assert.deepEqual(reports[0].public, reports[2].public);
	return reports;
};
