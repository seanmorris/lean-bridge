/**
 * Build and consume checked-record packages without compiler access after handoff.
 * Each source route and result-only package has two independent author roots.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { readVerifiedPackageSetReceipt, verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { prepareRustCorpusDependencies } from "./type-corpus-rust.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { checkedRecordFixture, refinementsKey } from "./checked-record-fixture.mjs";
import { checkedRecordHostExtensions, checkedRecordHostRoutes, checkedRecordHostTargets, checkedRecordHostConsumer, checkedRecordHostSelection, selectCheckedRecordHosts } from "./checked-record-native-fixture.mjs";
import { installCheckedRecordHost } from "./checked-record-native-install.mjs";

const profiles = selectCheckedRecordHosts(process.env.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_HOSTS);
const selectedRoutes = selectCheckedRecordHosts(process.env.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_ROUTES, checkedRecordHostRoutes);
const routes = selectedRoutes.length ? selectedRoutes : checkedRecordHostRoutes;
if(selectedRoutes.length) assert.ok(profiles.length, "Checked-record routes require an explicit host selection");

/**
 * Check the native payload mirrors independently of generated host code.
 *
 * @param model - Fresh native compiler model.
 * @param expected - Independently authored Binding IR.
 */
const assertMirrors = (model, expected) => {
	assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
	assert.equal(model.exports.length, expected.declarations.length);
	const record = (site, constructor) => {
		const definition = expected.types.find(item => item.id === site.type.id);
		return definition ? { kind: "checked-record"
			, definition: definition.id.slice("lean:".length)
			, constructor, fields: definition.fields.map(field => field.name) } : null;
	};
	for(const declaration of expected.declarations)
	{
		const actual = model.exports.find(item => item.name === declaration.source.declaration);
		assert.ok(actual, declaration.id);
		const trees = declaration.source.extensions[refinementsKey];
		assert.deepEqual(actual.refinements, {
			parameters: declaration.parameters.map((site, index) => record(site, trees?.parameters[index]?.constructor ?? null))
			, result: record(declaration.result, null)
		});
	}
};

for(const route of routes) test(`installed checked-record native hosts reproduce and relocate ${route}`, {
	skip: !profiles.length, timeout: 3_600_000
}, async t => {
	const selection = checkedRecordHostSelection(route, profiles);
	const output = resolve(process.env.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_OUTPUT ?? `build/checked-record-native/${profiles.join("-")}`, route);
	await assert.rejects(access(output), { code: "ENOENT" });
	await mkdir(output, { recursive: true });
	const environment = nativeFixtureEnvironment(profiles);
	if(profiles.includes("ruby"))
	{
		environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
		environment.LEAN_BRIDGE_GEM ??= join(dirname(environment.LEAN_BRIDGE_RUBY), "gem");
	}
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-hosts-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true, force: true });
		else t.diagnostic(`Retained failed checked-record host inputs: ${root}`);
	});
	const consumer = join(root, "consumer"), handoff = join(consumer, "handoff"), builds = [];
	let dependencies;
	for(const attempt of [0, 1])
	{
		const author = join(root, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const record = join(output, `build-${attempt}`);
		await cp(checkedRecordFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(selection.configuration));
		if(selection.reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(selection.expected));
		else await assert.rejects(access(join(projectRoot, "api.binding-ir.json")), { code: "ENOENT" });
		t.diagnostic(`${route} author ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(selection.configuration.targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assertMirrors(model, selection.expected);
		if(selection.reviewed) assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(selection.expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr, "Ordinary source must not acquire a reviewed authority");
		const { receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		for(const [name, value] of [["model.json", model], ["expected.json", selection.expected], ["package-set-receipt.json", receipt]])
			await saveLakeFile(record, name, canonicalJson(value));
		for(const name of ["CheckedRecords.lean", "lean-bridge.exports.json"])
			await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
		if(selection.reviewed) await saveLakeFile(record, "api.binding-ir.json", canonicalJson(selection.expected));
		if(attempt === 0)
		{
			await copyPackageSetHandoff(outputRoot, handoff);
			await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
			if(profiles.includes("rust")) dependencies = await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory: author, handoff: join(consumer, "dependencies"), environment });
		}
		builds.push({ bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(canonicalJson(receipt))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))) });
		await rm(author, { recursive: true });
		await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0], "Independent author roots must reproduce exact model and archive identities");
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json"))), reports = [];
	for(const profile of profiles)
	{
		t.diagnostic(`Installing and relocating ${route} ${profile}`);
		const packages = receipt.packages.filter(pkg => pkg.target === checkedRecordHostTargets[profile][0]);
		const observation = await installCheckedRecordHost({ profile, route, consumer, handoff, packages, environment, dependencies });
		const source = await checkedRecordHostConsumer(profile, route);
		assert.equal(observation.consumerSha256, sha256(source));
		const report = { profile, route, ...observation, packages
			, ...builds[0], expectedBindingIrSha256: hashBindingIr(selection.expected)
			, reviewed: selection.reviewed, resultOnly: selection.resultOnly
			, sourceRemovedBeforeInstallation: true
			, dispatch: { observed: false, reason: "No entry counters in this installed host acceptance" } };
		reports.push(report);
		await saveLakeFile(output, `${profile}.json`, canonicalJson(report));
		await saveLakeFile(join(output, "consumers"), `${profile}.${checkedRecordHostExtensions[profile]}`, source);
		await rm(join(consumer, profile + "-relocated"), { recursive: true });
	}
	await saveLakeFile(output, "report.json", canonicalJson({ schemaVersion: 1, route, profiles, reports, builds, reproducible: true }));
	complete = true;
});
