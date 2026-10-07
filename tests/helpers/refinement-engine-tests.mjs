/**
 * Regression controls for locked-engine selection in refinement acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { refinementEngineTransport } from "./refinement-engine.mjs";

const engineArgs = [
	"--request", "/fixture/request.json"
	, "--component", "/fixture/input"
	, "--output", "/fixture/output"
];
const command = { command: "nix", args: ["run", "engine", "--", ...engineArgs, "--engine", "/fixture/engine"] };
const unexpected = async () => assert.fail("Unselected engine was invoked");

test("refinement acceptance dispatches to the configured locked engine without a local Lean installation", async () => {
	let calls = 0;
	const capture = async actual => {
		++calls;
		assert.deepEqual(actual, { command: resolve("build/locked-lake-engine/bin/lean-bridge-component-engine")
			, args: [...engineArgs, "--backend", "native-nix"]
			, timeoutMs: 180000 });
	};
	const transport = refinementEngineTransport({ externalEngine: "build/locked-lake-engine/bin/lean-bridge-component-engine"
		, execute: unexpected, runner: { capture } });
	assert.deepEqual(await transport.capture(command), { stdout: "", stderr: "", code: 0 });
	assert.equal(calls, 1);
});

test("refinement acceptance uses the local engine only when no external engine is selected", async () => {
	let calls = 0;
	const execute = async actual => {
		++calls;
		assert.deepEqual(actual, { requestPath: "/fixture/request.json"
			, inputRoot: "/fixture/input"
			, outputRoot: "/fixture/output"
			, engineRoot: "/fixture/engine", backend: "native-nix" });
	};
	const transport = refinementEngineTransport({ externalEngine: null, runner: { capture: unexpected }, execute });
	assert.deepEqual(await transport.capture(command), { stdout: "", stderr: "", code: 0 });
	assert.equal(calls, 1);
});

test("refinement engine failures propagate without silently trying a different compiler", async () => {
	const failure = new Error("locked engine compilation failed");
	const external = refinementEngineTransport({ externalEngine: "/fixture/locked-engine"
		, execute: unexpected
		, runner: { capture: async () => { throw failure; } } });
	await assert.rejects(external.capture(command), error => error === failure);
	const local = refinementEngineTransport({ externalEngine: null
		, runner: { capture: unexpected }
		, execute: async () => { throw failure; } });
	await assert.rejects(local.capture(command), error => error === failure);
});

test("refinement transport version probes do not start either compiler and Docker remains unavailable", async () => {
	const transport = refinementEngineTransport({ externalEngine: "/fixture/locked-engine", execute: unexpected, runner: { capture: unexpected } });
	assert.equal((await transport.capture({ command: "nix", args: ["--version"] })).code, 0);
	await assert.rejects(transport.capture({ command: "docker", args: ["--version"] }), /Docker is absent/);
});
