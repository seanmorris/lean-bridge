/**
 * Authenticate selected .NET host, SDK and actual shared-framework observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { selectFinContainerEdgeDotnetSdk } from "./fin-container-edge-dotnet-closure.mjs";

/**
 * Validate an independently pinned binary identity without reopening its old path.
 *
 * @param file - Original size and digest.
 */
const binary = file => {
	assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
	assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
	assert.match(file.sha256, /^[a-f0-9]{64}$/u);
};

/**
 * Validate a complete successful captured process.
 *
 * @param run - Original process exit and streams.
 */
const successful = run => {
	assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);
	assert.equal(run.code, 0); assert.equal(run.stderr, "");
	assert.equal(typeof run.stdout, "string"); assert.ok(run.stdout.length > 0);
};

/**
 * Bind original tool measurements to independently selected host and SDK pins.
 *
 * @param tools - Original toolchain record.
 * @param pinned - Independently selected command, host identity and SDK.
 * @param root - Original installation root, interpreted as a string only.
 */
export const checkInheritedCheckedRecordDotnetToolsRecord = (tools, pinned, root) => {
	assert.deepEqual(Object.keys(pinned).sort(), ["command", "interpreter", "sdk"]);
	assert.deepEqual(Object.keys(tools).sort(), ["command", "interpreter", "measurements", "sdk"]);
	assert.deepEqual({ command: tools.command, interpreter: tools.interpreter, sdk: tools.sdk }, pinned);
	assert.ok(posix.isAbsolute(tools.command));
	assert.equal(posix.normalize(tools.command), tools.command);
	binary(tools.interpreter);
	assert.deepEqual(Object.keys(tools.sdk).sort(), ["directory", "version"]);
	assert.equal(tools.sdk.directory, posix.join(posix.dirname(tools.command), "sdk"));
	assert.match(tools.sdk.version, /^8\.0\.[0-9]+$/u);
	assert.equal(tools.measurements.length, 3);
	for(const [index, argument] of ["--list-sdks", "--version", "--list-runtimes"].entries())
	{
		const item = tools.measurements[index];
		assert.deepEqual(Object.keys(item).sort(), ["args", "command", "cwd", "run"]);
		assert.equal(item.command, tools.command); assert.deepEqual(item.args, [argument]);
		assert.equal(item.cwd, posix.join(posix.dirname(root), "toolchain"));
		successful(item.run);
	}
	assert.deepEqual(selectFinContainerEdgeDotnetSdk(tools.measurements[0].run.stdout, tools.sdk.directory), tools.sdk);
	assert.equal(tools.measurements[1].run.stdout, tools.sdk.version + "\n");
};

/**
 * Require the actually selected framework and exact stage-specific invocation.
 *
 * @param observation - Original framework process and runtime identities.
 * @param options - Independent runtime pins and expected invocation.
 * @param options.tools - Authenticated original host selection.
 * @param options.pinned - Actual first framework facts and binary identities.
 * @param options.cwd - Expected historical stage directory.
 * @param options.sourceFree - Whether only deployed files remained.
 */
export const checkInheritedCheckedRecordDotnetFrameworkRecord = (observation, { tools, pinned, cwd, sourceFree }) => {
	assert.deepEqual(Object.keys(pinned).sort(), ["facts", "runtimeFiles"]);
	assert.deepEqual(Object.keys(observation).sort(), ["args", "command", "cwd", "facts", "run", "runtimeFiles"]);
	assert.equal(observation.command, tools.command); assert.equal(observation.cwd, cwd);
	assert.deepEqual(observation.args, [sourceFree ? "Consumer.dll" : "out/Consumer.dll", "--runtime"]);
	successful(observation.run);
	assert.deepEqual(JSON.parse(observation.run.stdout), observation.facts);
	assert.deepEqual(observation.facts, pinned.facts);
	assert.deepEqual(observation.runtimeFiles, pinned.runtimeFiles);
	const facts = observation.facts;
	assert.deepEqual(Object.keys(facts).sort(), ["architecture", "command", "description", "directory", "littleEndian", "os", "version"]);
	assert.match(facts.version, /^8\.0\.[0-9]+$/u);
	assert.equal(facts.description, `.NET ${facts.version}`);
	assert.equal(facts.command, tools.command);
	assert.equal(facts.architecture, "X64"); assert.equal(facts.littleEndian, true);
	assert.equal(typeof facts.os, "string"); assert.ok(facts.os.length > 0);
	const shared = posix.join(posix.dirname(tools.command), "shared/Microsoft.NETCore.App");
	assert.equal(facts.directory, posix.join(shared, facts.version) + "/");
	assert.ok(tools.measurements[2].run.stdout.split("\n").includes(`Microsoft.NETCore.App ${facts.version} [${shared}]`));
	assert.deepEqual(Object.keys(observation.runtimeFiles).sort(), ["System.Private.CoreLib.dll", "libcoreclr.so"]);
	for(const file of Object.values(observation.runtimeFiles)) binary(file);
};
