/**
 * Real C/C++ nested checked-record packages from two author roots.
 * Each installed caller runs before and after a physical move.
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
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment,
	installCopiedConsumer,
	nativeFixtureEnvironment,
	runCopied
} from "./copied-fixture-install.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./fin-container-edge-closure.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import {
	nestedCheckedRecordFixture,
	nestedCheckedRecordModule
} from "./nested-checked-record-fixture.mjs";
import {
	nestedCheckedRecordNativeCaller,
	nestedCheckedRecordNativeConfiguration,
	nestedCheckedRecordNativeReview,
	nestedCheckedRecordNativeSelection,
	parseNestedCheckedRecordNativeResult
} from "./nested-checked-record-native-fixture.mjs";
import {
	waitNominalSubtypeDotnetResources as waitResources
} from "./nominal-subtype-dotnet-resources.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";

const { enabled, profiles, routes, modes, maxLoad }
	= nestedCheckedRecordNativeSelection(process.env);

for(const route of routes) for(const mode of modes) test(
	`installed nested checked-record native packages reproduce and relocate ${route} ${mode}`,
	{ skip: !enabled, timeout: 3_600_000 }, async t => {
		const output = resolve(process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_OUTPUT
			?? "build/nested-checked-record-native", route, mode);
		await assert.rejects(access(output), { code: "ENOENT" });
		await mkdir(output, { recursive: true });
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"]
			, { encoding: "utf8" }).trim();
		for(const path of [
			"tests/helpers/nested-checked-record-native-fixture.mjs"
			, "tests/helpers/nested-checked-record-native-installed-tests.mjs"
			, ...profiles.map(profile =>
				`tests/fixtures/nested-checked-record-consumers/${profile}.${profile}`)
		]) execFileSync("git", ["ls-files", "--error-unmatch", path]);
		execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);

		const admissions = [];
		const resources = async () => admissions.push(await waitResources(output, {
			maxLoad
			, notify: message => t.diagnostic(message.replaceAll("C#", "nested native"))
		}));
		await resources();
		const directory = await mkdtemp(join(tmpdir()
			, "lean-bridge-nested-checked-record-native-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(directory, { recursive: true });
			else t.diagnostic(`Retained failed nested native inputs: ${directory}`);
		});
		const expected = nestedCheckedRecordNativeReview(mode);
		const configuration = nestedCheckedRecordNativeConfiguration(route, mode);
		const environment = nativeFixtureEnvironment(profiles);
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
		assert.match(floor ?? "", /^2\.[0-9]+$/u
			, "Select and report the native glibc floor explicitly");
		assert.equal(process.platform, "linux"); assert.equal(process.arch, "x64");
		const runtime = {
			platform: process.platform, arch: process.arch
			, glibc: await runCopied("/usr/bin/getconf", ["GNU_LIBC_VERSION"], directory)
		};
		assert.equal(runtime.glibc.stderr, "");
		assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
		assert.ok(Number(runtime.glibc.stdout.match(/2\.([0-9]+)/u)[1])
			>= Number(floor.split(".")[1]));
		await saveLakeFile(output, "runtime.json", canonicalJson(runtime));
		await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
		await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
		const consumer = join(directory, "consumer"), handoff = join(consumer, "handoff");
		const builds = [];
		for(const attempt of [0, 1])
		{
			await resources();
			const author = join(directory, `author-${attempt}`);
			const projectRoot = join(author, "project");
			const outputRoot = join(author, "release");
			await cp(nestedCheckedRecordFixture, projectRoot, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json"
				, canonicalJson(configuration));
			if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json"
				, canonicalJson(expected));
			const sourceBefore = await lakeInputState(projectRoot);
			t.diagnostic(`${route} ${mode} native author ${attempt}: ${profiles.join(", ")}`);
			const built = await buildCanonicalProject({
				projectRoot, outputRoot, targets: profiles, environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			assert.deepEqual(await lakeInputState(projectRoot), sourceBefore
				, "Author source remains unchanged");
			const modelBytes = await readFile(join(outputRoot, "native/component/model.json"));
			const model = JSON.parse(modelBytes);
			assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
			if(route === "reviewed")
				assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
			else assert.ok(!model.sourceIdentity.reviewedBindingIr);
			const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json"));
			const receipt = JSON.parse(receiptBytes);
			await verifyPackageSetReceipt({
				receiptPath: join(outputRoot, "package-set-receipt.json")
			});
			assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort()
				, [...profiles].sort());
			const prefix = `build-${attempt}`;
			await saveLakeFile(output, `${prefix}/model.json`, modelBytes);
			await saveLakeFile(output, `${prefix}/package-set-receipt.json`, receiptBytes);
			await saveLakeFile(output, `${prefix}/author-inputs.json`
				, canonicalJson(sourceBefore));
			for(const name of [
				`${nestedCheckedRecordModule}.lean`, "lean-bridge.exports.json"
				, ...route === "reviewed" ? ["api.binding-ir.json"] : []
			]) await saveLakeFile(output, `${prefix}/${name}`
				, await readFile(join(projectRoot, name)));
			builds.push({
				bindingIrSha256: built.bindingIrSha256
				, modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
				, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
					pkg.artifacts.map(item => [item.path, item.sha256])))
			});
			if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
			await rm(author, { recursive: true });
			await assert.rejects(access(author), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]
			, "Both author roots must reproduce models, receipts and archives");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
		const reports = [];
		for(const profile of profiles)
		{
			await resources();
			const packages = receipt.packages.filter(pkg => pkg.target === profile);
			assert.equal(packages.length, 1); assert.equal(packages[0].role, "component");
			const source = await nestedCheckedRecordNativeCaller(profile, route, mode);
			await saveLakeFile(output, `consumers/${profile}.${profile}`, source);
			const fixture = {
				source: () => source
				, parseResult: stdout => parseNestedCheckedRecordNativeResult(
					stdout, profile, mode)
				, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure
			};
			const observation = await installCopiedConsumer({
				profile, consumer, handoff, packages, environment, fixture
			});
			const root = join(consumer, profile), relocated = root + "-relocated";
			const pkg = packages[0], packageName = `${pkg.name}-${pkg.version}-${profile}`;
			await saveLakeFile(output, `${profile}/lean-bridge-package.json`
				, await readFile(join(root, packageName, "lean-bridge-package.json")));
			const compiler = await runCopied(profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++"
				, ["--version"], root);
			assert.equal(compiler.stderr, "");
			await saveLakeFile(output, `${profile}/compiler.json`, canonicalJson(compiler));
			const executableSha256 = sha256(await readFile(join(root, "consumer")));
			const runs = [];
			for(const location of [root, relocated])
			{
				if(location === relocated)
				{
					await rename(root, relocated);
					await assert.rejects(access(root), { code: "ENOENT" });
				}
				const installed = join(location, packageName);
				const closure = await verifyFinContainerEdgeArchiveClosure({
					profile, installed, receiptPath: "lean-bridge-package.json"
					, archive: join(handoff, pkg.artifacts[0].path)
					, archiveSha256: pkg.artifacts[0].sha256
				});
				const result = await runCopied(join(location, "consumer"), [], location, {
					...copiedCleanEnvironment, LD_LIBRARY_PATH: join(installed, "lib")
				});
				assert.equal(result.stderr, "");
				assert.deepEqual(parseNestedCheckedRecordNativeResult(
					result.stdout, profile, mode), observation.result);
				assert.equal(sha256(await readFile(join(location, "consumer")))
					, executableSha256);
				assert.equal(await readFile(join(location, `consumer.${profile}`), "utf8")
					, source);
				runs.push({ ...result, ...closure, relocated: location === relocated });
				await saveLakeFile(output
					, `${profile}/${location === relocated ? "relocated" : "installed"}.json`
					, canonicalJson(runs.at(-1)));
			}
			delete observation.command;
			reports.push({
				profile, ...observation, executableSha256, runs, packages
				, sourceSha256: sha256(source), compiler
				, relocatedInstallation: true, sourceRemovedBeforeInstallation: true
				, compilerFreeReplay: true
			});
			await saveLakeFile(output, `${profile}/report.json`
				, canonicalJson(reports.at(-1)));
		}
		await saveLakeFile(output, "resources.json", canonicalJson({
			maxLoad, samples: admissions
		}));
		await saveLakeFile(output, "report.json", canonicalJson({
			schemaVersion: 1, route, mode, profiles, producerCommit
			, configuration, builds, reports
			, expectedBindingIrSha256: hashBindingIr(expected), runtime
			, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
			, declaredGlibcFloor: floor
			, resourceAdmission: {
				maxLoad, samples: admissions.length
			}
		}));
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rename(handoff, join(output, "handoff"));
		await assert.rejects(access(handoff), { code: "ENOENT" });
		const paths = await nativeArtifactPaths(output);
		assert.ok(paths.includes("report.json") && paths.includes("resources.json"));
		complete = true;
	}
);
