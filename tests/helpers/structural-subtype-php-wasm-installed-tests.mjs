/**
 * Two-root structural Subtype PHP-Wasm packages, source-free installs and all host contexts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { structuralSubtypeFixture, structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypePhpWasmConfiguration, structuralSubtypePhpWasmSettings, structuralSubtypePhpWasmCaller, structuralSubtypePhpWasmRequest, checkStructuralSubtypePhpWasmExecutions } from "./structural-subtype-php-wasm-fixture.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { installedPhpWasmCorpus } from "./type-corpus-php-wasm-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const flag = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_WASM_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag));
const routes = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_WASM_ROUTES?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length && routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);

for(const route of routes) test(`installed structural Subtypes PHP-Wasm ${route} reproduce and relocate`, { skip: flag !== "1", timeout: 3_600_000 }, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_WASM_OUTPUT ?? "build/structural-subtype-php-wasm", route);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-structural-php-wasm-installed-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained structural PHP-Wasm inputs: ${directory}`);
	});
	const expected = structuralSubtypeReview(), configuration = structuralSubtypePhpWasmConfiguration(route);
	const environment = nativeFixtureEnvironment(["php-wasm"]);
	environment.LEAN_BRIDGE_PHP ??= "/usr/bin/php";
	environment.LEAN_BRIDGE_COMPOSER ??= "/usr/bin/composer";
	if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME) environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME = environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
	const consumer = join(directory, "consumer"), handoff = join(consumer, "handoff");
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	await saveLakeFile(output, "context.json", canonicalJson({ producerCommit, route, directory, consumer, handoff }));
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	const sources = {};
	for(const mode of ["weak", "strict"])
	{
		sources[mode] = await structuralSubtypePhpWasmCaller(route, mode);
		await saveLakeFile(output, mode + ".php", sources[mode]);
	}
	for(const arrangement of ["embedded", "composer"])
		await saveLakeFile(output, `request-${arrangement}.json`, structuralSubtypePhpWasmRequest(arrangement));
	const builds = [];
	let packageSet;
	for(const attempt of [0, 1])
	{
		const author = join(directory, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(structuralSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		t.diagnostic(`PHP-Wasm ${route}: author ${attempt}`);
		await buildCanonicalProject({ projectRoot, outputRoot, environment, targets: ["php-wasm"] })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const modelBytes = await readFile(join(outputRoot, "php-wasm/component/model.json")), model = JSON.parse(modelBytes);
		assert.equal(model.pointerBits, 32); assert.equal(model.schemaVersion, route === "reviewed" ? 3 : 2);
		assert.equal(model.exports.length, 12); assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		for(const declaration of expected.declarations)
		{
			const exported = model.exports.find(item => item.name === declaration.id.slice(5)); assert.ok(exported);
			assert.deepEqual(exported.refinements, declaration.source.extensions["lean-lang.org/refinements"]);
		}
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		const packageBytes = await readFile(join(outputRoot, "packages/php-wasm/php-wasm-package-set.json"));
		if(attempt === 0) packageSet = JSON.parse(packageBytes);
		await saveLakeFile(output, `build-${attempt}/model.json`, modelBytes);
		await saveLakeFile(output, `build-${attempt}/package-set-receipt.json`, receiptBytes);
		await saveLakeFile(output, `build-${attempt}/php-wasm-package-set.json`, packageBytes);
		await saveLakeFile(output, `build-${attempt}/StructuralSubtypes.lean`, await readFile(join(projectRoot, "StructuralSubtypes.lean")));
		await saveLakeFile(output, `build-${attempt}/lean-bridge.exports.json`, await readFile(join(projectRoot, "lean-bridge.exports.json")));
		if(route === "reviewed") await saveLakeFile(output, `build-${attempt}/api.binding-ir.json`, await readFile(join(projectRoot, "api.binding-ir.json")));
		builds.push({ modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(receiptBytes)
			, packageSetSha256: sha256(packageBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))) });
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0]);
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const clean = { ...copiedCleanEnvironment, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php", LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler", LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime" };
	const fixture = { settings: structuralSubtypePhpWasmSettings, source: mode => sources[mode], request: structuralSubtypePhpWasmRequest, removeHandoff: true };
	const installed = await installedPhpWasmCorpus({ t, library: { id: `structural-subtypes-${route}` }, consumer, handoff, receipt, packageSet, environment, clean, fixture })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	await assert.rejects(access(join(consumer, "project")), { code: "ENOENT" });
	checkStructuralSubtypePhpWasmExecutions(installed.phpWasm);
	const deployment = join(consumer, "relocated");
	for(const path of ["package.json", "package-lock.json"
		, "composer.json", "composer.lock", "vendor/composer/installed.json"
		, "driver.mjs", "node.mjs", "browser.mjs", "weak.php", "strict.php"
		, "request-embedded.json", "request-composer.json"])
		await saveLakeFile(output, "deployment/" + path, await readFile(join(deployment, path)));
	for(const [index, execution] of installed.phpWasm.executions.entries())
		await saveLakeFile(output, `executions/${index}.json`, canonicalJson(execution));
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route, producerCommit, configuration
		, expectedBindingIrSha256: hashBindingIr(expected)
		, builds, receipt
		, ...installed
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreeReplay: true, relocatedInstallation: true
		, dispatch: { observed: false, reason: "No entry counters in this unmodified PHP-Wasm package" } }));
	complete = true;
});
