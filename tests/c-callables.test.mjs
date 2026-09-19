/**
 * Installed native C callbacks and closures, on both source paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { callableArities, callableSignatures, callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { callableCConsumer, cLifetimeSignature } from "./helpers/callable-c-consumer.mjs";
import { nativeFixtureEnvironment, installCopiedConsumer } from "./helpers/copied-fixture-install.mjs";
import { checkCCallableFaults } from "./helpers/c-callable-faults.mjs";
import { checkGmpInstallation } from "./helpers/c-gmp-install.mjs";
import { checkGmpCallableFaults } from "./helpers/c-gmp-faults.mjs";

const enabled = process.env.LEAN_BRIDGE_C_CALLABLE_TEST === "1";
const type = value => value.kind === "primitive" ? value.name
	: { callback: { parameters: value.parameters.map(type), result: type(value.result) } };

test("installed C callbacks and returned closures preserve all nineteen primitives on both source paths", { skip: !enabled, timeout: 900_000 }, async t => {
	const reports = [];
	const expectedSignatures = [...callableSignatures, cLifetimeSignature];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-c-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-c-callable-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Callables/Lifetimes.lean", await readFile("tests/fixtures/callable-consumers/Lifetimes.lean", "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Callables", "Callables.Lifetimes"]
			, targets: { c: { name: "callables", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: expectedSignatures.map(entry => entry.name), arities: { ...callableArities, "Callables.retainCallback": 1 } } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "callables.binding-ir.json", canonicalJson(callableReviewedIr(expectedSignatures)));
		const environment = nativeFixtureEnvironment(["c"]);
		t.diagnostic(`${path}: compiling the 59-export C callable library`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(expectedSignatures));
		const allocationFailureChecks = await checkCCallableFaults(outputRoot, join(directory, "faults"), environment);
		const gmpAllocationFailureChecks = await checkGmpCallableFaults(outputRoot, join(directory, "gmp-faults"), environment);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(directory, { recursive: true, force: true });
		t.diagnostic(`${path}: offline installed-header compilation and execution without Lean`);
		const observation = await installCopiedConsumer({ profile: "c"
			, consumer, handoff
			, packages: receipt.packages, environment
			, fixture: { source: callableCConsumer, success: "callable-c-ok" } });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const { command, ...observed } = observation;
		const gmp = await checkGmpInstallation({ consumer, packages: receipt.packages, command });
		reports.push({ profile: "c", path, signatures
			, ...observed
			, allocationFailureChecks
			, gmpAllocationFailureChecks
			, gmp
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_C_CALLABLE_REPORT ?? "build/callables/c.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
