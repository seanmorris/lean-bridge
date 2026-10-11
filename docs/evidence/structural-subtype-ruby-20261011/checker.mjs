/**
 * Check original structural Ruby execution records without reopening historical paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypeRubyConfiguration, structuralSubtypeRubyCounts, parseStructuralSubtypeRubyResult } from "./structural-subtype-ruby-fixture.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
export const structuralSubtypeRubyRecords = Object.freeze([
	"report.json", "expected.binding-ir.json", "configuration.json", "consumer.rb"
	, "installed.json", "relocated.json"
	, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json", "StructuralSubtypes.lean"].map(path => `build-${index}/${path}`))
]);

/**
 * Require exact Ruby author contracts, authenticated gem environments and relocated observations.
 *
 * @param read - Original route-relative record reader.
 * @param options - Independent frozen producer and route selection.
 * @param options.route - Ordinary or reviewed author configuration.
 * @param options.producerCommit - Actual installed producer revision.
 */
export const checkStructuralSubtypeRubyReport = async (read, { route, producerCommit }) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Original canonical record: ${path}`);
		return value;
	};
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
	const expected = structuralSubtypeReview(), configuration = structuralSubtypeRubyConfiguration(route), report = await json("report.json");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.configuration, configuration); assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"]) assert.equal(report[key], true, key);
	assert.ok(["2.36", "2.38"].includes(report.declaredGlibcFloor));
	assert.deepEqual(report.dispatch, { observed: false, reason: "No Ruby entry counters in this installed acceptance" });
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	for(const index of [0, 1])
	{
		const modelBytes = await read(`build-${index}/model.json`), model = await json(`build-${index}/model.json`);
		const receiptBytes = await read(`build-${index}/package-set-receipt.json`), receipt = await json(`build-${index}/package-set-receipt.json`);
		validatePackageSetReceipt(receipt); assert.deepEqual(receipt, report.receipt);
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64); assert.equal(model.exports.length, 12);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		for(const declaration of expected.declarations)
		{
			const exported = model.exports.find(item => item.name === declaration.id.slice(5)); assert.ok(exported);
			assert.deepEqual(exported.refinements, declaration.source.extensions["lean-lang.org/refinements"]);
		}
		const source = await read(`build-${index}/StructuralSubtypes.lean`);
		assert.deepEqual(source, original("tests/fixtures/onboarding/structural-subtypes/StructuralSubtypes.lean"));
		assert.equal(model.sourceIdentity.modules.length, 1);
		assert.deepEqual(model.sourceIdentity.modules[0].source, { path: "StructuralSubtypes.lean", bytes: source.length, sha256: sha256(source) });
		assert.equal(model.sourceIdentity.extractorSha256, sha256(original("src/analyze/NativeExports.lean")));
		assert.equal(model.sourceIdentity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(model.sourceIdentity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.deepEqual(model.sourceIdentity.request.metadata.modules.map(item => item.sourceSha256), [sha256(source)]);
		digest(model.sourceIdentity.leanCompilerSha256);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		assert.equal(receipt.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["rubygems"]);
		assert.deepEqual(report.builds[index], {
			modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256])))
		});
	}
	const source = original("tests/fixtures/structural-subtype-consumers/ruby.rb").toString();
	const caller = route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
	assert.equal((await read("consumer.rb")).toString(), caller);
	assert.equal(report.installed.consumerSha256, sha256(caller));
	assert.equal(report.installed.checks, structuralSubtypeRubyCounts.checks);
	assert.deepEqual(report.installed.result, structuralSubtypeRubyCounts);
	for(const key of ["offlineInstall", "compilerFreePath"]) assert.equal(report.installed[key], true, key);
	const environment = report.installed.rubyEnvironment;
	assert.match(report.ruby, /^3\.[3-9]\.[0-9]+$/u);
	assert.equal(environment.fullName, "structuralsubtypes-1.0.0-x86_64-linux");
	assert.ok(environment.command.startsWith("/") && environment.gems.startsWith("/"));
	digest(environment.interpreter.sha256);
	assert.ok(Number.isSafeInteger(environment.interpreter.bytes) && environment.interpreter.bytes > 0);
	assert.equal(environment.expectedSha256, sha256(canonicalJson(environment.files)));
	const receiptBytes = Buffer.from(environment.receiptBytes), receipt = JSON.parse(receiptBytes);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	const model = await json("build-0/model.json"), pkg = report.receipt.packages[0];
	assert.equal(receipt.kind, "lean-bridge-ordinary-rubygems-package");
	assert.equal(receipt.ecosystem, "rubygems"); assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.namespace, "LeanBridge::Structuralsubtypes");
	assert.equal(receipt.requirePath, "lean_bridge/structuralsubtypes");
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.glibcMinimumVersion, report.declaredGlibcFloor);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.deepEqual(receipt.component, model.component);
	assert.deepEqual(receipt.files["lean-bridge/component/model.json"], {
		bytes: (await read("build-0/model.json")).length
		, sha256: sha256(await read("build-0/model.json")) });
	for(const path of ["lib/lean_bridge/structuralsubtypes.rb", "lib/lean_bridge/structuralsubtypes/native.rb"])
	{
		assert.ok(Number.isSafeInteger(receipt.files[path].bytes) && receipt.files[path].bytes > 0);
		digest(receipt.files[path].sha256);
	}
	const receiptPath = "lean-bridge/package-receipt.json";
	const payload = { ...receipt.files, [receiptPath]: { bytes: receiptBytes.length, sha256: sha256(receiptBytes) } };
	const filePaths = Object.keys(payload).map(path => `gems/${environment.fullName}/${path}`);
	const cache = `cache/${environment.fullName}.gem`, spec = `specifications/${environment.fullName}.gemspec`;
	assert.deepEqual(Object.keys(environment.files).sort(), [...filePaths, cache, spec].sort());
	for(const [path, identity] of Object.entries(payload))
		assert.deepEqual(environment.files[`gems/${environment.fullName}/${path}`], identity);
	assert.equal(environment.files[cache].sha256, pkg.artifacts[0].sha256);
	for(const identity of Object.values(environment.files))
	{
		assert.deepEqual(Object.keys(identity).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(identity.bytes) && identity.bytes >= 0); digest(identity.sha256);
	}
	const closure = { receiptSha256: sha256(receiptBytes)
		, packageFileSetSha256: sha256(canonicalJson(Object.keys(payload).sort()))
		, environmentSha256: environment.expectedSha256
		, interpreterSha256: environment.interpreter.sha256
		, gemspecSha256: environment.files[spec].sha256 };
	assert.equal(report.observations.length, 2);
	for(const [position, name] of ["installed", "relocated"].entries())
	{
		const observation = await json(`${name}.json`); assert.deepEqual(observation, report.observations[position]);
		assert.equal(observation.relocated, Boolean(position));
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
		assert.deepEqual(parseStructuralSubtypeRubyResult(observation.run.stdout), structuralSubtypeRubyCounts);
		assert.deepEqual(observation.counts, structuralSubtypeRubyCounts);
		assert.deepEqual(observation.closure, closure);
	}
	return {
		route, producerCommit
		, ...structuralSubtypeRubyCounts
		, executions: 2, ruby: report.ruby, dispatchObserved: false
		, archives: report.builds[0].archives };
};
