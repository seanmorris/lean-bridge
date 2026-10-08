/**
 * Independently reviewed checked constructors through fresh Lean and installed C/C++ packages.
 * The author configuration selects modules and targets only; the review owns every API decision.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { validateReviewedSource, reviewedSourceSelection, reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installCopiedConsumer } from "./helpers/copied-fixture-install.mjs";
import { nativeSubtypeEnvironment, nativeSubtypeTargets } from "./helpers/native-subtype-install.mjs";
import { reviewedSubtypeInstalledIr, reviewedSubtypeInstalledSource, reviewedSubtypeNativeConsumer } from "./helpers/reviewed-subtype-installed-fixture.mjs";
import "./helpers/reviewed-subtype-harness-source-history-tests.mjs";
import "./helpers/reviewed-subtype-npm-tests.mjs";

const fixture = "tests/fixtures/onboarding/native-subtype";
const reviewInput = review => {
	const source = canonicalJson(review);
	return { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(review) };
};
const authorProject = async (projectRoot, targets, review) => {
	await cp(fixture, projectRoot, { recursive: true });
	await saveLakeFile(projectRoot, "Subtypes.lean", await readFile(join(fixture, "Subtypes.lean"), "utf8") + reviewedSubtypeInstalledSource);
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Subtypes"], targets }));
	await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
};

test("an independent Subtype review keeps distinct constructor choices and a zero-argument result", async () => {
	const review = reviewedSubtypeInstalledIr();
	validateReviewedSource(reviewInput(review));
	const selection = reviewedSourceSelection(reviewInput(review));
	assert.equal(review.declarations.length, 12);
	assert.equal(selection.contracts["Subtypes.firstEven"].parameters[0].refinement.constructor, "Subtypes.checkedEven");
	assert.equal(selection.contracts["Subtypes.secondEven"].parameters[0].refinement.constructor, "Subtypes.normalizedEven");
	assert.deepEqual(selection.contracts["Subtypes.zeroEven"].parameters, []);
	assert.equal(selection.contracts["Subtypes.zeroEven"].result.refinement.constructor, "Subtypes.checkedEven");
	assert.deepEqual(selection.specializations.map(item => [item.name, item.declaration, item.types]), [
		["Subtypes.firstEven", "Subtypes.echo", ["Subtypes.Even"]]
		, ["Subtypes.secondEven", "Subtypes.echo", ["Subtypes.Even"]]
	]);
	for(const profile of ["c", "cpp"])
	{
		const source = await reviewedSubtypeNativeConsumer(profile);
		for(const name of ["byte", "first_even", "second_even", "zero_even"]) assert.ok(source.includes(name));
		assert.ok(source.includes("checks += 2000;"), "retain all original recovery cases");
	}
});

test("fresh Lean compiles the reviewed zero-argument Subtype result and both generic constructor choices", {
	skip: process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_INSTALLED_LEAN_TEST !== "1"
	, timeout: 900_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-subtype-zero-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project"), outputRoot = join(directory, "component");
	const review = reviewedSubtypeInstalledIr();
	await authorProject(projectRoot, { c: nativeSubtypeTargets.c[1] }, review);
	let checked = false;
	await assert.rejects(() => buildElaboratedComponent({ projectRoot, outputRoot
		, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, targets: ["c"], profile: "native-library-v1"
		, receiptName: "native-component.json"
		, createModel: input => {
			assert.deepEqual(input.sourceIdentity.request.contracts, reviewedSourceSelection(reviewInput(review)).contracts);
			return createNativeModel(input, { refinements: true });
		}
		, compileComponent: async ({ model }) => {
			assert.equal(reviewedContractDifference(review, model.bindingIr), null);
			const zero = model.exports.find(item => item.name === "Subtypes.zeroEven");
			assert.deepEqual(zero.parameters, []);
			assert.deepEqual(zero.refinements, { parameters: [], result: { kind: "subtype", constructor: "Subtypes.checkedEven" } });
			checked = true;
			throw Object.assign(new Error("Checked through Lean adapter compilation"), { code: "test-checked" });
		}
	}), error => {
		assert.equal(error.code, "test-checked", JSON.stringify({ message: error.message, details: error.details }));
		return true;
	});
	assert.equal(checked, true);
	await assert.rejects(() => lstat(outputRoot), { code: "ENOENT" });
});

const profiles = process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_PROFILES?.split(",").sort() ?? [];
assert.equal(new Set(profiles).size, profiles.length);
assert.ok(profiles.every(profile => ["c", "cpp"].includes(profile)), "Reviewed Subtype acceptance starts with C and C++");

test("source-free reviewed C and C++ archives execute each checked constructor and distinct generic choices", {
	skip: !profiles.length, timeout: 2_400_000
}, async t => {
	const reports = [], archives = [];
	const targets = Object.fromEntries(profiles.map(profile => nativeSubtypeTargets[profile]));
	const environment = nativeSubtypeEnvironment(profiles);
	const review = reviewedSubtypeInstalledIr();
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-subtype-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-subtype-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await authorProject(projectRoot, targets, review);
		t.diagnostic(`reviewed Subtype build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		assert.equal(model.exports.length, 12);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		await rm(directory, { recursive: true, force: true });
		await assert.rejects(() => lstat(directory), { code: "ENOENT" });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			const packages = receipt.packages.filter(pkg => pkg.target === nativeSubtypeTargets[profile][0]);
			const observation = await installCopiedConsumer({
				profile, consumer, handoff, packages, environment
				, fixture: { source: reviewedSubtypeNativeConsumer, wit: [], success: "subtype-ok" } });
			delete observation.command;
			reports.push({ profile, path: "reviewed-source", ...observation, packages
				, bindingIrSha256: built.bindingIrSha256
				, reviewedBindingIrSha256: hashBindingIr(review)
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true, dispatch: "not measured" });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	const reportPath = resolve(process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_REPORT ?? `build/reviewed-subtype/${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
