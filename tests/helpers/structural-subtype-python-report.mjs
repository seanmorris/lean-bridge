/**
 * Check original structural Python execution records without reopening historical paths.
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
import { structuralSubtypePythonConfiguration, structuralSubtypePythonCounts, parseStructuralSubtypePythonResult } from "./structural-subtype-python-fixture.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
export const structuralSubtypePythonRecords = Object.freeze([
	"report.json", "expected.binding-ir.json", "configuration.json", "consumer.py"
	, "installed.json", "relocated.json"
	, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json", "StructuralSubtypes.lean"].map(path => `build-${index}/${path}`))
]);

/**
 * Require the selected Python minor, exact author contracts and complete relocated observations.
 *
 * @param read - Original route-relative record reader.
 * @param options - Independent frozen producer and route selection.
 * @param options.route - Ordinary or reviewed author configuration.
 * @param options.minor - Exact Python 3.11 or 3.12 floor.
 * @param options.producerCommit - Actual installed producer revision.
 */
export const checkStructuralSubtypePythonReport = async (read, { route, minor, producerCommit }) => {
	assert.ok(["ordinary", "reviewed"].includes(route)); assert.ok(["3.11", "3.12"].includes(minor));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Original canonical record: ${path}`);
		return value;
	};
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
	const expected = structuralSubtypeReview(), configuration = structuralSubtypePythonConfiguration(route), report = await json("report.json");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route); assert.equal(report.minor, minor);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.configuration, configuration); assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"]) assert.equal(report[key], true, key);
	assert.ok(["2.36", "2.38"].includes(report.declaredGlibcFloor));
	assert.deepEqual(report.dispatch, { observed: false, reason: "No Python entry counters in this installed acceptance" });
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
		assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["pypi"]);
		assert.deepEqual(report.builds[index], {
			modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256])))
		});
	}
	const source = original("tests/fixtures/structural-subtype-consumers/python.py").toString();
	const caller = route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
	assert.equal((await read("consumer.py")).toString(), caller);
	assert.equal(report.installed.consumerSha256, sha256(caller));
	assert.equal(report.installed.checks, structuralSubtypePythonCounts.checks);
	assert.deepEqual(report.installed.result, structuralSubtypePythonCounts);
	for(const key of ["offlineInstall", "compilerFreePath"]) assert.equal(report.installed[key], true, key);
	const environment = report.installed.pythonEnvironment;
	assert.match(environment.python, /^3\.(?:11|12)\.[0-9]+$/u);
	assert.equal(environment.python.split(".").slice(0, 2).join("."), minor);
	assert.equal(environment.site, `lib/python${minor}/site-packages`);
	digest(environment.baselineSha256); assert.notEqual(environment.baselineSha256, environment.expectedSha256);
	assert.equal(environment.expectedSha256, sha256(canonicalJson(environment.entries)));
	assert.equal(environment.interpreter.kind, "file"); digest(environment.interpreter.sha256);
	assert.ok(Number.isSafeInteger(environment.interpreter.bytes) && environment.interpreter.bytes > 0);
	const receiptPath = `${environment.site}/lean_structuralsubtypes/lean_bridge/package-receipt.json`;
	assert.equal(environment.entries[receiptPath].kind, "file"); assert.equal(environment.entries[receiptPath].sha256, environment.receiptSha256);
	for(const path of ["__init__.py", "__init__.pyi", "_native.py", "py.typed"])
		assert.equal(environment.entries[`${environment.site}/lean_structuralsubtypes/${path}`].kind, "file");
	assert.equal(report.observations.length, 2);
	for(const [position, name] of ["installed", "relocated"].entries())
	{
		const observation = await json(`${name}.json`); assert.deepEqual(observation, report.observations[position]);
		assert.equal(observation.relocated, Boolean(position));
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
		assert.deepEqual(parseStructuralSubtypePythonResult(observation.run.stdout), structuralSubtypePythonCounts);
		assert.deepEqual(observation.counts, structuralSubtypePythonCounts);
		assert.deepEqual(observation.closure, {
			baselineSha256: environment.baselineSha256
			, environmentSha256: environment.expectedSha256
			, interpreterSha256: environment.interpreter.sha256
			, python: environment.python
		});
	}
	return {
		route, minor, producerCommit
		, ...structuralSubtypePythonCounts
		, executions: 2, python: environment.python, dispatchObserved: false
		, archives: report.builds[0].archives };
};
