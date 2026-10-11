/**
 * Real ordinary/reviewed PHP Composer packages with two-root reproduction and relocated execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { structuralSubtypeFixture, structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypePhpConfiguration, structuralSubtypePhpCaller, parseStructuralSubtypePhpResult } from "./structural-subtype-php-fixture.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { installFinContainerEdgePhp, runFinContainerEdgePhp, verifyFinContainerEdgePhpEnvironment } from "./fin-container-edge-php-closure.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_TEST === "1";
const routes = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_ROUTES?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length && routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);

for(const route of routes) test(`installed structural Subtypes PHP ${route} reproduce and relocate`, { skip: !enabled, timeout: 2_400_000 }, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_OUTPUT ?? "build/structural-subtype-php", route);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-structural-php-installed-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained structural PHP inputs: ${directory}`);
	});
	const expected = structuralSubtypeReview(), configuration = structuralSubtypePhpConfiguration(route);
	const environment = nativeFixtureEnvironment(["php-native"]), handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	environment.LEAN_BRIDGE_PHP ??= "/usr/bin/php";
	environment.LEAN_BRIDGE_COMPOSER ??= "/usr/bin/composer";
	assert.ok(environment.LEAN_BRIDGE_PHP.startsWith("/") && environment.LEAN_BRIDGE_COMPOSER.startsWith("/"));
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	const builds = [];
	for(const attempt of [0, 1])
	{
		const author = join(directory, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(structuralSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		t.diagnostic(`PHP ${route}: author ${attempt}`);
		await buildCanonicalProject({ projectRoot, outputRoot, environment, targets: ["php-native"] })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")), model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		await saveLakeFile(output, `build-${attempt}/model.json`, modelBytes);
		await saveLakeFile(output, `build-${attempt}/package-set-receipt.json`, receiptBytes);
		await saveLakeFile(output, `build-${attempt}/StructuralSubtypes.lean`, await readFile(join(projectRoot, "StructuralSubtypes.lean")));
		builds.push({ modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))) });
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0]);
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });

	const packages = receipt.packages.filter(pkg => pkg.target === "php-native" && pkg.role === "component");
	assert.equal(packages.length, 1);
	const pkg = packages[0]; assert.equal(pkg.artifacts.length, 1);
	const artifact = pkg.artifacts[0], source = await structuralSubtypePhpCaller(route);
	await saveLakeFile(output, "consumer.php", source);
	await saveLakeFile(consumer, "consumer.php", source);
	const installed = await installFinContainerEdgePhp({
		root: consumer, archive: join(handoff, artifact.path)
		, archiveSha256: artifact.sha256, command: environment.LEAN_BRIDGE_PHP
		, composer: environment.LEAN_BRIDGE_COMPOSER
	});
	const context = installed.context;
	const version = await runCopied(context.command, [...context.runtimeFlags, "-r", "echo PHP_VERSION;"], consumer);
	assert.equal(version.stderr, ""); assert.match(version.stdout, /^8\.[2-9]\.[0-9]+$/u);
	// Keep original Composer discovery inputs for independent archival validation.
	for(const path of [...Object.keys(context.inputs), ...Object.keys(context.generatedFiles)])
		await saveLakeFile(output, `installation/${path}`, await readFile(join(consumer, path)));
	for(const path of ["composer.json", "binding-manifest.json", "src/Api.php"])
		await saveLakeFile(output, `package/${path}`, await readFile(join(consumer, "vendor", context.name, path)));
	const observations = [];
	for(const [position, location] of [consumer, consumer + "-relocated"].entries())
	{
		if(position)
		{ await rename(consumer, location); await assert.rejects(access(consumer), { code: "ENOENT" }); }
		const relocatedContext = { ...context, root: location };
		for(const mode of ["weak", "strict"])
		{
			const before = await verifyFinContainerEdgePhpEnvironment(relocatedContext);
			const run = await runFinContainerEdgePhp(relocatedContext, mode);
			assert.equal(run.stderr, ""); const counts = parseStructuralSubtypePhpResult(run.stdout);
			assert.deepEqual(await verifyFinContainerEdgePhpEnvironment(relocatedContext), before);
			assert.equal(await readFile(join(location, "consumer.php"), "utf8"), source);
			assert.equal(await readFile(join(location, "strict.php"), "utf8"), source.replace("declare(strict_types=0);", "declare(strict_types=1);"));
			observations.push({ relocated: Boolean(position), mode, run, counts, closure: before });
			await saveLakeFile(output, `${position ? "relocated" : "installed"}-${mode}.json`, canonicalJson(observations.at(-1)));
		}
	}
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route, php: version.stdout, producerCommit
		, configuration, expectedBindingIrSha256: hashBindingIr(expected)
		, builds, receipt, installation: context, observations
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreeReplay: true, relocatedInstallation: true
		, declaredGlibcFloor: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38"
		, dispatch: { observed: false, reason: "No PHP entry counters in this installed acceptance" } }));
	complete = true;
});
