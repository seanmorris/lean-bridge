/**
 * Reproduce recursive checked-record Composer ZIPs and execute weak/strict callers offline
 * after removing author sources.
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
import {
	loadRecursiveCheckedRecordPhpCaller, parseRecursiveCheckedRecordPhpResult
	, recursiveCheckedRecordPhpConfiguration, recursiveCheckedRecordPhpPackage
	, recursiveCheckedRecordPhpReview, recursiveCheckedRecordPhpSelection
} from "./recursive-checked-record-php-fixture.mjs";
import { inspectRecursiveCheckedRecordPhpPackage } from "./recursive-checked-record-php-package.mjs";
import { nominalSubtypePhpToolSelection, inspectNominalSubtypePhpTools } from "./nominal-subtype-php-tools.mjs";
import { installFinContainerEdgePhp, runFinContainerEdgePhp, verifyFinContainerEdgePhpEnvironment } from "./fin-container-edge-php-closure.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

const { enabled, routes, fixtures, maxLoad } = recursiveCheckedRecordPhpSelection(process.env);

for(const route of routes) for(const fixture of fixtures) test(`installed recursive checked-record PHP packages reproduce and relocate ${route} ${fixture}`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	for(const path of ["fixture.mjs", "resources.mjs", "package.mjs", "installed-tests.mjs"])
		execFileSync("git", ["ls-files", "--error-unmatch", `tests/helpers/recursive-checked-record-php-${path}`]);
	execFileSync("git", ["ls-files", "--error-unmatch", "tests/fixtures/recursive-checked-record-consumers/php-native.php"]);
	execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
	const expected = recursiveCheckedRecordPhpReview(fixture), configuration = recursiveCheckedRecordPhpConfiguration(route, fixture);
	const phpPackage = recursiveCheckedRecordPhpPackage(fixture);
	const output = resolve(process.env.LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_OUTPUT ?? "build/recursive-checked-record-php", route, fixture);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const resourceChecks = [];
	const resources = async () => {
		resourceChecks.push(await waitNominalSubtypeDotnetResources(output, {
			maxLoad
			, notify: message => t.diagnostic(message.replaceAll("C#", "recursive PHP"))
		}));
		await saveLakeFile(output, "resources.json", canonicalJson(resourceChecks));
	};
	await resources();
	const environment = { ...nativeFixtureEnvironment(["php-native"]), LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1" };
	const selected = nominalSubtypePhpToolSelection(environment), tools = await inspectNominalSubtypePhpTools(selected, output);
	environment.LEAN_BRIDGE_PHP = tools.command; environment.LEAN_BRIDGE_COMPOSER = tools.composer;
	const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
	assert.match(floor ?? "", /^2\.[0-9]+$/u, "Select the native glibc floor explicitly");
	assert.equal(process.platform, "linux"); assert.equal(process.arch, "x64");
	const runtime = { platform: process.platform, arch: process.arch, glibc: await runCopied("/usr/bin/getconf", ["GNU_LIBC_VERSION"], output) };
	assert.equal(runtime.glibc.stderr, ""); assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
	assert.ok(Number(runtime.glibc.stdout.match(/2\.([0-9]+)/u)[1]) >= Number(floor.split(".")[1]));
	for(const [path, value] of Object.entries({ "tools.json": tools, "runtime.json": runtime, "expected.binding-ir.json": expected, "configuration.json": configuration }))
		await saveLakeFile(output, path, canonicalJson(value));
	const caller = await loadRecursiveCheckedRecordPhpCaller();
	await saveLakeFile(output, "consumer.php", caller);
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-checked-record-php-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true });
		else t.diagnostic(`Retained failed recursive checked-record PHP inputs: ${root}`);
	});
	const handoff = join(root, "handoff"), builds = []; let model;
	for(const attempt of [0, 1])
	{
		await resources();
		const author = join(root, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release"), record = join(output, `build-${attempt}`);
		await cp(phpPackage.root, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		const sourceBefore = await lakeInputState(projectRoot);
		t.diagnostic(`${route} ${fixture} author ${attempt}: reproducible Composer package`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-native"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		assert.deepEqual(await lakeInputState(projectRoot), sourceBefore, "Author inputs remain unchanged");
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")); model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role]), [["php-native", "component"]]);
		for(const [path, bytes] of [["model.json", modelBytes], ["package-set-receipt.json", receiptBytes], ["author-inputs.json", canonicalJson(sourceBefore)]])
			await saveLakeFile(record, path, bytes);
		for(const name of [`${phpPackage.leanModule}.lean`, "lean-bridge.exports.json"])
			await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
		if(route === "reviewed") await saveLakeFile(record, "api.binding-ir.json", canonicalJson(expected));
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		builds.push({ bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))) });
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0], "Both author roots reproduce the complete Composer handoff");
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await copyPackageSetHandoff(handoff, join(output, "handoff"));
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json"))), pkg = receipt.packages[0];
	const archive = join(handoff, pkg.artifacts[0].path), archiveBytes = await readFile(archive);
	assert.deepEqual({ bytes: archiveBytes.length, sha256: sha256(archiveBytes) }, { bytes: pkg.artifacts[0].bytes, sha256: pkg.artifacts[0].sha256 });
	await resources();
	const consumer = join(root, "consumer"); await mkdir(consumer);
	await saveLakeFile(consumer, "consumer.php", caller);
	const { context } = await installFinContainerEdgePhp({ root: consumer, archive, archiveSha256: pkg.artifacts[0].sha256, command: tools.command, composer: tools.composer });
	const packaged = await inspectRecursiveCheckedRecordPhpPackage({ context, pkg, model, floor, tools, output, fixture });
	await saveLakeFile(output, "environment.json", canonicalJson(context));
	const observations = [];
	for(const [position, location] of [consumer, consumer + "-relocated"].entries())
	{
		if(position)
		{ await rename(consumer, location); await assert.rejects(access(consumer), { code: "ENOENT" }); }
		const relocated = { ...context, root: location };
		for(const strictness of ["weak", "strict"])
		{
			await resources();
			const before = await verifyFinContainerEdgePhpEnvironment(relocated);
			const run = await runFinContainerEdgePhp(relocated, strictness);
			assert.equal(run.stderr, ""); const counts = parseRecursiveCheckedRecordPhpResult(run.stdout, fixture);
			assert.deepEqual(await verifyFinContainerEdgePhpEnvironment(relocated), before);
			const entry = strictness === "strict" ? "strict.php" : "consumer.php";
			assert.equal(await readFile(join(location, entry), "utf8"), strictness === "strict" ? caller.replace("declare(strict_types=0);", "declare(strict_types=1);") : caller);
			const observation = { relocated: Boolean(position), strictness
				, command: tools.command, args: [...tools.runtimeFlags, entry]
				, cwd: location, run, counts, closure: before };
			observations.push(observation);
			await saveLakeFile(output, `${position ? "relocated" : "installed"}-${strictness}.json`, canonicalJson(observation));
		}
	}
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route, fixture, producerCommit, runtime, tools
		, configuration, builds, receipt, observations, declaredGlibcFloor: floor
		, expectedBindingIrSha256: hashBindingIr(expected)
		, packageReceiptSha256: packaged.receiptSha256
		, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
		, sourceRemovedBeforeInstallation: true, offlineInstall: true
		, compilerFreeReplay: true, relocatedInstallation: true
		, consumerSourceRequired: true
		, resourceChecks, loadCeiling: maxLoad
		, dispatch: { observed: false, reason: "No PHP constructor/source entry counters in this installed acceptance" } }));
	complete = true;
});
