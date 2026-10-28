/**
 * Ordinary and independently reviewed finite specializations in installed PHP-Wasm packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { installCopiedPhpWasm } from "./copied-fixture-php-wasm.mjs";
import { assertSignatureSpecializationIr } from "./signature-specialization-browser.mjs";
import { nativeSpecializationEnvironment, nativeSpecializations, nativeSpecializationSignatures } from "./native-specialization-install.mjs";
import { reviewedNativeSpecializationIr } from "./reviewed-native-specialization-fixture.mjs";

const fixture = "tests/fixtures/onboarding/native-specializations";
const consumerSource = "tests/fixtures/specialization-consumers/php-wasm.php";
const routes = Object.freeze(["ordinary-source", "reviewed-ir"]);
const executionTuples = Object.freeze([
	...(["embedded", "composer"].flatMap(arrangement =>
		["startup", "lazy"].flatMap(loading =>
			["weak", "strict"].map(mode =>
				`node/${arrangement}/${loading}/${mode}`))))
	, ...(["startup", "lazy"].flatMap(loading =>
		["weak", "strict"].map(mode =>
			`chromium/bundled/${loading}/${mode}`)))
].sort());
const expectedChecks = 2020;
const configuration = path => ({ schemaVersion: 1, modules: ["Specialized"]
	, targets: { "php-wasm": {
		npm: { name: "lean-bridge-specialized-wasm", version: "1.0.0" }
		, composer: { name: "lean-bridge/specialized-wasm", version: "1.0.0" }
	} }
	, ...(path === "ordinary-source" ? {
		exports: Object.keys(nativeSpecializationSignatures)
		, specializations: nativeSpecializations
	} : {}) });
const archiveIdentity = receipt => Object.fromEntries(receipt.packages.flatMap(pkg =>
	pkg.artifacts.map(artifact => [`${pkg.target}/${pkg.role}/${artifact.path}`, artifact.sha256])));

/**
 * Build one route twice, relocate its complete handoff and execute all PHP-Wasm arrangements.
 *
 * @param {import("node:test").TestContext} t - Active test context.
 * @param {"ordinary-source"|"reviewed-ir"} path - Author route to build and execute.
 */
export const checkSignatureSpecializationPhpWasmRoute = async (t, path) => {
	assert.ok(routes.includes(path));
	const producer = await mkdtemp(join(tmpdir(), `lean-bridge-signature-specialization-php-wasm-${path}-`));
	const consumer = await mkdtemp(join(tmpdir(), `lean-bridge-signature-specialization-php-wasm-consumer-${path}-`));
	let producerRemoved = false;
	t.after(async () => {
		if(!producerRemoved) await rm(producer, { recursive: true, force: true });
		await rm(consumer, { recursive: true, force: true });
	});
	const environment = nativeSpecializationEnvironment(["php-wasm"]);
	if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME)
		environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME = environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
	const builds = [], receipts = [], identities = [];
	for(const attempt of [0, 1])
	{
		const projectRoot = join(producer, `author-${attempt}`), outputRoot = join(producer, `build-${attempt}`);
		await cp(fixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration(path)));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(reviewedNativeSpecializationIr()));
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "php-wasm/component/model.json"), "utf8"));
		assert.equal(model.pointerBits, 32); assertSignatureSpecializationIr(model.bindingIr);
		const handoff = join(consumer, `handoff-${attempt}`), receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		receipts.push(receipt); identities.push(archiveIdentity(receipt));
		builds.push({
			bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json"))) });
	}
	assert.deepEqual(builds[1], builds[0]); assert.deepEqual(identities[1], identities[0]);
	const handoff = join(consumer, "relocated"); await rename(join(consumer, "handoff-0"), handoff);
	await rm(join(consumer, "handoff-1"), { recursive: true, force: true });
	await rm(producer, { recursive: true, force: true }); producerRemoved = true;
	await assert.rejects(stat(producer), { code: "ENOENT" });
	const observation = await installCopiedPhpWasm({
		consumer
		, handoff
		, packages: receipts[0].packages
		, environment
		, fixture: {
			source: () => readFile(consumerSource, "utf8")
			, success: "specialization-ok"
			, phpInvalid: "try { LeanSpecialized\\echo_word(\\Brick\\Math\\BigInteger::of('4294967296')); throw new Exception('Overflow accepted'); } catch (ValueError $error) {}"
			, removeHandoff: true
			, attestDeployment: true
		}
	});
	assert.equal(observation.executions.length, 12);
	assert.ok(observation.executions.every(item => item.checks === observation.checks));
	return {
		path
		, profile: "php-wasm"
		, producerCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
		, configuration: configuration(path)
		, reviewedBindingIrSha256: hashBindingIr(reviewedNativeSpecializationIr())
		, builds
		, packages: receipts[0].packages
		, archives: identities[0]
		, ...observation
		, independentBuilds: 2
		, reproducible: true
		, sourceRemovedBeforeInstallation: true
		, producerBuildsRemovedBeforeInstallation: true
		, handoffRelocatedBeforeInstallation: true
	};
};

/**
 * Validate the closed two-route PHP-Wasm report.
 *
 * @param {object} report - Closed two-route hosted report.
 */
export const validateSignatureSpecializationPhpWasmReport = report => {
	assert.deepEqual(Object.keys(report).sort(), ["kind", "reports", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.kind, "signature-specialization-php-wasm-installed-v1");
	assert.deepEqual(report.reports.map(item => item.path), routes);
	for(const item of report.reports)
	{
		assert.equal(item.profile, "php-wasm"); assert.equal(item.independentBuilds, 2);
		assert.deepEqual(item.builds[1], item.builds[0]);
		for(const flag of ["reproducible"
			, "sourceRemovedBeforeInstallation"
			, "producerBuildsRemovedBeforeInstallation"
			, "handoffRelocatedBeforeInstallation"
			, "offlineInstall"
			, "compilerFreePath"
			, "unchangedDeployment"
			, "handoffRemovedBeforeExecution"])
			assert.equal(item[flag], true, `${item.path}:${flag}`);
		assert.equal(item.checks, expectedChecks);
		assert.deepEqual(item.executions.map(value =>
			`${value.realm}/${value.arrangement}/${value.loading}/${value.mode}`
		).sort(), executionTuples);
		assert.ok(item.executions.every(value => value.checks === expectedChecks));
	}
	return report;
};
