/**
 * Separate immutable callback evidence from fresh extractor invocation identities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createMetadataRequest, identifyLeanInterface } from "../../src/analyze/elaborated-metadata.mjs";
import { projectNativeMetadata } from "../../src/analyze/native-metadata.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";

const baselineExtractor = "9d39776bae35a6a4c0074e45dc710e17d4e4d7a74103b2b39ec9dfdd84818764";

/**
 * Authenticate the real invocation before rebasing only its extractor identity.
 * Every declaration, interface, diagnostic and selection remains unchanged.
 *
 * @param input - Observed metadata and independently recorded source identity.
 */
export const callbackCompilerInputAtBaseline = async input => {
	const path = "src/analyze/NativeExports.lean", bytes = await readFile(path);
	assert.equal(sha256(beforeFinRefinementSource(path, bytes, input.sourceIdentity.extractorSha256)), input.sourceIdentity.extractorSha256);
	assert.equal(sha256(beforeFinRefinementSource(path, bytes, baselineExtractor)), baselineExtractor);
	projectNativeMetadata(input.metadata, input.sourceIdentity, { ownedGraphs: true, copiedGraphs: true });
	const copy = structuredClone(input), identity = copy.sourceIdentity;
	const selection = structuredClone(identity.request);
	delete selection.metadata;
	identity.extractorSha256 = baselineExtractor;
	identity.request = createMetadataRequest(selection, {
		toolchain: `leanprover/lean4:v${identity.leanVersion}`
		, modules: identity.modules.map(item => ({
			name: item.module
			, sourcePath: item.source.path
			, sourceSha256: item.source.sha256
			, interfaceSha256: item.interface.interfaceSha256 }))
		, leanCompilerSha256: identity.leanCompilerSha256
		, ...identity.reviewedBindingIr === undefined ? {} : { reviewedBindingIrSha256: sha256(canonicalJson(identity.reviewedBindingIr)) }
		, extractorSha256: baselineExtractor
	});
	copy.metadata.producer.invocationIdentitySha256 = identity.request.metadata.invocationIdentitySha256;
	return copy;
};

const compiled = new Map();

/**
 * Keep historical compiler pins, but independently compile current carrier C.
 * Do not accept a new C hash merely because a report claims to have produced it.
 *
 * @param input - Authenticated current or historical compiler input.
 * @param carriers - Independently generated typed Lean carriers.
 * @param historicalDigest - Frozen compiler observation for the original input.
 */
export const callbackCarrierCDigest = async (input, carriers, historicalDigest) => {
	if(input.sourceIdentity.extractorSha256 === baselineExtractor) return historicalDigest;
	const key = sha256(canonicalJson({ identity: input.sourceIdentity, source: carriers.leanSource }));
	if(!compiled.has(key)) compiled.set(key, (async () => {
		const identity = input.sourceIdentity;
		const prefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
		const lean = join(prefix, "bin/lean");
		assert.equal(sha256(await readFile(lean)), identity.leanCompilerSha256);
		const base = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
		const source = [ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedSource]
			.map(suffix => base + suffix).find(source => sha256(source) === identity.sourceTreeSha256);
		assert.equal(typeof source, "string", "known authored callback fixture");
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-callback-recheck-"));
		try
		{
			const run = args => processBuildRunner.capture({
				command: lean
				, args
				, cwd: directory
				, env: { ...process.env, LEAN_PATH: directory, PATH: `${join(prefix, "bin")}:${process.env.PATH}` }
				, timeoutMs: 180000 });
			await saveLakeFile(directory, "Owned.lean", source);
			await run(["-o", "Owned.olean", "Owned.lean"]);
			const measured = await identifyLeanInterface(join(directory, "Owned.olean"));
			assert.deepEqual(identity.modules[0].interface, { sha256: measured.oleanSha256, interfaceSha256: measured.interfaceSha256 });
			await saveLakeFile(directory, carriers.module + ".lean", carriers.leanSource);
			await run(["-c", "Carriers.c", carriers.module + ".lean"]);
			return sha256(await readFile(join(directory, "Carriers.c")));
		}
		finally
		{ await rm(directory, { recursive: true, force: true }); }
	})());
	return compiled.get(key);
};
