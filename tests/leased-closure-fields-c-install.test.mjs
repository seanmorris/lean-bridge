/**
 * Exercise a stored Lean function through relocated, ownership-aware C11 libraries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkCFieldHandoff } from "./helpers/leased-closure-field-c-consumer.mjs";
import { leasedClosureFieldReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { copyPackageSetHandoff, retainPackageSetEvidence } from "./helpers/package-set.mjs";

const replay = process.env.LEAN_BRIDGE_C_TARIFF_REPLAY;
for(const route of ["ordinary", "reviewed"]) test(`installed ${route} C11 archive owns its function fields`, {
	skip: !replay && process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1_200_000
}, async t => {
	const dir = await mkdtemp(join(tmpdir(), "lean-bridge-c-closure-field-"));
	t.after(() => rm(dir, { recursive: true, force: true }));
	const project = join(dir, "source"), output = join(dir, "producer"), handoff = join(dir, "handoff");
	if(replay)
	{
		await copyPackageSetHandoff(join(resolve(replay), route), handoff);
		return checkCFieldHandoff({ dir, route, t });
	}
	await cp(resolve("tests/fixtures/onboarding/leased-closure-fields"), project, { recursive: true });
	const config = route === "ordinary" ? JSON.parse(await readFile(join(project, "lean-bridge.exports.json"))) : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { c: { name: "tariff-quotes", version: "1.0.0" } };
	if(route === "ordinary")
	{
		config.exports.push("Owned.exchangeTariff", "Owned.flatQuote", "Owned.stagedQuote");
		config.contracts = { "Owned.stagedQuote": JSON.parse(await readFile("tests/fixtures/structured-types/tariff-staged-contract.json")) };
	}
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(route === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(leasedClosureFieldReviewedIr({ exchange: true, staged: true })));
	const environment = nativeFixtureEnvironment(["c"]);
	const built = await buildCanonicalProject({ projectRoot: project
		, outputRoot: output, targets: ["c"], environment
		, onProgress: event => t.diagnostic(`${route}: ${event.message}`) });
	assert.equal(built.backend, "native-c-owned-v2");
	await copyPackageSetHandoff(output, handoff);
	await rm(project, { recursive: true }); await rm(output, { recursive: true });
	if(process.env.LEAN_BRIDGE_TARIFF_REPLAY_ROOT)
		await retainPackageSetEvidence(handoff, join(resolve(process.env.LEAN_BRIDGE_TARIFF_REPLAY_ROOT), route));
	await checkCFieldHandoff({ dir, route, t });
});
