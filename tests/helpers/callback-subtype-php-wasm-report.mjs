/**
 * Authenticate retained callback Subtype PHP-Wasm source, package and runtime
 * evidence without trusting the report's own inventory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";
import { callbackSubtypeReviewedIr } from "./callback-subtype-fixture.mjs";
import {
	adaptCallbackSubtypePhpWasm, callbackSubtypePhpWasmConfiguration
	, callbackSubtypePhpWasmRequest
	, checkCallbackSubtypePhpWasmExecutions, checkCallbackSubtypePhpWasmModel
} from "./callback-subtype-php-wasm-fixture.mjs";
import { phpWasmDriverHashes, phpWasmIsolationFlags } from "./type-corpus-php-wasm-evidence.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
export const callbackSubtypePhpWasmDeploymentRecords = Object.freeze([
	"package.json", "package-lock.json", "composer.json", "composer.lock"
	, "vendor/composer/installed.json", "driver.mjs", "node.mjs", "browser.mjs"
	, "weak.php", "strict.php", "request-embedded.json", "request-composer.json"
]);

/**
 * Fixed originals required independently of any report claims.
 *
 * @param route - Ordinary-source or independently reviewed author route.
 */
export const callbackSubtypePhpWasmRecords = route => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	return ["report.json", "configuration.json", "reviewed.binding-ir.json"
		, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json"
			, "php-wasm-package-set.json", "CallbackSubtypes.lean"
			, "lean-bridge.exports.json"
			, ...route === "reviewed" ? ["api.binding-ir.json"] : []]
			.map(path => `build-${index}/${path}`))
		, ...callbackSubtypePhpWasmDeploymentRecords.map(path => "deployment/" + path)
		, ...Array.from({ length: 12 }, (_, index) => `executions/${index}.json`)];
};

/**
 * Verify one route using only retained original bytes and immutable Git source.
 *
 * @param read - Route-relative original-record reader.
 * @param options - Expected route and exact producer revision.
 * @param options.route - Ordinary-source or reviewed author route.
 * @param options.producerCommit - Exact producer Git revision.
 */
export const checkCallbackSubtypePhpWasmReport = async (read, { route, producerCommit }) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const files = new Map();
	for(const path of callbackSubtypePhpWasmRecords(route))
	{
		const bytes = await read(path); assert.ok(Buffer.isBuffer(bytes), path); files.set(path, bytes);
	}
	const text = path => files.get(path).toString();
	const json = path => {
		const value = JSON.parse(text(path));
		assert.equal(text(path), canonicalJson(value), path);
		return value;
	};
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`]
		, { maxBuffer: 32 * 1024 * 1024 });
	const report = json("report.json"), configuration = callbackSubtypePhpWasmConfiguration(route);
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.configuration, configuration);
	assert.deepEqual(json("configuration.json"), configuration);
	for(const key of ["reproducible", "sourceRemovedBeforeInstallation"
		, "offlineInstall"
		, "compilerFreeReplay", "relocatedInstallation"])
		assert.equal(report[key], true, key);
	assert.equal(report.independentBuilds, 2);
	assert.deepEqual(report.callbackBoundaries, {
		host: true
		, closure: true
		, scalar: true
		, mixed: true
		, nestedContainers: true
		, firstError: true
		, cleanup: true
		, recovery: true });
	const review = json("reviewed.binding-ir.json");
	assert.equal(report.reviewedBindingIrSha256, hashBindingIr(review));
	assert.equal(review.producers.length, 1);
	assert.equal(review.producers[0].adapter, "independent-callback-subtype-review");
	assert.deepEqual(report.builds[1], report.builds[0]);
	assert.equal(report.builds.length, 2);
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, model = json(prefix + "model.json");
		const receipt = json(prefix + "package-set-receipt.json");
		validatePackageSetReceipt(receipt);
		assert.deepEqual(receipt, report.receipt);
		checkCallbackSubtypePhpWasmModel(model, review, route);
		assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		assert.deepEqual(callbackSubtypeReviewedIr(model.bindingIr), review);
		assert.deepEqual(files.get(prefix + "CallbackSubtypes.lean")
			, original("tests/fixtures/onboarding/callback-subtypes/CallbackSubtypes.lean"));
		assert.equal(text(prefix + "lean-bridge.exports.json"), canonicalJson(configuration));
		assert.equal(model.sourceIdentity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(model.sourceIdentity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		if(route === "reviewed")
		{
			assert.equal(text(prefix + "api.binding-ir.json"), canonicalJson(review));
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(review));
			assert.equal(model.sourceIdentity.reviewedBindingIr.semanticSha256, hashBindingIr(review));
		}
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		assert.equal(receipt.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.deepEqual(json(prefix + "php-wasm-package-set.json"), report.phpWasm.packageSet);
		assert.deepEqual(report.builds[attempt], {
			modelSha256: sha256(files.get(prefix + "model.json"))
			, receiptSha256: sha256(files.get(prefix + "package-set-receipt.json"))
			, packageSetSha256: sha256(files.get(prefix + "php-wasm-package-set.json"))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts
				.map(item => [item.path, item.sha256])))
		});
	}
	const model = json("build-0/model.json"), evidence = report.phpWasm;
	assert.equal(evidence.component.bindingIrSha256, model.bindingIrSha256);
	assert.equal(evidence.component.modelSha256, report.builds[0].modelSha256);
	assert.equal(evidence.component.pointerBits, 32); assert.equal(evidence.runtime.pointerBits, 32);
	assert.equal(evidence.component.runtimeIdentity, sha256(canonicalJson(evidence.runtime)));
	assert.equal(evidence.packageSet.runtimeIdentity, evidence.component.runtimeIdentity);
	for(const key of phpWasmIsolationFlags) assert.equal(evidence[key], true, key);
	for(const inventory of [evidence.packageSet.files, evidence.deployment, evidence.host.files])
		for(const [path, entry] of Object.entries(inventory))
		{
			assert.match(path, /^[A-Za-z0-9_@.+/-]+$/u);
			assert.ok(!path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== ".."));
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); digest(entry.sha256);
		}
	for(const path of callbackSubtypePhpWasmDeploymentRecords)
		assert.deepEqual(evidence.deployment[path], identity(files.get("deployment/" + path)), path);
	for(const [path, hash] of Object.entries(phpWasmDriverHashes))
		assert.equal(sha256(files.get("deployment/" + path)), hash, path);
	const caller = original("tests/fixtures/callback-subtype-consumers/php-wasm.php").toString();
	for(const mode of ["weak", "strict"])
	{
		const source = adaptCallbackSubtypePhpWasm(caller, mode);
		assert.equal(text("deployment/" + mode + ".php"), source);
		assert.equal(evidence.consumerSources[mode], sha256(source));
	}
	for(const arrangement of ["embedded", "composer"])
	{
		const request = callbackSubtypePhpWasmRequest(arrangement);
		assert.equal(text(`deployment/request-${arrangement}.json`), request);
		assert.equal(evidence.requests[arrangement], sha256(request));
	}
	validateBrickMathInstall(evidence.composer, evidence.deployment);
	checkCallbackSubtypePhpWasmExecutions(evidence);
	assert.deepEqual(report.observation, evidence.executions[0].observation);
	const browserLibraries = [evidence.component.library, evidence.runtime.library].map(library => {
		const matches = Object.entries(evidence.deployment)
			.filter(([path]) => path.endsWith("/" + library));
		assert.equal(matches.length, 1, library);
		return matches[0][1];
	});
	for(const [index, execution] of evidence.executions.entries())
	{
		assert.deepEqual(json(`executions/${index}.json`), execution);
		if(execution.realm !== "chromium") continue;
		for(const path of ["browser.mjs", "driver.mjs", "bundled/consumer.mjs"
			, "node_modules/php-wasm/PhpWeb.mjs"
			, "request-embedded.json"
			, execution.mode + ".php"])
			assert.ok(execution.requests.some(request => request.path === path), path);
		for(const library of browserLibraries)
			assert.ok(execution.requests.some(request => request.bytes === library.bytes
				&& request.sha256 === library.sha256), library.sha256);
	}
	const handoffReceipt = await read("handoff/package-set-receipt.json");
	assert.equal(handoffReceipt.toString(), canonicalJson(report.receipt));
	const sidecar = await read("handoff/package-set-receipt.json.sha256");
	assert.match(sidecar.toString(), new RegExp(`^${sha256(handoffReceipt)}  package-set-receipt\\.json\\n$`, "u"));
	for(const pkg of report.receipt.packages)
	{
		assert.equal(pkg.artifacts.length, 1);
		const artifact = pkg.artifacts[0], bytes = await read("handoff/" + artifact.path);
		assert.deepEqual(identity(bytes), { bytes: artifact.bytes, sha256: artifact.sha256 });
		const packed = evidence.packageSet.archives.find(item => item.role === pkg.role);
		assert.ok(packed); assert.equal(packed.archive, basename(artifact.path));
		assert.equal(packed.sha256, artifact.sha256); assert.equal(packed.bytes, artifact.bytes);
	}
	return { route, producerCommit, executions: evidence.executions.length
		, checks: evidence.executions[0].observation.checks };
};
