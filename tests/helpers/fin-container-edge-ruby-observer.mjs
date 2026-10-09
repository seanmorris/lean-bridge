/**
 * Observe the complete public Ruby consumer against receipt-pinned installed files after relocation.
 * GDB measures real entries without changing Ruby's deep-binding loader or any installed file.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEdgeEntries, finContainerEdgeSourceEntries, finContainerEdgeWireSymbols } from "./fin-container-edge-dispatch.mjs";
import { assertFinContainerEdgeProbeLocation, finContainerEdgeDefinitions, verifyFinContainerEdgeDeployment } from "./fin-container-edge-observer.mjs";
import { assertFinContainerEdgeGdbRun, finContainerEdgeGdbScript, prepareFinContainerEdgeGdb } from "./fin-container-edge-gdb.mjs";
import { finContainerGdbCommand } from "./fin-container-dispatch-gdb.mjs";
import { finContainerEdgeRubyProbe, readFinContainerEdgeRuby } from "./fin-container-edge-ruby.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * The archive consumer already exercises RubyGems discovery. Instrumentation selects that exact
 * verified installed lib directory, checks all loaded module paths and retains the normal loader.
 *
 * @param options - Original archive identity and moved Ruby deployment.
 * @param options.installed - Receipt-verified gem directory after moving the complete installation.
 * @param options.receiptPath - Relative receipt path.
 * @param options.receiptBytes - Authenticated original gem archive member bytes.
 * @param options.expectedModelSha256 - Producer model digest.
 * @param options.probeRoot - New directory outside the installation.
 * @param options.command - Absolute MRI interpreter selected by the original gem consumer.
 */
export const observeFinContainerEdgeRuby = async ({ installed, receiptPath, receiptBytes, expectedModelSha256, probeRoot, command }) => {
	await assertFinContainerEdgeProbeLocation(installed, probeRoot);
	assert.ok(typeof command === "string" && isAbsolute(command) && !command.includes("\0"));
	const options = { installed, receiptPath, receiptBytes, expectedModelSha256 };
	const before = await verifyFinContainerEdgeDeployment(options);
	const modules = ["lib/lean_bridge/fincontainers.rb", "lib/lean_bridge/fincontainers/native.rb", "lib/lean_bridge/native_copied_runtime_v1.rb"];
	for(const path of modules) assert.ok(Object.hasOwn(before.receipt.files, path), `Ruby module is not receipt-pinned: ${path}`);
	assert.equal(before.directory, join(installed, "lib/lean_bridge/fincontainers/native/linux-x64"));
	const definitions = await finContainerEdgeDefinitions(before, { publicWire: true });
	const source = await finContainerEdgeRubyProbe(before.model, before.receipt.component, { installed });
	await mkdir(probeRoot);
	const version = await runCopied(command, ["--disable-gems", "-e", 'puts [RUBY_ENGINE, RUBY_VERSION, RUBY_PLATFORM].join(" ")'], installed, copiedCleanEnvironment);
	assert.equal(version.stderr, ""); assert.match(version.stdout, /^ruby 3\.3\.[0-9]+ x86_64-linux[^\n]*\n$/u);
	const gdbVersion = await runCopied(finContainerGdbCommand, ["--version"], installed, { ...copiedCleanEnvironment, XDG_CACHE_HOME: probeRoot });
	assert.equal(gdbVersion.stderr, ""); assert.match(gdbVersion.stdout, /^GNU gdb /u);
	await saveLakeFile(probeRoot, "public.rb", source);
	const observer = await prepareFinContainerEdgeGdb({
		model: before.model, component: before.receipt.component
		, nativeDirectory: before.directory, libraries: before.libraries
		, probeRoot: join(probeRoot, "gdb"), cwd: probeRoot
		, env: { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1" }
		, argv: ({ record, nonce, configSha256, definerIndices }) => [command, "--disable-gems", "-I", join(installed, "lib"), "public.rb", record, nonce, configSha256, definerIndices.join(",")] });
	const absent = await observer.run({ gdb: false });
	assert.equal(absent.code, 2); assert.equal(absent.stdout, ""); assert.equal(absent.stderr, "edge record is not attached with empty counters\n");
	const run = await observer.run();
	assert.equal(run.code, 0, run.output + run.stderr);
	const observations = readFinContainerEdgeRuby(run.stdout);
	const armed = await assertFinContainerEdgeGdbRun(observer, run, observations);
	const repeat = await observer.run();
	assert.equal(repeat.code, 0, repeat.output + repeat.stderr);
	assert.equal(repeat.stdout, run.stdout, "a fresh Ruby process must repeat every call");
	const again = await assertFinContainerEdgeGdbRun(observer, repeat, readFinContainerEdgeRuby(repeat.stdout));
	assert.notEqual(armed.pid, again.pid); assert.notEqual(run.nonce, repeat.nonce);
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "Ruby observation must not alter installed files");
	return { kind: "fin-container-edge-public-ruby-v1"
		, observed: true, profile: "ruby"
		, caller: "The complete original-plus-edge public Ruby consumer loaded from the verified installed lib directory"
		, instrument: "GDB address breakpoints; normal deep-binding loader unchanged"
		, checks: 14094, measuredCalls: observations.length, observations
		, ruby: version.stdout.trim(), rubySha256: sha256(await readFile(command))
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
		, ...before.identity
		, configIdentity: observer.identity, configSha256: observer.configSha256
		, probeSha256: sha256(source), scriptSha256: sha256(finContainerEdgeGdbScript)
		, stdoutSha256: sha256(run.stdout)
		, runs: await Promise.all([[run, armed], [repeat, again]].map(async ([result, manifest]) => ({
			pid: manifest.pid, nonce: result.nonce, manifest
			, recordSha256: sha256(await readFile(result.record))
			, manifestSha256: sha256(await readFile(result.armed)) })))
		, missingInstrumentRefused: true, installedFilesUnchanged: true
		, runtimeDefinitionsChecked: true, loadedModulesChecked: true
		, repeatedColdProcess: true };
};
