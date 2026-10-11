/**
 * Observe both PHP caller modes through the receipt-pinned, guarded Composer installation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEdgeEntries, finContainerEdgeSourceEntries, finContainerEdgeWireSymbols } from "./fin-container-edge-dispatch.mjs";
import { assertFinContainerEdgeProbeLocation, finContainerEdgeDefinitions, verifyFinContainerEdgeDeployment } from "./fin-container-edge-observer.mjs";
import { assertFinContainerEdgeGdbRun, finContainerEdgeGdbScript, prepareFinContainerEdgeGdb } from "./fin-container-edge-gdb.mjs";
import { finContainerGdbCommand } from "./fin-container-dispatch-gdb.mjs";
import { finContainerEdgePhpProbe, readFinContainerEdgePhp } from "./fin-container-edge-php.mjs";
import { verifyFinContainerEdgePhpEnvironment } from "./fin-container-edge-php-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Run every original assertion in weak and strict modes, twice each in fresh processes.
 *
 * @param options - Original archive identity and moved Composer deployment.
 * @param options.installed - Verified installed package directory.
 * @param options.receiptPath - Relative original receipt path.
 * @param options.receiptBytes - Authenticated original ZIP member, not a reconstructed receipt.
 * @param options.expectedModelSha256 - Producer model digest.
 * @param options.probeRoot - Fresh directory outside the installed package.
 * @param options.phpEnvironment - Original archive/dependency/tool identities from the guarded installer.
 */
export const observeFinContainerEdgePhp = async ({ installed, receiptPath, receiptBytes, expectedModelSha256, probeRoot, phpEnvironment }) => {
	await assertFinContainerEdgeProbeLocation(installed, probeRoot);
	assert.ok(phpEnvironment, "PHP observation requires the original guarded Composer environment");
	assert.equal(installed, join(phpEnvironment.root, "vendor", phpEnvironment.name));
	assert.deepEqual(Buffer.from(receiptBytes), Buffer.from(phpEnvironment.receiptBytes));
	const options = { installed, receiptPath, receiptBytes, expectedModelSha256, exactFileClosure: true };
	const check = async () => {
		await verifyFinContainerEdgePhpEnvironment(phpEnvironment);
		return verifyFinContainerEdgeDeployment(options);
	};
	const before = await check(), { command, runtimeFlags } = phpEnvironment;
	const modules = ["src/Api.php", "src/Internal/Native.php", "src/Internal/Runtime.php"];
	for(const path of modules) assert.ok(Object.hasOwn(before.receipt.files, path), `PHP module is not receipt-pinned: ${path}`);
	assert.equal(before.directory, join(installed, "native/linux-x64"));
	const definitions = await finContainerEdgeDefinitions(before, { publicWire: true });
	await mkdir(probeRoot);
	const version = await runCopied(command, [...runtimeFlags, "-r", "echo PHP_VERSION, ' ', PHP_SAPI, ' ', PHP_ZTS, ' ', PHP_INT_SIZE, PHP_EOL;"], installed, copiedCleanEnvironment);
	assert.equal(version.stderr, ""); assert.match(version.stdout, /^8\.[2-9]\.[0-9]+ cli 0 8\n$/u);
	const gdbVersion = await runCopied(finContainerGdbCommand, ["--version"], installed, { ...copiedCleanEnvironment, XDG_CACHE_HOME: probeRoot });
	assert.equal(gdbVersion.stderr, ""); assert.match(gdbVersion.stdout, /^GNU gdb /u);
	const modes = [], observations = [];
	for(const mode of ["weak", "strict"])
	{
		const source = await finContainerEdgePhpProbe(before.model, before.receipt.component, { installed, autoload: join(phpEnvironment.root, "vendor/autoload.php") }, mode);
		await saveLakeFile(probeRoot, `${mode}.php`, source);
		const observer = await prepareFinContainerEdgeGdb({
			model: before.model, component: before.receipt.component
			, nativeDirectory: before.directory, libraries: before.libraries
			, probeRoot: join(probeRoot, `gdb-${mode}`), cwd: probeRoot
			, env: { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1" }
			, argv: ({ record, nonce, configSha256, definerIndices }) => [command, ...runtimeFlags, `${mode}.php`, record, nonce, configSha256, definerIndices.join(",")] });
		const runObserved = async settings => {
			await check();
			try
			{ return await observer.run(settings); }
			finally
			{ await check(); }
		};
		const absent = await runObserved({ gdb: false });
		assert.equal(absent.code, 2); assert.equal(absent.stdout, ""); assert.equal(absent.stderr, "edge record is not attached with empty counters\n");
		const run = await runObserved();
		assert.equal(run.code, 0, run.output + run.stderr);
		const rows = readFinContainerEdgePhp(run.stdout);
		const armed = await assertFinContainerEdgeGdbRun(observer, run, rows);
		const repeat = await runObserved();
		assert.equal(repeat.code, 0, repeat.output + repeat.stderr);
		assert.equal(repeat.stdout, run.stdout, "a fresh PHP process must repeat every call");
		const again = await assertFinContainerEdgeGdbRun(observer, repeat, readFinContainerEdgePhp(repeat.stdout));
		assert.notEqual(armed.pid, again.pid); assert.notEqual(run.nonce, repeat.nonce);
		if(mode === "weak") observations.push(...rows);
		else assert.deepEqual(rows, observations, "strictness must preserve every call and rejection");
		modes.push({ mode, checks: 14089, measuredCalls: rows.length
			, configIdentity: observer.identity, configSha256: observer.configSha256
			, probeSha256: sha256(source), stdoutSha256: sha256(run.stdout)
			, runs: await Promise.all([[run, armed], [repeat, again]].map(async ([result, manifest]) => ({
				pid: manifest.pid, nonce: result.nonce, manifest
				, recordSha256: sha256(await readFile(result.record))
				, manifestSha256: sha256(await readFile(result.armed)) }))) });
	}
	assert.deepEqual(await check(), before, "PHP observation must not alter installed files");
	return { kind: "fin-container-edge-public-php-v1"
		, observed: true, profile: "php-native"
		, caller: "The complete original-plus-edge public PHP consumer through the guarded Composer autoloader, in weak and strict modes"
		, instrument: "GDB address breakpoints; normal native loader unchanged"
		, checks: 14089, measuredCalls: observations.length, observations, modes
		, php: version.stdout.trim(), phpSha256: sha256(await readFile(command))
		, gdb: gdbVersion.stdout.split("\n")[0]
		, gdbSha256: sha256(await readFile(finContainerGdbCommand))
		, componentId: before.model.component.id, columns: before.columns
		, measuredAdapters: finContainerEdgeEntries.map(name => `FinContainers.${name}`)
		, measuredSources: finContainerEdgeSourceEntries.map(name => `FinContainers.${name}`)
		, sourceFunctionsNotMeasured: finContainerEdgeEntries.filter(name => !finContainerEdgeSourceEntries.includes(name)).map(name => `FinContainers.${name}`)
		, publicSymbols: finContainerEdgeWireSymbols
		, packageDirectory: installed, libraryDirectory: before.directory
		, libraries: before.libraries
		, definitions: Object.fromEntries(Object.entries(definitions).map(([symbol, path]) => [symbol, basename(path)]))
		, moduleDigests: Object.fromEntries(modules.map(path => [path, before.receipt.files[path].sha256]))
		, ...before.identity, phpEnvironment: await verifyFinContainerEdgePhpEnvironment(phpEnvironment)
		, scriptSha256: sha256(finContainerEdgeGdbScript)
		, missingInstrumentRefused: true, installedFilesUnchanged: true
		, runtimeDefinitionsChecked: true, loadedModulesChecked: true
		, repeatedColdProcess: true };
};
