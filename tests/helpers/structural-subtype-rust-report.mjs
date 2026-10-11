/**
 * Check original structural Rust execution records without reopening historical paths.
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
import { structuralSubtypeRustConfiguration, structuralSubtypeRustCounts, parseStructuralSubtypeRustResult } from "./structural-subtype-rust-fixture.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
export const structuralSubtypeRustRecords = Object.freeze([
	"report.json", "expected.binding-ir.json", "configuration.json", "consumer.rs"
	, "installed.json", "relocated.json", "dependencies.json"
	, "public.rs", "package.Cargo.lock", "consumer.Cargo.lock"
	, "package-receipt.json"
	, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json", "StructuralSubtypes.lean"].map(path => `build-${index}/${path}`))
]);

/**
 * Require exact Rust author contracts and complete relocated observations.
 *
 * @param read - Original route-relative record reader.
 * @param options - Independent frozen producer and route selection.
 * @param options.route - Ordinary or reviewed author configuration.
 * @param options.producerCommit - Actual installed producer revision.
 */
export const checkStructuralSubtypeRustReport = async (read, { route, producerCommit }) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Original canonical record: ${path}`);
		return value;
	};
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
	const expected = structuralSubtypeReview(), configuration = structuralSubtypeRustConfiguration(route), report = await json("report.json");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.configuration, configuration); assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"]) assert.equal(report[key], true, key);
	assert.ok(["2.36", "2.38"].includes(report.declaredGlibcFloor));
	assert.deepEqual(report.dispatch, { observed: false, reason: "No Rust entry counters in this installed acceptance" });
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
		assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["cargo"]);
		assert.deepEqual(report.builds[index], {
			modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256])))
		});
	}
	const source = original("tests/fixtures/structural-subtype-consumers/rust.rs").toString();
	const caller = route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
	assert.equal((await read("consumer.rs")).toString(), caller);
	assert.equal(report.installed.consumerSha256, sha256(caller));
	assert.equal(report.installed.checks, structuralSubtypeRustCounts.checks);
	assert.deepEqual(report.installed.result, structuralSubtypeRustCounts);
	for(const key of ["offlineInstall", "compilerFreePath"]) assert.equal(report.installed[key], true, key);
	const packageBytes = await read("package-receipt.json"), packageReceipt = await json("package-receipt.json");
	const model = await json("build-0/model.json"), pkg = report.receipt.packages[0];
	assert.equal(packageReceipt.kind, "lean-bridge-ordinary-cargo-package");
	assert.equal(packageReceipt.ecosystem, "cargo"); assert.equal(packageReceipt.schemaVersion, 1);
	assert.equal(packageReceipt.name, pkg.name); assert.equal(packageReceipt.version, pkg.version);
	assert.equal(packageReceipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(packageReceipt.glibcMinimumVersion, report.declaredGlibcFloor);
	assert.equal(packageReceipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(packageReceipt.sourceIdentity, model.sourceIdentity);
	assert.deepEqual(packageReceipt.component, model.component);
	digest(packageReceipt.compiledProjectionSha256); digest(report.executableSha256);
	for(const [record, path] of [["public.rs", "src/lib.rs"], ["package.Cargo.lock", "Cargo.lock"], ["build-0/model.json", "lean-bridge/component/model.json"]])
	{
		const bytes = await read(record);
		assert.deepEqual(packageReceipt.files[path], { bytes: bytes.length, sha256: sha256(bytes) });
	}
	const dependencies = await json("dependencies.json");
	assert.deepEqual(report.dependencies, dependencies);
	assert.equal(dependencies.archive, "rust-dependencies.tar.gz"); digest(dependencies.sha256);
	assert.equal(dependencies.lockSha256, sha256(await read("package.Cargo.lock")));
	// Both original lockfiles must carry exactly the vendored registry identities.
	for(const path of ["package.Cargo.lock", "consumer.Cargo.lock"])
	{
		const lock = (await read(path)).toString();
		const registry = lock.split("[[package]]").filter(block => block.includes('source = "registry+')).map(block => ({
			directory: block.match(/^name = "([^"]+)"$/mu)[1] + "-" + block.match(/^version = "([^"]+)"$/mu)[1]
			, checksum: block.match(/^checksum = "([a-f0-9]{64})"$/mu)[1]
		})).sort((a, b) => a.directory.localeCompare(b.directory));
		assert.deepEqual(registry, dependencies.packages.map(({ directory, checksum }) => ({ directory, checksum })));
	}
	assert.ok(dependencies.packages.some(item => item.directory === "num-bigint-0.4.6"));
	assert.ok(dependencies.packages.some(item => item.directory === "sha2-0.10.9"));
	for(const dependency of dependencies.packages)
	{
		digest(dependency.checksum); digest(dependency.manifestSha256);
		assert.ok(Number.isSafeInteger(dependency.files) && dependency.files > 0);
	}
	for(const name of ["cargo", "rustc"])
	{
		assert.match(report.toolchain[name].version, new RegExp(`^${name} 1\\.(?:9[0-9]|[1-9][0-9]{2,})\\.[0-9]+ \\(`, "u"));
		digest(report.toolchain[name].sha256);
	}
	const closure = { receiptSha256: sha256(packageBytes)
		, packageFileSetSha256: sha256(canonicalJson([...Object.keys(packageReceipt.files), "lean-bridge/package-receipt.json"].sort())) };
	assert.equal(report.observations.length, 2);
	for(const [position, name] of ["installed", "relocated"].entries())
	{
		const observation = await json(`${name}.json`); assert.deepEqual(observation, report.observations[position]);
		assert.equal(observation.relocated, Boolean(position));
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
		assert.deepEqual(parseStructuralSubtypeRustResult(observation.run.stdout), structuralSubtypeRustCounts);
		assert.deepEqual(observation.counts, structuralSubtypeRustCounts);
		assert.deepEqual(observation.closure, closure);
	}
	return {
		route, producerCommit
		, ...structuralSubtypeRustCounts
		, executions: 2, rustc: report.toolchain.rustc.version
		, dispatchObserved: false
		, archives: report.builds[0].archives };
};
