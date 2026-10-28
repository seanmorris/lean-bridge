/**
 * Unit controls for direct proof-erasure npm and browser acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	directProofErasureBrowserExpected
	, directProofErasureBrowserPackage
	, directProofErasureBrowserPhases
	, directProofErasureBrowserProfiles
	, validateDirectProofErasureBrowserObservation
	, validateDirectProofErasureBrowserPhases
} from "./direct-proof-erasure-browser.mjs";
import {
	checkDirectProofErasure
} from "../fixtures/direct-proof-erasure-consumers/javascript.mjs";

const keep = value => {
	if(!Number.isInteger(value) || value < 0 || value > 0xffffffff)
		throw new TypeError("value must be uint32");
	return value;
};
const observation = profile => ({
	schemaVersion: 1, profile, module: "direct-proof-erasure"
	, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
	, results: { module: "direct-proof-erasure"
		, ...directProofErasureBrowserExpected }
	, hostVersion: "test-browser"
});
const engines = ["chromium", "firefox", "webkit"];
const phases = profile => engines.flatMap(engine => (
	profile === "browser-react" ? ["production", "strict"] : ["production"]
).flatMap(variant => directProofErasureBrowserPhases(profile).map(phase => ({
	engine, variant, phase, observation: observation(profile)
}))));

test("the independent caller observes one UInt32 word and refuses invalid host values", () => {
	assert.deepEqual(checkDirectProofErasure({ keep })
		, directProofErasureBrowserExpected);
	assert.equal(keep.length, 1);
});

test("browser observations bind every package realm and lifecycle phase", () => {
	assert.deepEqual(directProofErasureBrowserProfiles
		, ["browser-javascript", "browser-react", "browser-worker"]);
	assert.equal(directProofErasureBrowserProfiles.flatMap(phases).length, 51);
	for(const profile of directProofErasureBrowserProfiles)
	{
		validateDirectProofErasureBrowserObservation(observation(profile), profile);
		validateDirectProofErasureBrowserPhases(phases(profile), profile, engines);
		for(const mutate of [
			value => { value.results.checks--; }
			, value => { value.results.rejections--; }
			, value => { value.realm = "wrong"; }
			, value => { value.module = "other"; }
			, value => { value.results.module = "other"; }
			, value => { value.hostVersion = ""; }
		]) {
			const changed = observation(profile); mutate(changed);
			assert.throws(() => validateDirectProofErasureBrowserObservation(
				changed, profile
			));
		}
		assert.throws(() => validateDirectProofErasureBrowserPhases(
			phases(profile).slice(1), profile, engines
		));
	}
});

test("the installed lane cannot pass proofs through JavaScript or TypeScript", async () => {
	const caller = await readFile(
		"tests/fixtures/direct-proof-erasure-consumers/javascript.mjs", "utf8"
	);
	const typescript = await readFile(
		"tests/fixtures/direct-proof-erasure-consumers/index.mts", "utf8"
	);
	const installed = await readFile(
		"tests/direct-proof-erasure-npm-installed.test.mjs", "utf8"
	);
	const runner = await readFile(
		"scripts/run-direct-proof-erasure-npm-ci.sh", "utf8"
	);
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(directProofErasureBrowserPackage
		, /import\("direct-proof-erasure"\)/u);
	assert.doesNotMatch(caller, /True\.intro|proof:/u);
	assert.match(typescript, /api\.keep\(42, true\)/u);
	assert.match(installed, /assertDirectProofErasureBundle/u);
	assert.match(installed, /sourceRemovedBeforeInstallation: true/u);
	assert.match(installed, /relocatedInstallation: true/u);
	assert.match(installed, /"--strict", "--noEmit", "--skipLibCheck", "false"/u);
	assert.ok(installed.indexOf("await rm(prepared.directory")
		< installed.indexOf("const nodeRoot"));
	assert.match(runner, /for route in ordinary reviewed/u);
	assert.match(runner
		, /LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit/u);
	assert.match(runner, /check-direct-proof-erasure-npm-ci\.mjs/u);
	assert.match(workflow, /id: direct_proof_npm/u);
	assert.match(workflow, /run: bash scripts\/run-direct-proof-erasure-npm-ci\.sh/u);
	assert.match(workflow, /name: direct-proof-erasure-node-browser-/u);
});
