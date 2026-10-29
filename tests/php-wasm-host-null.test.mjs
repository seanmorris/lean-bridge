/**
 * Installed PHP-Wasm HostNull acceptance through both author routes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { hostNullArities, hostNullProjection, hostNullReviewedIr } from "./helpers/host-null-fixture.mjs";
import {
	phpHostNullSettings, phpHostNullWasmConsumer, phpHostNullWasmRequest
} from "./helpers/php-host-null-fixture.mjs";
import { installedPhpWasmCorpus } from "./helpers/type-corpus-php-wasm-install.mjs";

const enabled = process.env.LEAN_BRIDGE_PHP_WASM_HOST_NULL_TEST === "1";
const exports_ = hostNullReviewedIr().declarations.map(item => item.source.declaration);
const privateShape = ir => {
	const abi = createComponentPrivateAbi(ir);
	return { ...abi
		, types: abi.types.toSorted((left, right) => left.id.localeCompare(right.id))
		, callbacks: abi.callbacks.toSorted((left, right) => left.id.localeCompare(right.id))
		, exports: abi.exports.toSorted((left, right) => left.bindingId.localeCompare(right.bindingId)) };
};
const assertObservation = (observation, path, mode) => {
	assert.ok(observation.checks > 100); assert.ok(observation.rejections >= 25);
	assert.deepEqual(observation.positions, ["parameter", "result", "field", "callback-parameter", "callback-result"]);
	assert.equal(observation.nestedOptionDistinct, true); assert.equal(observation.profile, "php-wasm");
	assert.equal(observation.path, path); assert.equal(observation.callerMode, mode); assert.equal(observation.wordBits, 32);
	assert.equal(observation.api, "/vendor/host-null-demo/wasm/src/Api.php");
	assert.deepEqual(observation.libraries, []);
};

test("installed PHP-Wasm HostNull preserves all five positions in Node and Chromium", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-host-null-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-host-null-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/host-null", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["HostNullDemo"], hostProjections: [hostNullProjection]
			, targets: { "php-wasm": phpHostNullSettings.wasm }
			, ...(path === "ordinary-source" ? { exports: exports_, arities: hostNullArities } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(hostNullReviewedIr()));
		const environment = nativeFixtureEnvironment(["php-wasm"]);
		if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME) environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME = environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
		t.diagnostic(`${path}: compiling authenticated wasm32 HostNull`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "php-wasm/component/model.json")));
		assert.equal(model.pointerBits, 32); assert.deepEqual(privateShape(model.bindingIr), privateShape(hostNullReviewedIr()));
		assert.doesNotMatch(JSON.stringify(model.bindingIr), /(?:null|value)Constructor/u);
		assert.ok(model.types.some(type => type.kind === "host-null"));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const packageSet = JSON.parse(await readFile(join(outputRoot, "packages/php-wasm/php-wasm-package-set.json")));
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: installing offline npm/Composer packages, deleting handoff, relocating, and repeating Node/Chromium callers`);
		const installed = await installedPhpWasmCorpus({ t
			, library: { id: "host-null" }
			, consumer, handoff, receipt, packageSet, environment
			, clean: { ...copiedCleanEnvironment
				, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php"
				, LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler"
				, LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime" }
			, sourcePath: path
			, fixture: { settings: phpHostNullSettings.wasm
				, source: phpHostNullWasmConsumer
				, request: phpHostNullWasmRequest
				, removeHandoff: true } });
		assert.equal(installed.phpWasm.executions.length, 12);
		for(const execution of installed.phpWasm.executions)
		{
			assertObservation(execution.observation, path, execution.mode);
			assert.equal(execution.phases.at(-1).libraries.length, 2);
			const initial = execution.loading === "lazy" ? 0 : 2;
			assert.ok(execution.phases.slice(0, -1).every(phase => phase.libraries.length === initial));
		}
		reports.push({ profile: "php-wasm"
			, path
			, ...installed
			, packages: receipt.packages
			, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST_NULL_REPORT ?? "build/host-null/php-wasm.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
