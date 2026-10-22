/**
 * Authenticate original recursive checked-record PHP-Wasm compiler models, packages and executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { compilerExportSelection } from "../../src/analyze/export-configuration.mjs";
import { reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";
import {
	checkRecursiveCheckedRecordPhpWasmExecutions, checkRecursiveCheckedRecordPhpWasmModel
	, recursiveCheckedRecordPhpWasmConfiguration, recursiveCheckedRecordPhpWasmExpected
	, recursiveCheckedRecordPhpWasmPackage, recursiveCheckedRecordPhpWasmReview
} from "./recursive-checked-record-php-wasm-fixture.mjs";
import {
	checkRecursiveCheckedRecordPhpWasmConsumers, checkRecursiveCheckedRecordPhpWasmContext
	, checkRecursiveCheckedRecordPhpWasmDeployment, checkRecursiveCheckedRecordPhpWasmReportClaims
	, checkRecursiveCheckedRecordPhpWasmTransport, recursiveCheckedRecordPhpWasmCallers
} from "./recursive-checked-record-php-wasm-checks.mjs";
import { assertNestedCheckedRecordPhpResources as assertRecursiveCheckedRecordPhpWasmResources } from "./nested-checked-record-php-resources.mjs";
import { assertPhpWasmRefinementPackage } from "./php-wasm-fin-direct-report.mjs";
import { phpWasmDriverHashes, phpWasmIsolationFlags } from "./type-corpus-php-wasm-evidence.mjs";
import {
	recursiveCheckedRecordPhpWasmProducer
	, recursiveCheckedRecordPhpWasmProducerCallerBlob
} from "./recursive-checked-record-php-wasm-provenance.mjs";
import { recursiveCheckedRecordPhpWasmOriginal, recursiveCheckedRecordPhpWasmGenerators } from "./recursive-checked-record-php-wasm-sources.mjs";
import { readClosedPackageZip } from "./closed-package-zip.mjs";
import { readOwnedPerlCallbackVariantTar } from "./owned-perl-callback-result-variant-archives.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const exact = (object, keys) => assert.deepEqual(Object.keys(object).sort(), [...keys].sort());
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const subset = (files, prefix) => Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith(prefix)).map(([path, value]) => [path.slice(prefix.length), value]));
const deploymentRecords = Object.freeze([
	"package.json", "package-lock.json", "composer.json", "composer.lock"
	, "vendor/composer/installed.json", "driver.mjs", "node.mjs", "browser.mjs"
	, "weak.php", "strict.php", "request-embedded.json", "request-composer.json"
]);

/**
 * Authenticate complete installed originals without reopening historical paths.
 *
 * @param read - Selection-relative original byte reader.
 * @param options - Independent producer and API selection.
 * @param options.route - Ordinary source or independent review.
 * @param options.fixture - Recursive or mutual module.
 * @param options.producerCommit - Immutable original producer revision.
 */
export const checkRecursiveCheckedRecordPhpWasmReport = async (read, { route, fixture, producerCommit }) => {
	const { settings, root: fixtureRoot, leanModule } = recursiveCheckedRecordPhpWasmPackage(fixture);
	const componentName = `${fixture}checkedrecords`;
	const files = new Map();
	const bytes = async path => {
		assert.ok(/^[A-Za-z0-9_@.+/-]+$/u.test(path) && !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== ".."));
		if(!files.has(path))
		{ const data = await read(path); assert.ok(Buffer.isBuffer(data), path); files.set(path, data); }
		return files.get(path);
	};
	const text = async path => (await bytes(path)).toString();
	const json = async path => { const source = await text(path), value = JSON.parse(source); assert.equal(source, canonicalJson(value), path); return value; };
	const original = path => recursiveCheckedRecordPhpWasmOriginal(producerCommit, path);
	const expected = recursiveCheckedRecordPhpWasmReview(fixture), configuration = recursiveCheckedRecordPhpWasmConfiguration(route, fixture);
	const report = await json("report.json");
	checkRecursiveCheckedRecordPhpWasmReportClaims(report, { route, fixture, producerCommit });
	assert.deepEqual(await json("configuration.json"), configuration); assert.deepEqual(report.configuration, configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected); assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	checkRecursiveCheckedRecordPhpWasmContext(await json("context.json"), report);
	const resources = await json("resources.json"); assert.equal(resources.length, 4);
	resources.forEach(resource => assertRecursiveCheckedRecordPhpWasmResources(resource, report.loadCeiling));
	const inputs = { "lean-bridge.exports.json": Buffer.from(canonicalJson(configuration)) };
	for(const path of [`${leanModule}.lean`, "lakefile.toml", "lean-toolchain", "LICENSE", "package.json"])
		inputs[path] = original(`${fixtureRoot}/${path}`);
	const source = inputs[`${leanModule}.lean`];
	if(route === "reviewed") inputs["api.binding-ir.json"] = Buffer.from(canonicalJson(expected));
	for(const index of [0, 1])
	{
		const prefix = `build-${index}/`, model = await json(prefix + "model.json"), receipt = await json(prefix + "package-set-receipt.json");
		validatePackageSetReceipt(receipt); validateBindingIr(model.bindingIr); assert.deepEqual(receipt, report.receipt);
		checkRecursiveCheckedRecordPhpWasmModel(model, route, fixture); assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.deepEqual(await bytes(prefix + `${leanModule}.lean`), source);
		const provenance = model.sourceIdentity;
		assert.equal(provenance.modules.length, 1); assert.equal(provenance.modules[0].module, leanModule);
		assert.deepEqual(provenance.modules[0].source, { path: `root/${leanModule}.lean`, mode: 420, ...identity(source) });
		assert.equal(provenance.extractorSha256, sha256(original("src/analyze/NativeExports.lean")));
		assert.equal(await text(prefix + "lean-bridge.exports.json"), canonicalJson(configuration));
		assert.equal(provenance.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(provenance.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		for(const key of ["leanCompilerSha256", "sourceTreeSha256"]) digest(provenance[key]);
		assert.deepEqual(provenance.request.metadata.modules.map(item => item.sourceSha256), [sha256(source)]);
		assert.equal(provenance.request.metadata.toolchain, inputs["lean-toolchain"].toString().trim());
		if(route === "reviewed")
		{
			assert.equal(await text(prefix + "api.binding-ir.json"), canonicalJson(expected));
			assert.deepEqual(provenance.reviewedBindingIr, { path: "api.binding-ir.json", schemaVersion: 1, semanticSha256: hashBindingIr(expected), source: canonicalJson(expected), sourceSha256: sha256(canonicalJson(expected)) });
		} else assert.equal(provenance.reviewedBindingIr, undefined);
		const selection = route === "reviewed" ? reviewedSourceSelection(provenance.reviewedBindingIr) : compilerExportSelection(configuration);
		assert.deepEqual(provenance.request.exports, route === "reviewed" ? selection.exports : configuration.exports);
		for(const key of ["arities", "resources"]) assert.deepEqual(provenance.request[key], []);
		for(const key of ["modules", "exportModules"]) assert.deepEqual(provenance.request[key], [leanModule]);
		assert.equal(provenance.request.profile, "native-library-v1");
		for(const key of ["contracts", "specializations"]) assert.deepEqual(provenance.request[key], selection[key]);
		const snapshot = await json(prefix + "author-inputs.json");
		assert.deepEqual(snapshot.map(item => item.path), Object.keys(inputs).sort());
		for(const item of snapshot)
		{
			exact(item, ["path", "sha256", "mode", "mtime", "ctime"]);
			assert.equal(item.sha256, sha256(inputs[item.path])); assert.equal(item.mode & 0o170000, 0o100000);
			assert.ok(Number.isFinite(item.mtime) && item.mtime > 0); assert.ok(Number.isFinite(item.ctime) && item.ctime > 0);
		}
		assert.equal(receipt.source.treeSha256, provenance.sourceTreeSha256); assert.deepEqual(receipt.component, model.component);
		assert.deepEqual(model.component, { id: `${componentName}@1.0.0`, name: componentName, version: "1.0.0" });
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].id, "php-wasm-copied-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(await json(prefix + "php-wasm-package-set.json"), report.phpWasm.packageSet);
		assert.deepEqual(report.builds[index], { bindingIrSha256: model.bindingIrSha256, modelSha256: sha256(await bytes(prefix + "model.json")), receiptSha256: sha256(await bytes(prefix + "package-set-receipt.json")), packageSetSha256: sha256(await bytes(prefix + "php-wasm-package-set.json")), archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))) });
	}
	const model = await json("build-0/model.json"), evidence = report.phpWasm;
	exact(evidence, ["browserSha256", "browserVersion", "compilerFreeExecution"
		, "component", "composer", "consumerSources", "deployment", "driverSha256"
		, "emptyCaches", "executions", "host", "lockedInstall", "nodeSha256"
		, "nodeVersion", "npm", "offlineInstall", "packageSet", "publicApiOnly"
		, "relocated", "repeatExecution", "requests", "runtime"
		, "unchangedDeployment"]);
	const { component, runtime, packageSet: set, deployment } = evidence;
	const packaged = { settings, module: leanModule };
	assertPhpWasmRefinementPackage({ phpWasm: evidence, packages: report.receipt.packages, ...report.builds[0] }, packaged, componentName, source.toString());
	assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(component.bindingIrSha256, model.bindingIrSha256); assert.equal(component.modelSha256, report.builds[0].modelSha256);
	assert.deepEqual(component.exports.map(item => item.declaration).sort(), model.exports.map(item => "lean:" + item.name).sort());
	assert.equal(component.runtimeIdentity, sha256(canonicalJson(runtime))); assert.equal(set.runtimeIdentity, component.runtimeIdentity);
	for(const flag of phpWasmIsolationFlags) assert.equal(evidence[flag], true, flag);
	for(const inventory of [set.files, deployment, evidence.host.files]) for(const [path, entry] of Object.entries(inventory))
	{
		assert.match(path, /^[A-Za-z0-9_@.+/-]+$/u); assert.ok(!path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== ".."));
		exact(entry, ["bytes", "sha256"]); assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); digest(entry.sha256);
	}
	const receiptBytes = await bytes("handoff/package-set-receipt.json");
	assert.equal(receiptBytes.toString(), canonicalJson(report.receipt));
	assert.equal(await text("handoff/package-set-receipt.json.sha256"), sha256(receiptBytes) + "  package-set-receipt.json\n");
	assert.equal(set.archives.length, 3);
	const unpacked = new Map();
	for(const pkg of report.receipt.packages)
	{
		assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.runtimeIdentity, component.runtimeIdentity);
		const artifact = pkg.artifacts[0], packed = set.archives.find(item => item.role === pkg.role); assert.ok(packed);
		for(const key of ["name", "version", "ecosystem"]) assert.equal(packed[key], pkg[key]);
		assert.equal(packed.archive, basename(artifact.path)); assert.equal(packed.sha256, artifact.sha256); assert.equal(packed.bytes, artifact.bytes);
		assert.deepEqual(set.files[`archives/${packed.archive}`], { bytes: artifact.bytes, sha256: artifact.sha256 });
		const archived = await bytes("handoff/" + artifact.path);
		assert.deepEqual(identity(archived), { bytes: artifact.bytes, sha256: artifact.sha256 });
		const members = pkg.ecosystem === "composer" ? readClosedPackageZip(archived) : readOwnedPerlCallbackVariantTar(archived, "package", set.packing.collationLocale);
		const closure = Object.fromEntries([...members].map(([path, contents]) => [path, identity(contents)]));
		assert.deepEqual(closure, subset(set.files, packed.directory + "/"));
		assert.deepEqual(subset(deployment, `${pkg.ecosystem === "composer" ? "vendor" : "node_modules"}/${pkg.name}/`), closure);
		unpacked.set(pkg.role, members);
	}
	assert.deepEqual(unpacked.get("component").get("compiled/model.json"), await bytes("build-0/model.json"));
	assert.equal(unpacked.get("component").get("compiled/php-wasm-component.json").toString(), canonicalJson(component));
	assert.equal(unpacked.get("runtime").get("compiled/runtime.json").toString(), canonicalJson(runtime));
	const componentRoot = `node_modules/${settings.npm.name}/compiled/`, runtimeRoot = "node_modules/@lean-bridge/php-wasm-copied-runtime/compiled/";
	assert.deepEqual(deployment[componentRoot + "model.json"], identity(await bytes("build-0/model.json")));
	assert.deepEqual(deployment[componentRoot + "php-wasm-component.json"], identity(canonicalJson(component)));
	assert.deepEqual(deployment[runtimeRoot + "runtime.json"], identity(canonicalJson(runtime)));
	const libraries = [componentRoot + component.library, runtimeRoot + runtime.library];
	assert.deepEqual(deployment[libraries[0]], component.wasmLibrary); assert.deepEqual(deployment[libraries[1]], runtime.files[runtime.library]);
	assert.equal(evidence.host.version, "0.1.0"); assert.deepEqual(subset(deployment, "node_modules/php-wasm/"), evidence.host.files);
	for(const [path, hash] of Object.entries(phpWasmDriverHashes))
	{
		assert.equal(sha256(await bytes("deployment/" + path)), hash); assert.equal(deployment[path].sha256, hash);
	}
	for(const path of deploymentRecords) assert.deepEqual(deployment[path], identity(await bytes("deployment/" + path)));
	// One pinned native-PHP caller serves both strictness modes; only host entry adapts.
	const callerBlob = producerCommit === recursiveCheckedRecordPhpWasmProducer
		? recursiveCheckedRecordPhpWasmProducerCallerBlob : undefined;
	await checkRecursiveCheckedRecordPhpWasmConsumers({ text, evidence
		, callers: recursiveCheckedRecordPhpWasmCallers(original, callerBlob)
		, fixture });
	validateBrickMathInstall(evidence.composer, deployment);
	const { generateCopiedPhpGraphZendAdapter, bundledBrickMath } = await recursiveCheckedRecordPhpWasmGenerators(producerCommit);
	const embedded = `node_modules/${settings.npm.name}/php/`;
	for(const [path, content] of Object.entries(bundledBrickMath())) assert.deepEqual(deployment[embedded + path], identity(content));
	checkRecursiveCheckedRecordPhpWasmTransport({ generator: generateCopiedPhpGraphZendAdapter, ir: model.bindingIr, component, members: unpacked });
	checkRecursiveCheckedRecordPhpWasmDeployment({ deployment, members: unpacked, settings });
	checkRecursiveCheckedRecordPhpWasmExecutions(evidence, fixture); assert.deepEqual(report.observation, recursiveCheckedRecordPhpWasmExpected(fixture));
	for(const [index, execution] of evidence.executions.entries())
	{
		assert.deepEqual(await json(`executions/${index}.json`), execution);
		if(execution.realm !== "chromium") continue;
		for(const request of execution.requests) assert.deepEqual({ bytes: request.bytes, sha256: request.sha256 }, deployment[request.path]);
		for(const path of ["browser.mjs", "driver.mjs", "bundled/consumer.mjs", "node_modules/php-wasm/PhpWeb.mjs", "request-embedded.json", execution.mode + ".php"])
			assert.ok(execution.requests.some(request => request.path === path), path);
		for(const path of libraries) assert.equal(execution.requests.filter(request => request.sha256 === deployment[path].sha256).length, 1);
		assert.ok(execution.requests.some(request => request.path.startsWith("node_modules/php-wasm/") && request.path.endsWith(".wasm")));
	}
	return { route, fixture, producerCommit, records: [...files.keys()].sort(), executions: evidence.executions.length, counts: recursiveCheckedRecordPhpWasmExpected(fixture), dispatchObserved: false, packageFiles: Object.fromEntries([...unpacked].map(([role, members]) => [role, members.size])) };
};
