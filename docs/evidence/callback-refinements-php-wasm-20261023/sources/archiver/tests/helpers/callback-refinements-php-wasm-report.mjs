/**
 * Independently authenticate retained Fin and checked-record callback PHP-Wasm
 * source, package, deployment and execution evidence.
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
import { callbackCheckedRecordReviewedIr } from "./callback-checked-record-fixture.mjs";
import {
	adaptCallbackCheckedRecordPhpWasm, callbackCheckedRecordPhpWasmConfiguration
	, callbackCheckedRecordPhpWasmRequest, checkCallbackCheckedRecordPhpWasmExecutions
	, checkCallbackCheckedRecordPhpWasmModel
} from "./callback-checked-record-php-wasm-fixture.mjs";
import {
	adaptCallbackFinPhpWasm, callbackFinPhpWasmConfiguration, callbackFinPhpWasmRequest
	, callbackFinPhpWasmReview, checkCallbackFinPhpWasmExecutions
	, checkCallbackFinPhpWasmModel
} from "./callback-fin-php-wasm-fixture.mjs";
import { phpWasmDriverHashes, phpWasmIsolationFlags } from "./type-corpus-php-wasm-evidence.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const deploymentRecords = Object.freeze([
	"package.json", "package-lock.json", "composer.json", "composer.lock"
	, "vendor/composer/installed.json", "driver.mjs", "node.mjs", "browser.mjs"
	, "weak.php", "strict.php", "request-embedded.json", "request-composer.json"
]);
const profiles = Object.freeze({
	fin: {
		source: "ReviewedCallbacks.lean"
		, sourcePath: "tests/fixtures/onboarding/reviewed-callback-fin/ReviewedCallbacks.lean"
		, callerPath: "tests/fixtures/reviewed-callback-fin-consumers/php-wasm.php"
		, configuration: callbackFinPhpWasmConfiguration
		, adapt: adaptCallbackFinPhpWasm
		, request: callbackFinPhpWasmRequest
		, expectedReview: () => callbackFinPhpWasmReview()
		, checkModel: checkCallbackFinPhpWasmModel
		, checkExecutions: checkCallbackFinPhpWasmExecutions
	}
	, "checked-record": {
		source: "CallbackCheckedRecords.lean"
		, sourcePath: "tests/fixtures/onboarding/callback-checked-records/CallbackCheckedRecords.lean"
		, callerPath: "tests/fixtures/callback-checked-record-consumers/php-native.php"
		, configuration: callbackCheckedRecordPhpWasmConfiguration
		, adapt: adaptCallbackCheckedRecordPhpWasm
		, request: callbackCheckedRecordPhpWasmRequest
		, expectedReview: model => callbackCheckedRecordReviewedIr(model.bindingIr)
		, checkModel: checkCallbackCheckedRecordPhpWasmModel
		, checkExecutions: checkCallbackCheckedRecordPhpWasmExecutions
	}
});

/**
 * Fixed original records required independently of report claims.
 *
 * @param profile - Fin or checked-record corpus.
 * @param route - Ordinary or reviewed author route.
 */
export const callbackRefinementsPhpWasmRecords = (profile, route) => {
	const spec = profiles[profile];
	assert.ok(spec && ["ordinary", "reviewed"].includes(route));
	return ["report.json", "configuration.json", "reviewed.binding-ir.json"
		, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json"
			, "php-wasm-package-set.json", spec.source, "lean-bridge.exports.json"
			, ...route === "reviewed" ? ["api.binding-ir.json"] : []]
			.map(path => `build-${index}/${path}`))
		, ...deploymentRecords.map(path => "deployment/" + path)
		, ...Array.from({ length: 12 }, (_, index) => `executions/${index}.json`)];
};

/**
 * Verify one route using only original bytes and the exact producer revision.
 *
 * @param read - Route-relative original-record reader.
 * @param options - Closed expected identity.
 * @param options.profile - Fin or checked-record corpus.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.producerCommit - Exact producer Git revision.
 */
export const checkCallbackRefinementsPhpWasmReport = async (read
	, { profile, route, producerCommit }) => {
	const spec = profiles[profile];
	assert.ok(spec && ["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const files = new Map();
	for(const path of callbackRefinementsPhpWasmRecords(profile, route))
	{
		const bytes = await read(path);
		assert.ok(Buffer.isBuffer(bytes), path);
		files.set(path, bytes);
	}
	const text = path => files.get(path).toString();
	const json = path => {
		const value = JSON.parse(text(path));
		assert.equal(text(path), canonicalJson(value), path);
		return value;
	};
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`]
		, { maxBuffer: 32 * 1024 * 1024 });
	const report = json("report.json"), configuration = spec.configuration(route);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.profile, profile);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.configuration, configuration);
	assert.deepEqual(json("configuration.json"), configuration);
	for(const key of ["reproducible", "sourceRemovedBeforeInstallation"
		, "offlineInstall"
		, "compilerFreeReplay", "relocatedInstallation"])
		assert.equal(report[key], true, key);
	assert.equal(report.independentBuilds, 2);
	assert.deepEqual(report.callbackBoundaries, {
		hostArguments: true, hostReplies: true, closureArguments: true
		, closureResults: true, mixed: true, nestedContainers: true
		, firstError: true, cleanup: true, recovery: true
		, proofFreeRecords: profile === "checked-record"
	});
	const review = json("reviewed.binding-ir.json");
	assert.equal(report.reviewedBindingIrSha256, hashBindingIr(review));
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, modelBytes = files.get(prefix + "model.json");
		const model = JSON.parse(modelBytes), receipt = json(prefix + "package-set-receipt.json");
		validatePackageSetReceipt(receipt);
		assert.deepEqual(receipt, report.receipt);
		spec.checkModel(model, review, route);
		assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		assert.deepEqual(spec.expectedReview(model), review);
		assert.deepEqual(files.get(prefix + spec.source), original(spec.sourcePath));
		assert.equal(text(prefix + "lean-bridge.exports.json"), canonicalJson(configuration));
		assert.equal(model.sourceIdentity.exportConfigurationSource, canonicalJson(configuration));
		if(route === "reviewed")
		{
			assert.equal(text(prefix + "api.binding-ir.json"), canonicalJson(review));
			assert.equal(model.sourceIdentity.reviewedBindingIr.semanticSha256, hashBindingIr(review));
		}
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		assert.deepEqual(json(prefix + "php-wasm-package-set.json"), report.phpWasm.packageSet);
		assert.deepEqual(report.builds[attempt], {
			modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(files.get(prefix + "package-set-receipt.json"))
			, packageSetSha256: sha256(files.get(prefix + "php-wasm-package-set.json"))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts
				.map(item => [item.path, item.sha256])))
		});
	}
	const model = json("build-0/model.json"), evidence = report.phpWasm;
	assert.equal(evidence.component.bindingIrSha256, model.bindingIrSha256);
	assert.equal(evidence.component.modelSha256, report.builds[0].modelSha256);
	assert.equal(evidence.component.pointerBits, 32);
	assert.equal(evidence.runtime.pointerBits, 32);
	assert.equal(evidence.component.runtimeIdentity, sha256(canonicalJson(evidence.runtime)));
	for(const key of phpWasmIsolationFlags) assert.equal(evidence[key], true, key);
	for(const inventory of [evidence.packageSet.files, evidence.deployment, evidence.host.files])
		for(const [path, entry] of Object.entries(inventory))
		{
			assert.match(path, /^[A-Za-z0-9_@.+/-]+$/u);
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			digest(entry.sha256);
		}
	for(const path of deploymentRecords)
		assert.deepEqual(evidence.deployment[path], identity(files.get("deployment/" + path)), path);
	for(const [path, hash] of Object.entries(phpWasmDriverHashes))
		assert.equal(sha256(files.get("deployment/" + path)), hash, path);
	const caller = original(spec.callerPath).toString();
	for(const mode of ["weak", "strict"])
	{
		const source = spec.adapt(caller, mode);
		assert.equal(text("deployment/" + mode + ".php"), source);
		assert.equal(evidence.consumerSources[mode], sha256(source));
	}
	for(const arrangement of ["embedded", "composer"])
	{
		const request = spec.request(arrangement);
		assert.equal(text(`deployment/request-${arrangement}.json`), request);
		assert.equal(evidence.requests[arrangement], sha256(request));
	}
	validateBrickMathInstall(evidence.composer, evidence.deployment);
	spec.checkExecutions(evidence);
	assert.deepEqual(report.observation, evidence.executions[0].observation);
	for(const [index, execution] of evidence.executions.entries())
		assert.deepEqual(json(`executions/${index}.json`), execution);
	const handoffReceipt = await read("handoff/package-set-receipt.json");
	assert.equal(handoffReceipt.toString(), canonicalJson(report.receipt));
	const sidecar = await read("handoff/package-set-receipt.json.sha256");
	assert.match(sidecar.toString()
		, new RegExp(`^${sha256(handoffReceipt)}  package-set-receipt\\.json\\n$`, "u"));
	for(const pkg of report.receipt.packages)
	{
		assert.equal(pkg.artifacts.length, 1);
		const artifact = pkg.artifacts[0], bytes = await read("handoff/" + artifact.path);
		assert.deepEqual(identity(bytes), { bytes: artifact.bytes, sha256: artifact.sha256 });
		const packed = evidence.packageSet.archives.find(item => item.role === pkg.role);
		assert.ok(packed);
		assert.equal(packed.archive, basename(artifact.path));
		assert.equal(packed.sha256, artifact.sha256);
	}
	return { profile, route, producerCommit, executions: evidence.executions.length
		, checks: evidence.executions[0].observation.checks };
	};
