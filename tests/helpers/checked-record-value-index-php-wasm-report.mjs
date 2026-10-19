/**
 * Authenticate original value-indexed checked-record PHP-Wasm package records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { compilerExportSelection } from "../../src/analyze/export-configuration.mjs";
import { reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copiedPhpPublicSource } from "../../src/backends/php/copied-values.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import {
	checkedRecordValueIndexBrowserRoutes, checkedRecordValueIndexModule
	, checkedRecordValueIndexPackage
} from "./checked-record-value-index-browser-fixture.mjs";
import { assertCheckedRecordValueIndexProvenance } from "./checked-record-value-index-browser-report.mjs";
import {
	adaptCheckedRecordValueIndexPhpWasm, checkedRecordValueIndexPhpWasmRequest
	, checkedRecordValueIndexPhpWasmSelection, checkedRecordValueIndexPhpWasmSettings
	, checkCheckedRecordValueIndexPhpWasmExecutions
	, checkCheckedRecordValueIndexPhpWasmModel
} from "./checked-record-value-index-php-wasm-fixture.mjs";
import { assertPhpWasmRefinementPackage } from "./php-wasm-fin-direct-report.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";
import { phpWasmDriverHashes, phpWasmIsolationFlags } from "./type-corpus-php-wasm-evidence.mjs";

const identity = value => ({ bytes: Buffer.byteLength(value), sha256: sha256(value) });
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const subset = (files, prefix) => Object.fromEntries(Object.entries(files)
	.filter(([path]) => path.startsWith(prefix))
	.map(([path, value]) => [path.slice(prefix.length), value]));
export const checkedRecordValueIndexPhpWasmDeploymentRecords = Object.freeze([
	"package.json", "package-lock.json", "composer.json", "composer.lock"
	, "vendor/composer/installed.json", "driver.mjs", "node.mjs", "browser.mjs"
	, "weak.php", "strict.php", "request-embedded.json", "request-composer.json"
]);

/**
 * Return the route-relative closure independently of a producer's claimed inventory.
 *
 * @param route - Exact ordinary/reviewed and full/result-only author route.
 */
export const checkedRecordValueIndexPhpWasmRecords = route => {
	assert.ok(checkedRecordValueIndexBrowserRoutes.includes(route));
	return [
		"report.json"
		, "context.json"
		, "expected.binding-ir.json"
		, "configuration.json"
		, "weak.php", "strict.php", "request-embedded.json", "request-composer.json"
		, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json"
			, "php-wasm-package-set.json", "CheckedRecordValueIndices.lean"
			, "lean-bridge.exports.json"
			, ...route.endsWith("reviewed-ir") ? ["api.binding-ir.json"] : []]
			.map(path => `build-${index}/${path}`))
		, ...checkedRecordValueIndexPhpWasmDeploymentRecords.map(path => "deployment/" + path)
		, ...Array.from({ length: 12 }, (_, index) => `executions/${index}.json`)];
};

/**
 * Recheck retained bytes without trusting a producer-reported path or claim.
 *
 * @param read - Reads one original route-relative retained byte record.
 * @param root0 - Immutable route selection and producing revision.
 * @param root0.route - Exact ordinary/reviewed and full/result-only author route.
 * @param root0.producerCommit - Immutable package-producing Git revision.
 */
export const checkCheckedRecordValueIndexPhpWasmReport = async (read, { route, producerCommit }) => {
	assert.ok(checkedRecordValueIndexBrowserRoutes.includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const files = new Map();
	for(const path of checkedRecordValueIndexPhpWasmRecords(route))
	{
		const bytes = await read(path); assert.ok(Buffer.isBuffer(bytes), path); files.set(path, bytes);
	}
	const text = path => files.get(path).toString();
	const json = path => {
		const value = JSON.parse(text(path)); assert.equal(text(path), canonicalJson(value), path); return value;
	};
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`], {
		maxBuffer: 16 * 1024 * 1024
	});
	const { expected, configuration, reviewed } = checkedRecordValueIndexPhpWasmSelection(route);
	const report = json("report.json");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(json("configuration.json"), configuration);
	assert.deepEqual(report.configuration, configuration);
	assert.deepEqual(json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	for(const key of [
		"reproducible"
		, "sourceRemovedBeforeInstallation"
		, "offlineInstall"
		, "compilerFreeReplay"
		, "relocatedInstallation"
	])
		assert.equal(report[key], true, key);
	assert.equal(report.independentBuilds, 2);
	assert.deepEqual(report.dispatch, {
		observed: false
		, reason: "No entry counters in this unmodified PHP-Wasm package"
	});
	const context = json("context.json");
	assert.equal(context.producerCommit, producerCommit); assert.equal(context.route, route);
	assert.ok(context.directory.startsWith("/") && !context.directory.includes("\0"));
	assert.equal(context.consumer, context.directory + "/consumer");
	assert.equal(context.handoff, context.consumer + "/handoff");
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	for(const index of [0, 1])
	{
		const model = json(`build-${index}/model.json`);
		const receipt = json(`build-${index}/package-set-receipt.json`);
		validatePackageSetReceipt(receipt); assert.deepEqual(receipt, report.receipt);
		checkCheckedRecordValueIndexPhpWasmModel(model, route);
		assertCheckedRecordValueIndexProvenance(model.bindingIr);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		const source = files.get(`build-${index}/CheckedRecordValueIndices.lean`);
		assert.deepEqual(source, original("tests/fixtures/onboarding/checked-record-value-indices/CheckedRecordValueIndices.lean"));
		assert.equal(model.sourceIdentity.modules.length, 1);
		assert.deepEqual(model.sourceIdentity.modules[0].source, {
			path: "root/CheckedRecordValueIndices.lean", mode: 420, ...identity(source)
		});
		assert.equal(model.sourceIdentity.extractorSha256, sha256(original("src/analyze/NativeExports.lean")));
		assert.equal(text(`build-${index}/lean-bridge.exports.json`), canonicalJson(configuration));
		assert.equal(model.sourceIdentity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(model.sourceIdentity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		if(reviewed)
		{
			assert.equal(text(`build-${index}/api.binding-ir.json`), canonicalJson(expected));
			assert.deepEqual(model.sourceIdentity.reviewedBindingIr, {
				path: "api.binding-ir.json"
				, schemaVersion: 1
				, semanticSha256: hashBindingIr(expected)
				, source: canonicalJson(expected)
				, sourceSha256: sha256(canonicalJson(expected))
			});
		}
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		const selection = reviewed ? reviewedSourceSelection(model.sourceIdentity.reviewedBindingIr)
			: compilerExportSelection(configuration);
		assert.deepEqual(model.sourceIdentity.request.exports, reviewed ? selection.exports : configuration.exports);
		assert.deepEqual(model.sourceIdentity.request.arities, []);
		assert.deepEqual(model.sourceIdentity.request.resources, []);
		assert.deepEqual(model.sourceIdentity.request.modules, [checkedRecordValueIndexModule]);
		assert.deepEqual(model.sourceIdentity.request.exportModules, [checkedRecordValueIndexModule]);
		assert.equal(model.sourceIdentity.request.profile, "native-library-v1");
		for(const key of ["contracts", "specializations"])
			assert.deepEqual(model.sourceIdentity.request[key], selection[key], key);
		assert.equal(receipt.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1);
		assert.equal(receipt.profiles[0].id, "php-wasm-copied-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(json(`build-${index}/php-wasm-package-set.json`), report.phpWasm.packageSet);
		assert.deepEqual(report.builds[index], {
			modelSha256: sha256(files.get(`build-${index}/model.json`))
			, receiptSha256: sha256(files.get(`build-${index}/package-set-receipt.json`))
			, packageSetSha256: sha256(files.get(`build-${index}/php-wasm-package-set.json`))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts
				.map(item => [item.path, item.sha256])))
		});
	}
	const model = json("build-0/model.json");
	const evidence = report.phpWasm, { component, runtime, packageSet: set, deployment } = evidence;
	const fixture = { settings: checkedRecordValueIndexPhpWasmSettings
		, module: checkedRecordValueIndexModule };
	assertPhpWasmRefinementPackage({ phpWasm: evidence
		, packages: report.receipt.packages
		, bindingIrSha256: model.bindingIrSha256, ...report.builds[0] }, fixture
	, checkedRecordValueIndexPackage, text("build-0/CheckedRecordValueIndices.lean"));
	assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(component.pointerBits, 32); assert.equal(runtime.pointerBits, 32);
	assert.equal(component.bindingIrSha256, model.bindingIrSha256);
	assert.equal(component.modelSha256, report.builds[0].modelSha256);
	assert.deepEqual(component.exports.map(item => item.declaration).sort()
		, model.exports.map(item => "lean:" + item.name).sort());
	assert.equal(component.runtimeIdentity, sha256(canonicalJson(runtime)));
	assert.equal(set.runtimeIdentity, component.runtimeIdentity);
	for(const flag of phpWasmIsolationFlags) assert.equal(evidence[flag], true, flag);
	for(const inventory of [set.files, deployment, evidence.host.files])
		for(const [path, entry] of Object.entries(inventory))
		{
			assert.match(path, /^[A-Za-z0-9_@.+/-]+$/u);
			assert.ok(!path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== ".."));
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); digest(entry.sha256);
		}
	assert.equal(set.archives.length, 3);
	for(const pkg of report.receipt.packages)
	{
		assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.runtimeIdentity, component.runtimeIdentity);
		const artifact = pkg.artifacts[0];
		const packed = set.archives.find(item => item.role === pkg.role); assert.ok(packed);
		for(const key of ["name", "version", "ecosystem"]) assert.equal(packed[key], pkg[key]);
		assert.equal(packed.archive, basename(artifact.path));
		assert.equal(packed.sha256, artifact.sha256); assert.equal(packed.bytes, artifact.bytes);
		assert.deepEqual(set.files[`archives/${packed.archive}`], { bytes: artifact.bytes, sha256: artifact.sha256 });
		assert.deepEqual(subset(deployment, `${pkg.ecosystem === "composer" ? "vendor" : "node_modules"}/${pkg.name}/`)
			, subset(set.files, packed.directory + "/"));
	}
	const componentRoot = `node_modules/${fixture.settings.npm.name}/compiled/`;
	const runtimeRoot = "node_modules/@lean-bridge/php-wasm-copied-runtime/compiled/";
	assert.deepEqual(deployment[componentRoot + "model.json"], identity(files.get("build-0/model.json")));
	assert.deepEqual(deployment[componentRoot + "php-wasm-component.json"], identity(canonicalJson(component)));
	assert.deepEqual(deployment[runtimeRoot + "runtime.json"], identity(canonicalJson(runtime)));
	const libraries = [componentRoot + component.library, runtimeRoot + runtime.library];
	assert.deepEqual(deployment[libraries[0]], component.wasmLibrary);
	assert.deepEqual(deployment[libraries[1]], runtime.files[runtime.library]);
	assert.equal(evidence.host.version, "0.1.0");
	assert.deepEqual(subset(deployment, "node_modules/php-wasm/"), evidence.host.files);
	for(const [path, hash] of Object.entries(phpWasmDriverHashes))
	{
		assert.equal(sha256(files.get("deployment/" + path)), hash);
		assert.equal(deployment[path].sha256, hash);
	}
	for(const path of checkedRecordValueIndexPhpWasmDeploymentRecords)
		assert.deepEqual(deployment[path], identity(files.get("deployment/" + path)));
	const native = original("tests/fixtures/checked-record-value-index-php/php.php").toString();
	for(const mode of ["weak", "strict"])
	{
		const source = adaptCheckedRecordValueIndexPhpWasm(native, route, mode);
		assert.equal(text(mode + ".php"), source); assert.equal(text("deployment/" + mode + ".php"), source);
		assert.equal(evidence.consumerSources[mode], sha256(source));
	}
	for(const arrangement of ["embedded", "composer"])
	{
		const request = checkedRecordValueIndexPhpWasmRequest(route, arrangement);
		assert.equal(text(`request-${arrangement}.json`), request);
		assert.equal(text(`deployment/request-${arrangement}.json`), request);
		assert.equal(evidence.requests[arrangement], sha256(request));
	}
	validateBrickMathInstall(evidence.composer, deployment);
	const embedded = `node_modules/${fixture.settings.npm.name}/php/`;
	for(const [path, source] of Object.entries(bundledBrickMath()))
		assert.deepEqual(deployment[embedded + path], identity(source));
	const generated = copiedPhpPublicSource(compileCopiedPhpModel(model.bindingIr, {
		integerBits: 32, structuredCallables: true, lists: true, variants: true
	}));
	assert.deepEqual(deployment[componentRoot + "src/Api.php"], identity(generated));
	assert.deepEqual(deployment[`vendor/${fixture.settings.composer.name}/src/Api.php`]
		, deployment[componentRoot + "src/Api.php"]);
	checkCheckedRecordValueIndexPhpWasmExecutions(evidence, route);
	for(const [index, execution] of evidence.executions.entries())
	{
		assert.deepEqual(json(`executions/${index}.json`), execution);
		if(execution.realm !== "chromium") continue;
		for(const request of execution.requests)
			assert.deepEqual({ bytes: request.bytes, sha256: request.sha256 }, deployment[request.path]);
		for(const path of ["browser.mjs", "driver.mjs", "bundled/consumer.mjs"
			, "node_modules/php-wasm/PhpWeb.mjs"
			, "request-embedded.json"
			, execution.mode + ".php"])
			assert.ok(execution.requests.some(request => request.path === path), path);
		for(const path of libraries)
			assert.equal(execution.requests.filter(request => request.sha256 === deployment[path].sha256).length, 1);
		assert.ok(execution.requests.some(request => request.path.startsWith("node_modules/php-wasm/")
			&& request.path.endsWith(".wasm")));
	}
	return {
		route
		, producerCommit
		, records: files.size
		, executions: evidence.executions.length
		, counts: evidence.executions[0].observation
	};
};
