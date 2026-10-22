/**
 * Shared installed-report checks for ordinary and reviewed PHP-Wasm Fin evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { phpWasmExecutionTuples, phpWasmFinConsumer, phpWasmFinFixtures } from "./php-wasm-fin-fixtures.mjs";
import { phpWasmDriverHashes, phpWasmIsolationFlags } from "./type-corpus-php-wasm-evidence.mjs";

const subset = (files, prefix) => Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith(prefix)).map(([path, value]) => [path.slice(prefix.length), value]));

/**
 * Validate exact PHP-Wasm Fin fixtures, source routes, package identities and all installed executions.
 *
 * @param report - One original fixture report.
 * @param fixture - Independently authored fixture and contract.
 * @param caller - Authenticated native PHP consumer source.
 * @param requests - Request generator for each installed arrangement.
 * @param checks - Exact measured public assertion count.
 * @param reviewed - Whether an independently authored review selected this build.
 */
export const assertPhpWasmFinObservation = (report, fixture, caller, requests, checks, reviewed = false) => {
	assert.equal(phpWasmFinFixtures[report.fixture], fixture);
	assert.equal(report.label, `${reviewed ? "reviewed-" : ""}fin-${report.fixture}`);
	assertPhpWasmRefinementObservation(report, fixture, caller, requests, checks, reviewed);
};

/**
 * Validate one independently specified Fin fixture using the shared installed-package contract.
 * The caller separately validates the fixture name and run label.
 *
 * @param report - One installed fixture report.
 * @param fixture - Independent fixture and contract.
 * @param caller - Authenticated native PHP consumer source.
 * @param requests - Request generator for each installed arrangement.
 * @param checks - Exact public assertion count.
 * @param reviewed - Whether an independent review selected the build.
 */
export const assertPhpWasmRefinementObservation = (report, fixture, caller, requests, checks, reviewed) => {
	assert.equal(typeof reviewed, "boolean");
	assert.deepEqual(report.refinements, fixture.refinements);
	assert.equal(report.profile, "php-wasm"); assert.equal(report.path, reviewed ? "reviewed-source" : "ordinary-source");
	assert.equal(report.dispatch, "not measured");
	assert.equal(report.reproducible, true); assert.equal(report.sourceRemovedBeforeInstallation, true);
	const evidence = report.phpWasm, set = evidence.packageSet, component = evidence.component, runtime = evidence.runtime;
	for(const flag of phpWasmIsolationFlags) assert.equal(evidence[flag], true, flag);
	assert.equal(component.pointerBits, 32); assert.equal(runtime.pointerBits, 32);
	assert.deepEqual(component.exports.map(item => item.declaration).sort(),
		Object.keys(fixture.refinements).map(name => `lean:${name}`).sort());
	const identity = component.sourceIdentity, configuration = JSON.parse(identity.exportConfigurationSource);
	assert.equal(identity.exportConfigurationSha256, sha256(identity.exportConfigurationSource));
	assert.deepEqual(configuration, { schemaVersion: 1, modules: [fixture.module]
		, ...(reviewed ? {} : { exports: Object.keys(fixture.refinements)
			, ...fixture.contracts ? { contracts: fixture.contracts } : {}
			, ...fixture.specializations ? { specializations: fixture.specializations } : {} })
		, targets: { "php-wasm": fixture.settings } });
	if(reviewed)
	{
		const review = fixture.review(), source = canonicalJson(review);
		assert.equal(report.reviewedBindingIrSha256, hashBindingIr(review));
		assert.deepEqual(identity.reviewedBindingIr, {
			path: "api.binding-ir.json"
			, schemaVersion: 1
			, semanticSha256: hashBindingIr(review)
			, source
			, sourceSha256: sha256(source) });
	}
	else
	{
		assert.equal(report.reviewedBindingIrSha256, undefined);
		assert.equal(identity.reviewedBindingIr, undefined);
	}
	assert.equal(runtime.pins.phpVersion, "8.4.1"); assert.equal(runtime.pins.emscriptenVersion, "3.1.68");
	assert.equal(component.bindingIrSha256, report.bindingIrSha256); assert.equal(component.modelSha256, report.modelSha256);
	assert.equal(component.runtimeIdentity, sha256(canonicalJson(runtime)));
	assert.equal(set.runtimeIdentity, component.runtimeIdentity);
	assert.equal(report.packages.length, 3); assert.equal(set.archives.length, 3);
	assert.equal(Object.keys(report.archives).length, 3);
	const deployed = evidence.deployment;
	for(const pkg of report.packages)
	{
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.runtimeIdentity, component.runtimeIdentity);
		const artifact = pkg.artifacts[0], packed = set.archives.find(item => item.role === pkg.role);
		assert.ok(packed); assert.equal(packed.name, pkg.name); assert.equal(packed.version, pkg.version);
		assert.equal(packed.ecosystem, pkg.ecosystem);
		assert.equal(packed.archive, basename(artifact.path));
		assert.equal(packed.sha256, artifact.sha256); assert.equal(packed.bytes, artifact.bytes);
		assert.equal(report.archives[artifact.path], artifact.sha256);
		assert.deepEqual(set.files[`archives/${packed.archive}`], { sha256: artifact.sha256, bytes: artifact.bytes });
		const destination = `${pkg.ecosystem === "composer" ? "vendor" : "node_modules"}/${pkg.name}/`;
		assert.deepEqual(subset(deployed, destination), subset(set.files, `${packed.directory}/`));
	}
	const componentRoot = `node_modules/${fixture.settings.npm.name}/compiled/`;
	const runtimeRoot = "node_modules/@lean-bridge/php-wasm-copied-runtime/compiled/";
	assert.equal(deployed[componentRoot + "php-wasm-component.json"].sha256, sha256(canonicalJson(component)));
	assert.equal(deployed[componentRoot + "model.json"].sha256, report.modelSha256);
	assert.equal(deployed[runtimeRoot + "runtime.json"].sha256, component.runtimeIdentity);
	const libraryPaths = [componentRoot + component.library, runtimeRoot + runtime.library];
	assert.deepEqual(deployed[libraryPaths[0]], component.wasmLibrary);
	assert.deepEqual(deployed[libraryPaths[1]], runtime.files[runtime.library]);
	assert.deepEqual(subset(deployed, "node_modules/php-wasm/"), evidence.host.files);
	assert.equal(evidence.host.version, "0.1.0");
	for(const [path, hash] of Object.entries(phpWasmDriverHashes)) assert.equal(deployed[path].sha256, hash);
	for(const mode of ["weak", "strict"])
	{
		assert.equal(evidence.consumerSources[mode], sha256(phpWasmFinConsumer(caller, mode)));
		assert.equal(deployed[`${mode}.php`].sha256, evidence.consumerSources[mode]);
	}
	for(const arrangement of ["embedded", "composer"])
	{
		assert.equal(evidence.requests[arrangement], sha256(requests(arrangement)));
		assert.equal(deployed[`request-${arrangement}.json`].sha256, evidence.requests[arrangement]);
	}
	assert.deepEqual(evidence.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	const libraries = [basename(component.library), basename(runtime.library)].sort();
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, { checks, php: "8.4.1", word_bits: 32 });
		assert.deepEqual(execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() })),
			["ready", "autoload", "invalid", "complete"].map(stage => ({ stage, libraries: execution.loading === "startup" || stage === "complete" ? libraries : [] })));
		if(execution.realm !== "chromium") continue;
		for(const request of execution.requests) assert.deepEqual({ bytes: request.bytes, sha256: request.sha256 }, deployed[request.path]);
		for(const path of libraryPaths)
			assert.equal(execution.requests.filter(request => request.sha256 === deployed[path].sha256).length, 1);
		for(const path of ["bundled/consumer.mjs", "node_modules/php-wasm/PhpWeb.mjs", `${execution.mode}.php`])
			assert.ok(execution.requests.some(request => request.path === path), path);
	}
	assert.deepEqual(report.observation, evidence.executions[0].observation);
};
