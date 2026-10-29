/**
 * Explicit .NET tool identities and isolated host compilation for nominal callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { selectFinContainerEdgeDotnetSdk } from "./fin-container-edge-dotnet-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const nominalSubtypeDotnetBuildFlags = Object.freeze([
	"-noAutoResponse"
	, "-p:ImportDirectoryBuildProps=false"
	, "-p:ImportDirectoryBuildTargets=false"
	, "-p:ImportDirectoryPackagesProps=false"
	, "-p:MSBuildEnableWorkloadResolver=false"
	, "-m:1"
]);
export const nominalSubtypeDotnetEmptyFeeds = '<configuration><packageSources><clear/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>';

/**
 * Do not inherit loader hooks, compiler search paths or shared package caches.
 *
 * @param root - Current isolated working directory.
 * @param command - Canonical selected dotnet host.
 */
export const nominalSubtypeDotnetEnvironment = (root, command) => ({ ...copiedCleanEnvironment
	, DOTNET_ROOT: dirname(command), DOTNET_CLI_HOME: join(root, "dotnet-home")
	, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1"
	, DOTNET_MULTILEVEL_LOOKUP: "0", DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1"
	, DOTNET_CLI_WORKLOAD_UPDATE_NOTIFY_DISABLE: "1"
	, MSBUILDDISABLENODEREUSE: "1"
	, NUGET_PACKAGES: join(root, "packages")
	, NUGET_HTTP_CACHE_PATH: join(root, "http-cache") });

/**
 * Measure the actual host, SDK and framework listing before any package compilation.
 * SDK and shared framework contents remain explicitly trusted toolchains.
 *
 * @param root - Fresh task-owned directory.
 * @param selected - Explicit dotnet executable.
 */
export const selectNominalSubtypeDotnetTools = async (root, selected) => {
	const command = await realpath(selected), bytes = await readFile(command);
	const env = nominalSubtypeDotnetEnvironment(root, command), measurements = [];
	const run = async args => {
		const result = await runCopied(command, args, root, env);
		assert.equal(result.stderr, ""); measurements.push({ command, args, cwd: root, run: result });
		return result;
	};
	const listed = await run(["--list-sdks"]), sdk = selectFinContainerEdgeDotnetSdk(listed.stdout, join(dirname(command), "sdk"));
	assert.equal(await realpath(sdk.directory), sdk.directory);
	await saveLakeFile(root, "global.json", canonicalJson({ sdk: { version: sdk.version, rollForward: "disable", allowPrerelease: false } }));
	assert.equal((await run(["--version"])).stdout.trim(), sdk.version);
	const runtimes = await run(["--list-runtimes"]);
	assert.match(runtimes.stdout, /^Microsoft\.NETCore\.App 8\.0\.\d+ \[/mu);
	assert.deepEqual(await readFile(command), bytes);
	return { command, interpreter: { bytes: bytes.length, sha256: sha256(bytes) }, sdk, measurements };
};

/**
 * Require the same exact selected host bytes before and after host execution.
 *
 * @param tools - Original measured tool identities.
 */
export const verifyNominalSubtypeDotnetTools = async tools => {
	assert.equal(await realpath(tools.command), tools.command);
	const bytes = await readFile(tools.command);
	assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, tools.interpreter);
};

/**
 * Ask the compiled caller which shared framework actually executes it.
 * Listing installed runtimes alone does not establish the selected framework.
 *
 * @param root - Current caller directory.
 * @param application - Relative deployed assembly path.
 * @param tools - Measured trusted host and SDK.
 */
export const observeNominalSubtypeDotnetRuntime = async (root, application, tools) => {
	await verifyNominalSubtypeDotnetTools(tools);
	const args = [application, "--runtime"], environment = nominalSubtypeDotnetEnvironment(root, tools.command);
	const run = await runCopied(tools.command, args, root, environment);
	assert.equal(run.stderr, ""); const facts = JSON.parse(run.stdout);
	assert.deepEqual(Object.keys(facts).sort(), ["architecture", "command", "description", "directory", "littleEndian", "os", "version"]);
	assert.match(facts.version, /^8\.0\.[0-9]+$/u); assert.equal(facts.description, `.NET ${facts.version}`);
	assert.equal(facts.command, tools.command); assert.equal(facts.architecture, "X64"); assert.equal(facts.littleEndian, true);
	assert.equal(typeof facts.os, "string"); assert.ok(facts.os.length > 0);
	const directory = join(dirname(tools.command), "shared/Microsoft.NETCore.App", facts.version);
	assert.equal(facts.directory, directory + "/"); assert.equal(await realpath(directory), directory);
	const listed = tools.measurements.find(item => item.args[0] === "--list-runtimes");
	assert.ok(listed.run.stdout.split("\n").includes(`Microsoft.NETCore.App ${facts.version} [${dirname(directory)}]`));
	const runtimeFiles = {};
	for(const name of ["libcoreclr.so", "System.Private.CoreLib.dll"])
	{
		const bytes = await readFile(join(directory, name)); runtimeFiles[name] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	await verifyNominalSubtypeDotnetTools(tools);
	return { command: tools.command, args, cwd: root, run, facts, runtimeFiles };
};
