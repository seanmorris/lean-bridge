/**
 * Installed acceptance shared by the Fin product fixtures (VO #1441): build from two unrelated
 * author roots, install each selected profile from the prepared archives alone, and record one
 * report per source path. Reviewed builds also refuse independently changed bounds.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { prepareRustCorpusDependencies } from "./type-corpus-rust.mjs";

/**
 * Read and validate a comma-separated profile selection.
 *
 * @param variable - Environment variable naming the profiles.
 * @param targets - Known profiles and their package targets.
 */
export const finFixtureProfiles = (variable, targets) => {
	const selection = process.env[variable]?.split(",").sort() ?? [];
	assert.equal(new Set(selection).size, selection.length, `Duplicate profile in ${variable}`);
	assert.ok(selection.every(profile => Object.hasOwn(targets, profile)), `Unknown or empty profile in ${variable}`);
	return selection;
};

/**
 * Build, relocate, install and exercise a Fin fixture, then save its report.
 *
 * @param t - Running test context.
 * @param spec - Fixture identity, expected bounds, installer and report locations.
 * @param spec.fixture - Lean project copied into each author root.
 * @param spec.module - Lean module whose exports are selected.
 * @param spec.label - Temporary directory label.
 * @param spec.targets - Profile to package target and coordinate.
 * @param spec.refinements - Exact refinement tree of every export.
 * @param spec.reviewedIr - Independently authored Binding IR for the reviewed route.
 * @param spec.install - Installs and runs one profile's consumer from the handoff.
 * @param spec.report - Report path variables and the default report directory.
 * @param spec.observe - Optional extra observation of one installed profile.
 * @param profiles - Selected profiles.
 * @param reviewed - Whether the reviewed route selects the exports.
 */
export const checkInstalledFinFixture = async (t, spec, profiles, reviewed = false) => {
	const reports = [], archives = [];
	const targets = Object.fromEntries(profiles.map(profile => spec.targets[profile]));
	const environment = nativeFixtureEnvironment(profiles);
	// CI exports the Ruby toolchain; local runs use the pinned MRI 3.3 beside the other toolchains.
	if(profiles.includes("ruby"))
	{
		environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
		environment.LEAN_BRIDGE_GEM ??= join(dirname(environment.LEAN_BRIDGE_RUBY), "gem");
	}
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), `lean-bridge-${spec.label}-author-`));
		const consumer = await mkdtemp(join(tmpdir(), `lean-bridge-${spec.label}-consumer-`));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp(spec.fixture, projectRoot, { recursive: true });
		// The reviewed route selects its exports from the authored Binding IR; the ordinary route names them.
		const reviewedSource = reviewed ? canonicalJson(spec.reviewedIr()) : null;
		if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", reviewedSource);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [spec.module], ...(reviewed ? {} : { exports: Object.keys(spec.refinements) }), targets }));
		t.diagnostic(`build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		if(reviewed)
		{
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, reviewedSource);
			assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, sha256(reviewedSource));
		}
		// Lean elaboration supplies every bound; the model carries exactly the expected trees.
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), spec.refinements);
		for(const item of model.exports) for(const parameter of item.parameters) assert.ok(!JSON.stringify(parameter.type).includes('"refinement"'), item.name);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		const dependencies = attempt === 0 && profiles.includes("rust")
			? await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory, handoff: join(consumer, "dependencies"), environment }) : undefined;
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking ${profile}`);
			const target = spec.targets[profile][0];
			const packages = receipt.packages.filter(pkg => pkg.target === target);
			const { command, ...observation } = await spec.install({ profile, consumer, handoff, packages, dependencies, environment });
			void command;
			const observed = spec.observe ? await spec.observe({ profile, consumer, packages, environment }) : {};
			reports.push({ profile, ...observation, packages
				, path: reviewed ? "reviewed-ir" : "ordinary-source"
				, ...observed
				, ...(reviewed ? { reviewedSourceSha256: model.sourceIdentity.reviewedBindingIr.sourceSha256 } : {})
				, refinements: spec.refinements
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	// Two unrelated author roots produce byte-identical archives.
	assert.deepEqual(archives[1], archives[0]);
	const configuredReport = process.env[reviewed ? spec.report.reviewedVariable : spec.report.variable];
	const reportPath = resolve(configuredReport ?? `${spec.report.directory}/${reviewed ? "reviewed-" : ""}${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
};

/**
 * Build the reviewed C route once per independently changed review; each must stop at the
 * named extension before any output exists.
 *
 * @param t - Running test context.
 * @param spec - Fixture identity and reviewed Binding IR, as for checkInstalledFinFixture.
 * @param cases - Label, mutation of a fresh review, and the expected mismatched field.
 */
export const assertReviewedFinChangesRefused = async (t, spec, cases) => {
	for(const [label, mutate, field] of cases) await t.test(label, async () => {
		const directory = await mkdtemp(join(tmpdir(), `lean-bridge-${spec.label}-reviewed-`));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
		await cp(spec.fixture, projectRoot, { recursive: true });
		const ir = spec.reviewedIr(); mutate(ir);
		await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(ir));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [spec.module], targets: Object.fromEntries([spec.targets.c]) }));
		await assert.rejects(() => buildCanonicalProject({ projectRoot, outputRoot, targets: ["c"], environment: nativeFixtureEnvironment(["c"]) }), error => {
			assert.equal(error.code, "reviewed-ir-source-mismatch", label);
			assert.match(error.details.field, field, label);
			return true;
		});
		await assert.rejects(() => access(outputRoot), label);
	});
};
