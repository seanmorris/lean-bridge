/**
 * Build value-index Maven packages from two author roots, install them
 * offline for Java and Kotlin, replay after relocation, and finish with a
 * source-free deployment.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, cp, mkdir, mkdtemp, readFile, realpath, rename, rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	verifyPackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";
import {
	checkedRecordValueIndexFixtureRoot, checkedRecordValueIndexModule
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexJvmCaller, checkedRecordValueIndexJvmEnvironment
	, checkedRecordValueIndexJvmProfiles, checkedRecordValueIndexJvmRoutes
	, checkedRecordValueIndexJvmSelection
	, parseCheckedRecordValueIndexJvmResult
} from "./checked-record-value-index-jvm-fixture.mjs";
import {
	inspectCheckedRecordValueIndexJvmPackage
	, runCheckedRecordValueIndexJvmDeployment
	, verifyCheckedRecordValueIndexJvmDeployment
} from "./checked-record-value-index-jvm-package.mjs";
import {
	runCheckedRecordValueIndexJvmProbe
	, runCheckedRecordValueIndexKotlinNullProbe
} from "./checked-record-value-index-jvm-probe.mjs";
import {
	waitNominalSubtypeDotnetResources
} from "./nominal-subtype-dotnet-resources.mjs";
import {
	installFinContainerEdgeJvm, runFinContainerEdgeJvm
	, verifyFinContainerEdgeJvmEnvironment
} from "./fin-container-edge-jvm-closure.mjs";
import {
	nativeFixtureEnvironment, runCopied
} from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

const { enabled, routes, maxLoad }
	= checkedRecordValueIndexJvmEnvironment(process.env);

for(const route of routes) test(
	`installed value-index checked-record JVM packages reproduce and relocate for ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		assert.ok(checkedRecordValueIndexJvmRoutes.includes(route));
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"])
			.toString().trim();
		const consumerCommit = producerCommit;
		const status = execFileSync("git", [
			"status", "--porcelain=v1", "--untracked-files=all", "--"
			, ".github", "src", "tests", "scripts"
		], { encoding: "utf8" });
		assert.equal(status, "", "Installed evidence requires a clean source tree");
		for(const path of [
			".github/workflows/checked-record-value-index-jvm.yml"
			, "scripts/check-checked-record-value-index-jvm-ci.mjs"
			, "scripts/run-checked-record-value-index-jvm-ci.sh"
			, "tests/fixtures/checked-record-value-index-jvm/java.java"
			, "tests/fixtures/checked-record-value-index-jvm/kotlin.kt"
			, "tests/helpers/checked-record-value-index-jvm-ci-handoff.mjs"
			, "tests/helpers/checked-record-value-index-jvm-ci-report.mjs"
			, "tests/helpers/checked-record-value-index-jvm-fixture.mjs"
			, "tests/helpers/checked-record-value-index-jvm-package.mjs"
			, "tests/helpers/checked-record-value-index-jvm-probe.mjs"
			, "tests/helpers/checked-record-value-index-jvm-report.mjs"
			, "tests/helpers/checked-record-value-index-jvm-installed-tests.mjs"
		]) execFileSync("git", ["ls-files", "--error-unmatch", path]);
		const output = resolve(
			process.env.LEAN_BRIDGE_VALUE_INDEX_JVM_OUTPUT
				?? "build/checked-record-value-index-jvm"
			, route
		);
		await assert.rejects(access(output), { code: "ENOENT" });
		await mkdir(output, { recursive: true });
		const selectedEnvironment = nativeFixtureEnvironment(
			checkedRecordValueIndexJvmProfiles);
		const environment = {
			...selectedEnvironment
			, LEAN_BRIDGE_JAVA: await realpath(
				selectedEnvironment.LEAN_BRIDGE_JAVA)
			, LEAN_BRIDGE_JAVAC: await realpath(
				selectedEnvironment.LEAN_BRIDGE_JAVAC)
			, LEAN_BRIDGE_KOTLINC: await realpath(
				selectedEnvironment.LEAN_BRIDGE_KOTLINC)
			, LEAN_NUM_THREADS: "1"
		};
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
		assert.match(floor ?? "", /^2\.[0-9]+$/u
			, "Select the native glibc floor explicitly");
		assert.equal(process.platform, "linux");
		assert.equal(process.arch, "x64");
		const runtime = {
			platform: process.platform, arch: process.arch
			, glibc: await runCopied(
				"/usr/bin/getconf", ["GNU_LIBC_VERSION"], output)
		};
		assert.equal(runtime.glibc.stderr, "");
		assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
		assert.ok(Number(runtime.glibc.stdout.match(/2\.([0-9]+)/u)[1])
			>= Number(floor.split(".")[1]));
		const selection = checkedRecordValueIndexJvmSelection(route);
		const expected = selection.expected;
		const configuration = selection.configuration;
		for(const [path, value] of Object.entries({
			"runtime.json": runtime, "expected.binding-ir.json": expected
			, "configuration.json": configuration
		})) await saveLakeFile(output, path, canonicalJson(value));
		const resourceChecks = [];
		const resourceCheck = async () => {
			resourceChecks.push(await waitNominalSubtypeDotnetResources(output, {
				maxLoad
				, notify: message => t.diagnostic(
					message.replaceAll("C#", "value-index JVM")
				)
			}));
			await saveLakeFile(output, "resources.json"
				, canonicalJson(resourceChecks));
		};
		await resourceCheck();
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-jvm-installed-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed value-index JVM inputs: ${root}`);
		});
		const handoff = join(root, "handoff"), builds = [];
		let model, compiled;
		for(const attempt of [0, 1])
		{
			await resourceCheck();
			const author = join(root, `author-${attempt}`);
			const projectRoot = join(author, "project");
			const outputRoot = join(author, "release");
			const record = join(output, `build-${attempt}`);
			await cp(checkedRecordValueIndexFixtureRoot, projectRoot
				, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json"
				, canonicalJson(configuration));
			if(selection.reviewed)
				await saveLakeFile(projectRoot, "api.binding-ir.json"
					, canonicalJson(expected));
			const sourceBefore = await lakeInputState(projectRoot);
			t.diagnostic(`${route} author ${attempt}: reproducible Maven package`);
			const built = await buildCanonicalProject({
				projectRoot, outputRoot, targets: ["maven"], environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			assert.deepEqual(await lakeInputState(projectRoot), sourceBefore);
			const modelBytes = await readFile(join(
				outputRoot, "native/component/model.json"));
			model = JSON.parse(modelBytes);
			assert.equal(reviewedContractDifference(expected, model.bindingIr)
				, null);
			if(selection.reviewed)
				assert.equal(model.sourceIdentity.reviewedBindingIr.source
					, canonicalJson(expected));
			else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
			const compiledBytes = await readFile(join(
				outputRoot, "native/jvm/native-jvm.json"));
			compiled = JSON.parse(compiledBytes);
			const receiptBytes = await readFile(join(
				outputRoot, "package-set-receipt.json"));
			const receipt = JSON.parse(receiptBytes);
			await verifyPackageSetReceipt({
				receiptPath: join(outputRoot, "package-set-receipt.json")
			});
			assert.deepEqual(receipt.packages.map(pkg => [
				pkg.target, pkg.role
			]), [["maven", "component"]]);
			for(const [path, bytes] of [
				["model.json", modelBytes]
				, ["native-jvm.json", compiledBytes]
				, ["package-set-receipt.json", receiptBytes]
				, ["author-inputs.json", canonicalJson(sourceBefore)]
			]) await saveLakeFile(record, path, bytes);
			for(const name of [
				`${checkedRecordValueIndexModule}.lean`, "lean-bridge.exports.json"
			]) await saveLakeFile(record, name
				, await readFile(join(projectRoot, name)));
			if(selection.reviewed)
				await saveLakeFile(record, "api.binding-ir.json"
					, canonicalJson(expected));
			if(attempt === 0)
			{
				await copyPackageSetHandoff(outputRoot, handoff);
				await copyPackageSetHandoff(handoff, join(output, "handoff"));
			}
			builds.push({
				bindingIrSha256: built.bindingIrSha256
				, modelSha256: sha256(modelBytes)
				, compiledSha256: sha256(compiledBytes)
				, receiptSha256: sha256(receiptBytes)
				, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
					pkg.artifacts.map(artifact => [
						artifact.path, artifact.sha256
					])
				))
			});
			await rm(author, { recursive: true });
			await assert.rejects(access(author), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]
			, "Both author roots reproduce the complete Maven handoff");
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		const receipt = JSON.parse(await readFile(join(
			handoff, "package-set-receipt.json")));
		const pkg = receipt.packages[0];
		const artifact = pkg.artifacts.find(item => item.path.endsWith(".jar"));
		const archive = join(handoff, artifact.path);
		const archiveBytes = await readFile(archive);
		const installation = inspectCheckedRecordValueIndexJvmPackage(
			archiveBytes, { pkg, model, compiled, floor, route });
		await saveLakeFile(output, "installation.json"
			, canonicalJson(installation));
		const consumers = [];
		for(const profile of checkedRecordValueIndexJvmProfiles)
		{
			await resourceCheck();
			const extension = profile === "java" ? "java" : "kt";
			const caller = await checkedRecordValueIndexJvmCaller(profile, route);
			const consumer = join(root, profile);
			await saveLakeFile(output, "consumer." + extension, caller);
			await saveLakeFile(consumer, "consumer." + extension, caller);
			const { context } = await installFinContainerEdgeJvm({
				profile, root: consumer, archive
				, archiveSha256: artifact.sha256, environment
			});
			const apiProbe = await runCheckedRecordValueIndexJvmProbe({
				root: join(root, "probes", profile), archive: archiveBytes
				, archiveSha256: artifact.sha256, environment, profile, route
				, output: join(output, profile, "api-probe")
			});
			const nullability = [];
			if(profile === "kotlin") for(const invalid of [false, true])
				nullability.push(await runCheckedRecordValueIndexKotlinNullProbe({
					root: join(root, "probes", `nullability-${invalid}`)
					, archive: archiveBytes, archiveSha256: artifact.sha256
					, environment, route, invalid
					, output: join(output, profile, `nullability-${invalid}`)
				}));
			await verifyFinContainerEdgeJvmEnvironment(context);
			const javaVersion = await runCopied(
				context.command, ["--version"], consumer);
			assert.equal(javaVersion.stderr, "");
			assert.match(javaVersion.stdout, /^(?:openjdk|java) 22[. ]/u);
			const observations = [];
			for(const [index, location] of [
				consumer, consumer + "-relocated"
			].entries()) {
				if(index)
				{
					await rename(consumer, location);
					await assert.rejects(access(consumer), { code: "ENOENT" });
				}
				const current = { ...context, root: location };
				const closure = await verifyFinContainerEdgeJvmEnvironment(current);
				const run = await runFinContainerEdgeJvm(current);
				assert.equal(run.stderr, "");
				const counts = parseCheckedRecordValueIndexJvmResult(
					run.stdout, route);
				assert.deepEqual(
					await verifyFinContainerEdgeJvmEnvironment(current), closure);
				const observation = {
					stage: index ? "relocated" : "installed"
					, cwd: location, run, counts, closure
				};
				observations.push(observation);
				await saveLakeFile(output
					, `${profile}/${observation.stage}.json`
					, canonicalJson(observation));
			}
			consumers.push({
				profile, context, apiProbe, nullability, javaVersion, observations
			});
		}
		await rm(handoff, { recursive: true });
		await assert.rejects(access(handoff), { code: "ENOENT" });
		for(const { profile } of consumers)
		{
			const relocated = join(root, profile + "-relocated");
			const sourceFree = join(root, profile + "-source-free");
			await mkdir(sourceFree);
			for(const name of [
				"component.jar", profile === "java" ? "classes" : "consumer.jar"
			]) await rename(join(relocated, name), join(sourceFree, name));
			await rm(relocated, { recursive: true });
			await assert.rejects(access(relocated), { code: "ENOENT" });
		}
		for(const consumer of consumers)
		{
			const { profile, context, observations } = consumer;
			const sourceFree = join(root, profile + "-source-free");
			const closure = await verifyCheckedRecordValueIndexJvmDeployment(
				sourceFree, context);
			const run = await runCheckedRecordValueIndexJvmDeployment(
				sourceFree, context);
			assert.equal(run.stderr, "");
			const counts = parseCheckedRecordValueIndexJvmResult(
				run.stdout, route);
			assert.deepEqual(
				await verifyCheckedRecordValueIndexJvmDeployment(
					sourceFree, context), closure);
			const observation = {
				stage: "source-free", cwd: sourceFree, run, counts, closure
				, sourcesRemoved: true
			};
			observations.push(observation);
			await saveLakeFile(output, `${profile}/source-free.json`
				, canonicalJson(observation));
		}
		await verifyPackageSetReceipt({
			receiptPath: join(output, "handoff/package-set-receipt.json")
		});
		await saveLakeFile(output, "report.json", canonicalJson({
			schemaVersion: 1, route, producerCommit, consumerCommit
			, runtime, builds, receipt
			, installation, consumers, resourceChecks, loadCeiling: maxLoad
			, declaredGlibcFloor: floor
			, expectedBindingIrSha256: hashBindingIr(expected)
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true
			, sourceRemovedBeforeInstallation: true, offlineInstall: true
			, compilerFreeReplay: true, relocatedInstallation: true
			, sourceFreeDeployment: true
			, trustedToolchains: "Explicit JDK and Kotlin distributions; their complete contents are not authenticated"
			, installerCommandLogs: "Closed installer retains package/source/output identities, not compiler stdout"
			, dispatch: {
				observed: false
				, reason: "No JVM constructor/source entry counters in this installed acceptance"
			}
		}));
		complete = true;
	}
);
