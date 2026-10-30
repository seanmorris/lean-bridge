/**
 * Check original structural Subtype C/C++ records independently of the producer.
 * This acceptance does not measure constructor or source entry counts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { moduleAtProducer } from "./producer-module.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const nativeFiles = [
	"report.json", "expected.binding-ir.json", "configuration.json"
	, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json", "StructuralSubtypes.lean"].map(name => `build-${index}/${name}`))
	, ...["c", "cpp"].flatMap(profile => [`consumers/${profile}.${profile}`, ...["installed.json", "relocated.json", "report.json"].map(name => `${profile}/${name}`)])];
export const structuralSubtypeNativeRecordPaths = Object.freeze(nativeFiles);

/**
 * Validate the original report, both builds, consumers and relocated executions.
 *
 * @param read - Read a named record from the original run directory.
 * @param options - Frozen producer identity and selected source route.
 * @param options.route - Ordinary or reviewed source.
 * @param options.producerCommit - Actual producer commit, not an archival commit.
 */
export const checkStructuralSubtypeNativeReport = async (read, { route, producerCommit }) => {
	assert.ok(["ordinary", "reviewed"].includes(route)); assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `${path} must retain canonical original bytes`);
		return value;
	};
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
	const fixture = await moduleAtProducer(producerCommit
		, "tests/helpers/structural-subtype-installed-fixture.mjs");
	const report = await json("report.json")
		, expected = fixture.structuralSubtypeReview();
	const configuration = fixture.structuralSubtypeConfiguration(
		route, ["c", "cpp"]
	);
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route); assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.profiles, ["c", "cpp"]); assert.deepEqual(report.configuration, configuration);
	assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.reproducible, true); assert.equal(report.independentBuilds, 2);
	assert.ok(["2.36", "2.38"].includes(report.declaredGlibcFloor));
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	let receipt;
	for(const attempt of [0, 1])
	{
		const modelBytes = await read(`build-${attempt}/model.json`), model = await json(`build-${attempt}/model.json`);
		const receiptBytes = await read(`build-${attempt}/package-set-receipt.json`);
		receipt = await json(`build-${attempt}/package-set-receipt.json`);
		const build = report.builds[attempt];
		assert.equal(build.modelSha256, sha256(modelBytes)); assert.equal(build.receiptSha256, sha256(receiptBytes));
		validateBindingIr(model.bindingIr); assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(build.bindingIrSha256, hashBindingIr(model.bindingIr)); assert.equal(model.bindingIrSha256, build.bindingIrSha256);
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64);
		assert.equal(model.exports.length, 12);
		for(const declaration of expected.declarations)
		{
			const exported = model.exports.find(item => item.name === declaration.id.slice(5));
			assert.ok(exported, declaration.id);
			assert.deepEqual(exported.refinements, declaration.source.extensions["lean-lang.org/refinements"]);
		}
		const source = await read(`build-${attempt}/StructuralSubtypes.lean`);
		assert.deepEqual(source, original("tests/fixtures/onboarding/structural-subtypes/StructuralSubtypes.lean"));
		assert.equal(model.sourceIdentity.modules.length, 1);
		assert.equal(model.sourceIdentity.modules[0].source.sha256, sha256(source));
		assert.equal(model.sourceIdentity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(model.sourceIdentity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.equal(model.sourceIdentity.extractorSha256, sha256(original("src/analyze/NativeExports.lean")));
		digest(model.sourceIdentity.leanCompilerSha256);
		assert.deepEqual(model.sourceIdentity.request.metadata.modules.map(item => item.sourceSha256), [sha256(source)]);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, build.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(item => item.target).sort(), ["c", "cpp"]);
		assert.deepEqual(build.archives, Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))));
		for(const value of Object.values(build.archives)) digest(value);
	}
	assert.equal(report.reports.length, 2);
	for(const [index, profile] of ["c", "cpp"].entries())
	{
		const item = report.reports[index]; assert.equal(item.profile, profile);
		assert.deepEqual(await json(`${profile}/report.json`), item);
		assert.equal(item.checks, profile === "c" ? 4049 : 4047);
		for(const key of ["compilerFreePath", "compilerFreeReplay", "offlineInstall", "relocatedInstallation", "sourceRemovedBeforeInstallation"]) assert.equal(item[key], true, key);
		assert.deepEqual(item.dispatch, { observed: false, reason: "Separate constructor/source entry probe remains required" });
		digest(item.executableSha256);
		const originalSource = original(`tests/fixtures/structural-subtype-consumers/${profile}.${profile}`).toString();
		const caller = route === "ordinary" ? originalSource : originalSource.replaceAll(/arg([01])/gu, "value$1");
		assert.equal((await read(`consumers/${profile}.${profile}`)).toString(), caller);
		assert.equal(item.consumerSha256, sha256(caller));
		assert.deepEqual(item.packages, receipt.packages.filter(pkg => pkg.target === profile));
		assert.equal(item.runs.length, 2);
		for(const [position, name] of ["installed", "relocated"].entries())
		{
			const run = await json(`${profile}/${name}.json`); assert.deepEqual(run, item.runs[position]);
			assert.equal(run.code, 0); assert.equal(run.stderr, "");
			assert.equal(run.stdout, `structural-subtype-ok:${item.checks}\n`); assert.equal(run.relocated, position === 1);
			digest(run.receiptSha256); digest(run.packageFileSetSha256);
		}
		assert.equal(item.runs[0].receiptSha256, item.runs[1].receiptSha256);
		assert.equal(item.runs[0].packageFileSetSha256, item.runs[1].packageFileSetSha256);
	}
	return { route, producerCommit, profiles: report.profiles, checks: report.reports.map(item => item.checks), dispatchObserved: false };
};
