/**
 * Run the source-only engine with the real pinned compiler, without claiming isolation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { executeComponentEngineRequest } from "../../src/build/component-engine.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./owned-dotnet-callback-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Capture ordinary decisions or an independently authored v4 contract.
 *
 * @param t - Test context owning the temporary directory.
 * @param reviewed - Select the independently authored review.
 */
export const ownedAnalysisFixture = async (t, reviewed) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-analysis-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "source");
	await cp("tests/fixtures/onboarding/owned-dotnet-callables", root, { recursive: true });
	if(reviewed)
	{
		await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Owned"] }));
		await saveLakeFile(root, "reviewed.binding-ir.json", canonicalJson(ownedDotnetCallbacksReviewedIr()));
	}
	return { directory, root };
};

/**
 * Exercise the authentic engine and compiler while injecting only the Nix process transport.
 *
 * @param options - Observation hooks for the engine boundary.
 * @param options.execute - Optional relocated engine or replay implementation.
 * @param options.after - Optional hook after engine execution.
 * @param options.observed - Array collecting actual compiler arguments.
 */
export const ownedAnalysisTransport = ({ execute, after, observed = [] } = {}) => ({ capture: async command => {
	if(command.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11", stderr: "", code: 0 };
	const arg = name => command.args[command.args.indexOf(name) + 1];
	const options = { requestPath: arg("--request"), inputRoot: arg("--component")
		, outputRoot: arg("--output"), engineRoot: arg("--engine")
		, backend: "native-nix", signal: command.signal
		, environment: { ...process.env, LEAN_BRIDGE_LEAN: resolve(".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean") }
		, runner: { capture: invocation => {
			assert.equal(invocation.command.endsWith("/lean"), true, "Analysis must not run C compilers or package adapters");
			assert.equal(invocation.args.includes("-c"), false, "Analysis must not emit C");
			observed.push(invocation.args);
			return processBuildRunner.capture(invocation);
		} }
	};
	const request = JSON.parse(await readFile(options.requestPath, "utf8"));
	assert.equal(request.schemaVersion, 3); assert.equal(request.policies.noAdapterCompilation, true);
	if(execute) await execute(options);
	else await executeComponentEngineRequest(options);
	await after?.(options);
	return { stdout: "", stderr: "", code: 0 };
} });
