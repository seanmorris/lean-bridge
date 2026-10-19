/**
 * Reproduce value-indexed checked-record Composer packages in two independent
 * author roots, then consume the authenticated original ZIP offline before and
 * after consumer relocation.  PHP source tests alone cannot establish this.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	checkedRecordValueIndexFixtureRoot, checkedRecordValueIndexModule
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexPhpCaller, checkedRecordValueIndexPhpCallerArgs
	, checkedRecordValueIndexPhpRunSelection, checkedRecordValueIndexPhpSelection
	, parseCheckedRecordValueIndexPhpResult
} from "./checked-record-value-index-php-fixture.mjs";
import { inspectCheckedRecordValueIndexPhpPackage } from "./checked-record-value-index-php-package.mjs";
import {
	installFinContainerEdgePhp, verifyFinContainerEdgePhpEnvironment
} from "./fin-container-edge-php-closure.mjs";
import {
	nominalSubtypePhpToolSelection, inspectNominalSubtypePhpTools
} from "./nominal-subtype-php-tools.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

const { enabled, routes, maxLoad } = checkedRecordValueIndexPhpRunSelection(process.env);

for(const route of routes) test(
	`installed value-index checked-record PHP packages reproduce and relocate for ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
		assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]
			, { stdio: "ignore" }), "Installed PHP evidence requires clean tracked source");
		for(const path of [
			"tests/fixtures/checked-record-value-index-php/php.php"
			, "tests/helpers/checked-record-value-index-php-fixture.mjs"
			, "tests/helpers/checked-record-value-index-php-package.mjs"
			, "tests/helpers/checked-record-value-index-php-installed-tests.mjs"
		]) execFileSync("git", ["ls-files", "--error-unmatch", path]);
		const output = resolve(process.env.LEAN_BRIDGE_VALUE_INDEX_PHP_OUTPUT
			?? "build/checked-record-value-index-php", route);
		await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
		const selection = checkedRecordValueIndexPhpSelection(route);
		const environment = {
			...nativeFixtureEnvironment(["php-native"])
			, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
		};
		const resourceChecks = [];
		const resources = async () => {
			resourceChecks.push(await waitNominalSubtypeDotnetResources(output, {
				maxLoad
				, notify: message => t.diagnostic(message.replaceAll("C#", "value-index PHP"))
			}));
			await saveLakeFile(output, "resources.json", canonicalJson(resourceChecks));
		};
		await resources();
		const selected = nominalSubtypePhpToolSelection(environment);
		const tools = await inspectNominalSubtypePhpTools(selected, output);
		environment.LEAN_BRIDGE_PHP = tools.command; environment.LEAN_BRIDGE_COMPOSER = tools.composer;
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
		assert.match(floor ?? "", /^2\.[0-9]+$/u, "Select the native glibc floor explicitly");
		assert.deepEqual([process.platform, process.arch], ["linux", "x64"]);
		const glibc = await runCopied("/usr/bin/getconf", ["GNU_LIBC_VERSION"], output);
		assert.equal(glibc.stderr, ""); assert.match(glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
		assert.ok(Number(glibc.stdout.match(/2\.([0-9]+)/u)[1]) >= Number(floor.split(".")[1]));
		const runtime = { platform: process.platform, arch: process.arch, glibc: glibc.stdout.trim() };
		for(const [path, value] of Object.entries({
			"runtime.json": runtime
			, "tools.json": tools
			, "expected.binding-ir.json": selection.expected
			, "configuration.json": selection.configuration
		})) await saveLakeFile(output, path, canonicalJson(value));
		const caller = await checkedRecordValueIndexPhpCaller();
		await saveLakeFile(output, "consumer.php", caller);
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-php-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed value-index PHP inputs: ${root}`);
		});
		const handoff = join(root, "handoff"), builds = []; let model;
		for(const attempt of [0, 1])
		{
			await resources();
			const author = join(root, `author-${attempt}`), projectRoot = join(author, "project");
			const outputRoot = join(author, "release"), record = join(output, `build-${attempt}`);
			await cp(checkedRecordValueIndexFixtureRoot, projectRoot, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(selection.configuration));
			if(selection.reviewed)
				await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(selection.expected));
			const sourceBefore = await lakeInputState(projectRoot);
			t.diagnostic(`${route} value-index PHP author ${attempt}: reproducible Composer package`);
			const built = await buildCanonicalProject({
				projectRoot, outputRoot, targets: ["php-native"], environment
			}).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
			assert.deepEqual(await lakeInputState(projectRoot), sourceBefore, "Author inputs remain unchanged");
			const modelBytes = await readFile(join(outputRoot, "native/component/model.json")); model = JSON.parse(modelBytes);
			assert.equal(reviewedContractDifference(selection.expected, model.bindingIr), null);
			if(selection.reviewed)
				assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(selection.expected));
			else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
			const receiptPath = join(outputRoot, "package-set-receipt.json"), receiptBytes = await readFile(receiptPath);
			const receipt = JSON.parse(receiptBytes); await verifyPackageSetReceipt({ receiptPath });
			assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role]), [["php-native", "component"]]);
			for(const [path, bytes] of [
				["model.json", modelBytes], ["package-set-receipt.json", receiptBytes]
				, ["author-inputs.json", canonicalJson(sourceBefore)]
			]) await saveLakeFile(record, path, bytes);
			for(const name of [`${checkedRecordValueIndexModule}.lean`, "lean-bridge.exports.json"])
				await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
			if(selection.reviewed) await saveLakeFile(record, "api.binding-ir.json", canonicalJson(selection.expected));
			if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
			builds.push({
				bindingIrSha256: built.bindingIrSha256
				, modelSha256: sha256(modelBytes)
				, receiptSha256: sha256(receiptBytes)
				, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts
					.map(artifact => [artifact.path, artifact.sha256]))) });
			await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0], "Independent author roots reproduce the complete Composer handoff");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await copyPackageSetHandoff(handoff, join(output, "handoff"));
		const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
		const pkg = receipt.packages[0], archive = join(handoff, pkg.artifacts[0].path), archiveBytes = await readFile(archive);
		assert.deepEqual({ bytes: archiveBytes.length, sha256: sha256(archiveBytes) }
			, { bytes: pkg.artifacts[0].bytes, sha256: pkg.artifacts[0].sha256 });
		await resources();
		const consumer = join(root, "consumer"); await mkdir(consumer);
		await saveLakeFile(consumer, "consumer.php", caller);
		const { context } = await installFinContainerEdgePhp({
			root: consumer, archive, archiveSha256: pkg.artifacts[0].sha256
			, command: tools.command, composer: tools.composer
		});
		const packaged = await inspectCheckedRecordValueIndexPhpPackage({
			context, pkg, model, floor, tools, output
		});
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
				const entry = strictness === "strict" ? "strict.php" : "consumer.php";
				const args = [
					...relocated.runtimeFlags
					, entry
					, ...checkedRecordValueIndexPhpCallerArgs(route)
				];
				const run = await runCopied(relocated.command, args, location, copiedCleanEnvironment);
				assert.equal(run.stderr, ""); const counts = parseCheckedRecordValueIndexPhpResult(run.stdout, route);
				assert.deepEqual(await verifyFinContainerEdgePhpEnvironment(relocated), before);
				assert.equal(await readFile(join(location, entry), "utf8"), strictness === "strict"
					? caller.replace("declare(strict_types=0);", "declare(strict_types=1);") : caller);
				const observation = {
					relocated: Boolean(position)
					, strictness
					, command: tools.command
					, args: [
						...tools.runtimeFlags
						, entry
						, ...checkedRecordValueIndexPhpCallerArgs(route)
					]
					, cwd: location, run, counts, closure: before };
				observations.push(observation);
				await saveLakeFile(output, `${position ? "relocated" : "installed"}-${strictness}.json`, canonicalJson(observation));
			}
		}
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await saveLakeFile(output, "report.json", canonicalJson({
			schemaVersion: 1
			, route
			, producerCommit
			, runtime
			, tools
			, configuration: selection.configuration
			, builds, receipt, observations, declaredGlibcFloor: floor
			, expectedBindingIrSha256: hashBindingIr(selection.expected)
			, packageReceiptSha256: packaged.receiptSha256
			, reproducible: true
			, independentBuilds: 2
			, authorInputsUnchanged: true
			, sourceRemovedBeforeInstallation: true
			, offlineInstall: true
			, compilerFreeReplay: true
			, relocatedInstallation: true
			, consumerSourceRequired: true
			, resourceChecks, loadCeiling: maxLoad
			, dispatch: { observed: false, reason: "No PHP constructor/source entry counters in this installed acceptance" }
		}));
		complete = true;
	}
);
