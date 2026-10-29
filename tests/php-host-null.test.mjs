/**
 * Installed native PHP HostNull acceptance through both author routes.
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
	phpHostNullNativeConsumer, phpHostNullNativeRequest, phpHostNullSettings
} from "./helpers/php-host-null-fixture.mjs";
import { installedPhpCorpus } from "./helpers/type-corpus-php.mjs";

const enabled = process.env.LEAN_BRIDGE_PHP_HOST_NULL_TEST === "1";
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
	assert.equal(observation.nestedOptionDistinct, true); assert.equal(observation.profile, "php-native");
	assert.equal(observation.path, path); assert.equal(observation.callerMode, mode); assert.equal(observation.wordBits, 64);
	assert.ok(observation.api.endsWith("/relocated/vendor/host-null-demo/api/src/Api.php"));
	assert.equal(Object.keys(observation.libraries).length, 4);
};

test("installed native PHP HostNull preserves all five positions on both author routes", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const reports = [], environment = { ...nativeFixtureEnvironment(["php-native"])
		, LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
		, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" };
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-host-null-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-host-null-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/host-null", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["HostNullDemo"], hostProjections: [hostNullProjection]
			, targets: { "php-native": phpHostNullSettings.native }
			, ...(path === "ordinary-source" ? { exports: exports_, arities: hostNullArities } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(hostNullReviewedIr()));
		t.diagnostic(`${path}: compiling authenticated native PHP HostNull`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-native"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(privateShape(model.bindingIr), privateShape(hostNullReviewedIr()));
		assert.doesNotMatch(JSON.stringify(model.bindingIr), /(?:null|value)Constructor/u);
		assert.ok(model.types.some(type => type.kind === "host-null"));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(item => item.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		if(process.env.LEAN_BRIDGE_HOST_NULL_PACKAGE_DIR)
			await cp(handoff, join(resolve(process.env.LEAN_BRIDGE_HOST_NULL_PACKAGE_DIR), path), { recursive: true });
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: installing offline, deleting handoff, relocating, and repeating weak/strict callers`);
		const installed = await installedPhpCorpus({ library: { phpModule: "LeanHostNullDemo" }
			, consumer
			, handoff
			, pkg
			, environment
			, clean: copiedCleanEnvironment
			, sourcePath: path
			, fixture: { source: phpHostNullNativeConsumer, request: phpHostNullNativeRequest, removeHandoff: true } });
		for(const { mode, observation } of installed.php.executions)
		{
			assertObservation(observation, path, mode);
			const base = join(consumer, "php-native/relocated/vendor", pkg.name);
			for(const [file, hash] of Object.entries(observation.libraries))
			{
				assert.ok(file.startsWith(base + "/native/linux-x64/"));
				assert.equal(hash, installed.php.packageReceipt.files[file.slice(base.length + 1)].sha256);
			}
		}
		reports.push({ profile: "php-native"
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
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_HOST_NULL_REPORT ?? "build/host-null/php-native.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
