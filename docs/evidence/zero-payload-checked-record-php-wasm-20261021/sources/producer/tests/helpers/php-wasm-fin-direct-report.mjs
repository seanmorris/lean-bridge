/**
 * Check current direct Fin reports against independent fixtures and installed package identities.
 * Report consistency does not establish hosted provenance or measure dispatch.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { phpWasmCopiedPins } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { assertPhpWasmRefinementObservation } from "./php-wasm-fin-observation.mjs";
import { phpWasmDirectContainerSpec, phpWasmDirectScalar } from "./php-wasm-fin-direct-fixtures.mjs";
import { finContainerEdgeConsumer, finContainerEdgeSource } from "./fin-container-edges.mjs";
import { phpWasmDriverHashes } from "./type-corpus-php-wasm-evidence.mjs";

const closed = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const runtimeName = "@lean-bridge/php-wasm-copied-runtime";
export const phpWasmDirectChecks = Object.freeze({ scalar: 2028, containers: 14089 });

/**
 * Read the original scalar source and compose all original container-edge cases without compilation.
 */
export const phpWasmDirectReportInputs = async () => ({
	scalar: { fixture: phpWasmDirectScalar, name: "native-fin"
		, lean: await readFile(`${phpWasmDirectScalar.root}/NativeFin.lean`, "utf8")
		, caller: await readFile(phpWasmDirectScalar.consumer, "utf8") }
	, containers: { fixture: phpWasmDirectContainerSpec, name: "fincontainers"
		, lean: await finContainerEdgeSource()
		, caller: await finContainerEdgeConsumer("php-native") }
});

/**
 * Reconstruct the canonical handoff receipt, including its original package order.
 *
 * @param row - One complete installed fixture report.
 */
export const phpWasmDirectReceipt = row => ({
	schemaVersion: 1, kind: "lean-bridge-package-set-receipt"
	, component: row.phpWasm.packageSet.component
	, source: { treeSha256: row.phpWasm.component.sourceIdentity.sourceTreeSha256 }
	, profiles: [{ id: "php-wasm-copied-v1", bindingIrSha256: row.bindingIrSha256, runtimeIdentity: row.phpWasm.component.runtimeIdentity }]
	, packages: row.packages
});

const lockedInstall = (evidence, fixture) => {
	const { npm, composer, deployment } = evidence;
	for(const field of ["nodeSha256", "browserSha256", "driverSha256"]) hash(evidence[field]);
	assert.match(evidence.nodeVersion, /^v\d+\.\d+\.\d+$/u);
	assert.match(evidence.browserVersion, /^\d+\.\d+\.\d+\.\d+$/u);
	assert.equal(evidence.driverSha256, phpWasmDriverHashes["driver.mjs"]);
	hash(evidence.host.archiveSha256); hash(npm.toolSha256);
	assert.equal(npm.lockSha256, sha256(npm.lockText));
	assert.deepEqual(JSON.parse(npm.lockText), npm.lock);
	assert.deepEqual(npm.manifest, { private: true, type: "module"
		, dependencies: {
			"php-wasm": "file:./feed/host.tgz"
			, [fixture.settings.npm.name]: "file:./feed/component.tgz"
			, [runtimeName]: "file:./feed/runtime.tgz"
		}
	});
	assert.equal(deployment["package.json"].sha256, sha256(canonicalJson(npm.manifest)));
	assert.equal(deployment["package-lock.json"].sha256, npm.lockSha256);
	assert.deepEqual(npm.lock.packages[""].dependencies, npm.manifest.dependencies);
	closed(npm.lock.packages, ["", "node_modules/php-wasm", `node_modules/${fixture.settings.npm.name}`, `node_modules/${runtimeName}`]);
	for(const pkg of evidence.packageSet.archives.filter(item => item.ecosystem === "npm"))
		assert.equal(npm.lock.packages[`node_modules/${pkg.name}`].version, pkg.version);
	assert.equal(npm.lock.packages["node_modules/php-wasm"].version, "0.1.0");
	for(const field of ["hostSha256", "composerSha256", "probeSha256"]) hash(composer[field]);
	for(const [field, file] of [["lock", "composer.lock"], ["installed", "vendor/composer/installed.json"]])
	{
		assert.equal(composer[`${field}Sha256`], sha256(composer[`${field}Text`]));
		assert.deepEqual(JSON.parse(composer[`${field}Text`]), composer[field]);
		assert.equal(deployment[file].sha256, composer[`${field}Sha256`]);
	}
	assert.equal(composer.manifestSha256, sha256(canonicalJson(composer.manifest)));
	assert.equal(deployment["composer.json"].sha256, composer.manifestSha256);
	assert.deepEqual(composer.manifest.require, { [fixture.settings.composer.name]: fixture.settings.composer.version });
	assert.deepEqual(composer.manifest.config, { "allow-plugins": false, platform: { php: "8.4.1" } });
	assert.deepEqual(composer.manifest.repositories[0], { "packagist.org": false });
	for(const packages of [composer.lock.packages, composer.installed.packages])
	{
		assert.deepEqual(packages.map(pkg => pkg.name).sort(), ["brick/math", fixture.settings.composer.name].sort());
		assert.equal(packages.find(pkg => pkg.name === fixture.settings.composer.name).version, fixture.settings.composer.version);
	}
};

/**
 * Require both complete fixtures and every execution on one explicitly selected source route.
 *
 * @param archive - Parsed report from the installed producer.
 * @param route - Explicit ordinary-source or reviewed-source selection.
 * @param inputs - Independent original source and caller text for each fixture.
 */
export const assertPhpWasmDirectFinReport = (archive, route, inputs) => {
	assert.ok(["ordinary-source", "reviewed-source"].includes(route));
	const reviewed = route === "reviewed-source";
	closed(archive, ["schemaVersion", "reports"]); assert.equal(archive.schemaVersion, 1);
	assert.deepEqual(archive.reports.map(row => row.fixture), ["scalar", "containers"]);
	for(const row of archive.reports)
	{
		closed(row, ["archives", "bindingIrSha256", "dispatch", "fixture"
			, "fixtureSources", "label", "modelSha256", "observation"
			, "packages", "path", "phpWasm", "profile", "receiptSha256"
			, "refinements", "reproducible", "sourceRemovedBeforeInstallation"
			, ...reviewed ? ["reviewedBindingIrSha256"] : []]);
		const { fixture, name, lean, caller } = inputs[row.fixture];
		const request = arrangement => `${JSON.stringify({ module: fixture.namespace
			, operations: { probe: fixture.operation }
			, autoload: arrangement === "composer" ? "vendor/autoload.php" : `vendor/${fixture.settings.composer.name}/bootstrap.php` })}\n`;
		assert.equal(row.label, `direct-fin-${row.fixture}`);
		assert.deepEqual(row.fixtureSources, { leanSha256: sha256(lean), phpSha256: sha256(caller) });
		assertPhpWasmRefinementObservation(row, fixture, caller, request, phpWasmDirectChecks[row.fixture], reviewed);
		assertPhpWasmRefinementPackage(row, fixture, name, lean);
	}
	return true;
};

/**
 * Check runtime, package, receipt and offline installation identities for one refinement fixture.
 *
 * @param row - Original installed fixture report.
 * @param fixture - Independent package settings and module selection.
 * @param name - Original component name.
 * @param lean - Complete independent Lean source.
 */
export const assertPhpWasmRefinementPackage = (row, fixture, name, lean) => {
	for(const field of ["bindingIrSha256", "modelSha256", "receiptSha256"]) hash(row[field]);
	const { component, runtime, packageSet: set } = row.phpWasm, source = component.sourceIdentity;
	assert.deepEqual(set.component, { id: `${name}@1.0.0`, name, version: "1.0.0" });
	assert.equal(set.schemaVersion, 1); assert.equal(set.kind, "lean-bridge-php-wasm-copied-package-set");
	assert.equal(set.profile, "php-wasm-copied-loading-v1");
	assert.deepEqual(set.npmSettings, fixture.settings.npm); assert.deepEqual(set.composerSettings, fixture.settings.composer);
	assert.equal(set.componentIdentity, sha256(canonicalJson(component))); hash(set.loaderIdentity);
	for(const manifest of [component, runtime])
	{ assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.profile, "php-wasm-copied-v1"); }
	assert.deepEqual(runtime.pins, phpWasmCopiedPins);
	assert.deepEqual(component.compiler, runtime.compiler);
	assert.equal(component.compiler.emsdkCommit, phpWasmCopiedPins.emsdkCommit);
	assert.ok(component.compiler.version.endsWith(` ${phpWasmCopiedPins.emscriptenVersion} (${phpWasmCopiedPins.emscriptenCommit})`));
	for(const field of ["headerSha256", "phpHeadersSha256", "adaptersSha256", "zendSha256", "metadataSha256"]) hash(component[field]);
	assert.equal(source.leanCommit, phpWasmCopiedPins.leanCommit);
	for(const field of ["leanCompilerSha256", "extractorSha256", "sourceTreeSha256"]) hash(source[field]);
	assert.deepEqual(source.modules.map(item => item.module), [fixture.module]);
	assert.equal(source.modules[0].source.sha256, sha256(lean));
	assert.equal(source.modules[0].source.bytes, Buffer.byteLength(lean));
	const dependencies = source.lakeDependencies;
	assert.equal(dependencies.snapshotSha256, sha256(canonicalJson(dependencies.snapshot)));
	assert.equal(dependencies.resolutionSha256, sha256(canonicalJson(dependencies.resolution)));
	assert.equal(dependencies.resolution.snapshotSha256, dependencies.snapshotSha256);
	assert.equal(dependencies.snapshot.rootInputs.find(item => item.path === `${fixture.module}.lean`).sha256, sha256(lean));
	assert.equal(dependencies.resolution.modules.find(item => item.module === fixture.module).source.sha256, sha256(lean));
	assert.deepEqual(row.packages.map(pkg => pkg.role).sort(), ["api", "component", "runtime"]);
	for(const pkg of row.packages)
	{
		assert.equal(pkg.target, "php-wasm"); assert.equal(pkg.profile, "php-wasm-copied-v1");
		const identity = pkg.role === "api" ? fixture.settings.composer : pkg.role === "component" ? fixture.settings.npm
			: { name: runtimeName, version: `0.0.0-copied1.${set.loaderIdentity}` };
		assert.equal(pkg.name, identity.name); assert.equal(pkg.version, identity.version);
		assert.equal(pkg.ecosystem, pkg.role === "api" ? "composer" : "npm");
	}
	const receipt = phpWasmDirectReceipt(row); validatePackageSetReceipt(receipt);
	assert.equal(row.receiptSha256, sha256(canonicalJson(receipt)), "Installed packages must reconstruct the original handoff receipt");
	assert.deepEqual(row.archives, Object.fromEntries(row.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))));
	lockedInstall(row.phpWasm, fixture);
};
