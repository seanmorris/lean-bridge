/**
 * Build nested checked-record Maven packages from two independent author roots,
 * install them offline for Java and Kotlin, replay after relocation and execute
 * a final source-free deployment. This gate does not claim dispatch counters.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, cp, mkdir, mkdtemp, readFile, rename, rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	nestedCheckedRecordFixture, nestedCheckedRecordModule
} from "./nested-checked-record-fixture.mjs";
import {
	nestedCheckedRecordJvmCaller
	, nestedCheckedRecordJvmConfiguration
	, nestedCheckedRecordJvmProfiles
	, nestedCheckedRecordJvmReview
	, nestedCheckedRecordJvmSelection
	, parseNestedCheckedRecordJvmResult
} from "./nested-checked-record-jvm-fixture.mjs";
import {
	inspectNestedCheckedRecordJvmPackage
	, runNestedCheckedRecordJvmDeployment
	, verifyNestedCheckedRecordJvmDeployment
} from "./nested-checked-record-jvm-package.mjs";
import {
	runNestedCheckedRecordJvmProbe, runNestedCheckedRecordKotlinNullProbe
} from "./nested-checked-record-jvm-probe.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";
import {
	installFinContainerEdgeJvm
	, runFinContainerEdgeJvm
	, verifyFinContainerEdgeJvmEnvironment
} from "./fin-container-edge-jvm-closure.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

const { enabled, routes, modes, maxLoad }
	= nestedCheckedRecordJvmSelection(process.env);

for(const route of routes) for(const mode of modes) test(
	`installed nested checked-record JVM packages reproduce and relocate ${route} ${mode}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"])
			.toString().trim();
		for(const name of ["fixture", "package", "probe", "installed-tests"])
			execFileSync("git", ["ls-files", "--error-unmatch"
				, `tests/helpers/nested-checked-record-jvm-${name}.mjs`]);
		for(const path of ["java.java", "kotlin.kt"])
			execFileSync("git", ["ls-files", "--error-unmatch"
				, "tests/fixtures/nested-checked-record-consumers/" + path]);
		execFileSync("git", ["diff", "--quiet", "HEAD", "--"
			, "src", "tests", "scripts"]);
		const output = resolve(
			process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_OUTPUT
				?? "build/nested-checked-record-jvm"
			, route, mode
		);
		await assert.rejects(access(output), { code: "ENOENT" });
		await mkdir(output, { recursive: true });
		const environment = {
			...nativeFixtureEnvironment(nestedCheckedRecordJvmProfiles)
			, LEAN_NUM_THREADS: "1"
		};
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
		assert.match(floor ?? "", /^2\.[0-9]+$/u
			, "Select the native glibc floor explicitly");
		assert.equal(process.platform, "linux"); assert.equal(process.arch, "x64");
		const runtime = {
			platform: process.platform, arch: process.arch
			, glibc: await runCopied("/usr/bin/getconf", ["GNU_LIBC_VERSION"], output)
		};
		assert.equal(runtime.glibc.stderr, "");
		assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
		assert.ok(Number(runtime.glibc.stdout.match(/2\.([0-9]+)/u)[1])
			>= Number(floor.split(".")[1]));
		const expected = nestedCheckedRecordJvmReview(mode);
		const configuration = nestedCheckedRecordJvmConfiguration(route, mode);
		for(const [path, value] of Object.entries({
			"runtime.json": runtime, "expected.binding-ir.json": expected
			, "configuration.json": configuration
		})) await saveLakeFile(output, path, canonicalJson(value));
		const resourceChecks = [];
		const resourceCheck = async () => {
			resourceChecks.push(await waitNominalSubtypeDotnetResources(output, {
				maxLoad
				, notify: message => t.diagnostic(
					message.replaceAll("C#", "nested-record JVM")
				)
			}));
			await saveLakeFile(output, "resources.json", canonicalJson(resourceChecks));
		};
		await resourceCheck();
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-nested-record-jvm-installed-"
		));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed nested-record JVM inputs: ${root}`);
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
			await cp(nestedCheckedRecordFixture, projectRoot, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json"
				, canonicalJson(configuration));
			if(route === "reviewed")
				await saveLakeFile(projectRoot, "api.binding-ir.json"
					, canonicalJson(expected));
			const sourceBefore = await lakeInputState(projectRoot);
			t.diagnostic(`${route} ${mode} author ${attempt}: reproducible Maven package`);
			const built = await buildCanonicalProject({
				projectRoot, outputRoot, targets: ["maven"], environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			assert.deepEqual(await lakeInputState(projectRoot), sourceBefore);
			const modelBytes = await readFile(join(
				outputRoot, "native/component/model.json"
			));
			model = JSON.parse(modelBytes);
			assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
			if(route === "reviewed")
				assert.equal(model.sourceIdentity.reviewedBindingIr.source
					, canonicalJson(expected));
			else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
			const compiledBytes = await readFile(join(
				outputRoot, "native/jvm/native-jvm.json"
			));
			compiled = JSON.parse(compiledBytes);
			const receiptBytes = await readFile(join(
				outputRoot, "package-set-receipt.json"
			));
			const receipt = JSON.parse(receiptBytes);
			await verifyPackageSetReceipt({
				receiptPath: join(outputRoot, "package-set-receipt.json")
			});
			assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role])
				, [["maven", "component"]]);
			for(const [path, bytes] of [
				["model.json", modelBytes], ["native-jvm.json", compiledBytes]
				, ["package-set-receipt.json", receiptBytes]
				, ["author-inputs.json", canonicalJson(sourceBefore)]
			]) await saveLakeFile(record, path, bytes);
			for(const name of [
				`${nestedCheckedRecordModule}.lean`, "lean-bridge.exports.json"
			]) await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
			if(route === "reviewed")
				await saveLakeFile(record, "api.binding-ir.json", canonicalJson(expected));
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
					pkg.artifacts.map(artifact => [artifact.path, artifact.sha256])
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
			handoff, "package-set-receipt.json"
		)));
		const pkg = receipt.packages[0];
		const artifact = pkg.artifacts.find(item => item.path.endsWith(".jar"));
		const archive = join(handoff, artifact.path);
		const archiveBytes = await readFile(archive);
		const installation = inspectNestedCheckedRecordJvmPackage(
			archiveBytes, { pkg, model, compiled, floor, mode }
		);
		await saveLakeFile(output, "installation.json", canonicalJson(installation));
		const consumers = [];
		for(const profile of nestedCheckedRecordJvmProfiles)
		{
			await resourceCheck();
			const extension = profile === "java" ? "java" : "kt";
			const caller = await nestedCheckedRecordJvmCaller(profile, route, mode);
			const consumer = join(root, profile);
			await saveLakeFile(output, "consumer." + extension, caller);
			await saveLakeFile(consumer, "consumer." + extension, caller);
			const { context } = await installFinContainerEdgeJvm({
				profile, root: consumer, archive
				, archiveSha256: artifact.sha256, environment
			});
			const apiProbe = await runNestedCheckedRecordJvmProbe({
				root: join(root, "probes", profile)
				, archive: archiveBytes, archiveSha256: artifact.sha256
				, environment, profile, mode
				, output: join(output, profile, "api-probe")
			});
			const nullability = [];
			if(profile === "kotlin") for(const invalid of [false, true])
				nullability.push(await runNestedCheckedRecordKotlinNullProbe({
					root: join(root, "probes", `nullability-${invalid}`)
					, archive: archiveBytes, archiveSha256: artifact.sha256
					, environment, mode, invalid
					, output: join(output, profile, `nullability-${invalid}`)
				}));
			await verifyFinContainerEdgeJvmEnvironment(context);
			const javaVersion = await runCopied(
				context.command, ["--version"], consumer
			);
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
				const counts = parseNestedCheckedRecordJvmResult(
					run.stdout, profile, mode
				);
				assert.deepEqual(
					await verifyFinContainerEdgeJvmEnvironment(current), closure
				);
				const observation = {
					stage: index ? "relocated" : "installed"
					, cwd: location, run, counts, closure
				};
				observations.push(observation);
				await saveLakeFile(output, `${profile}/${observation.stage}.json`
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
			const closure = await verifyNestedCheckedRecordJvmDeployment(
				sourceFree, context
			);
			const run = await runNestedCheckedRecordJvmDeployment(
				sourceFree, context
			);
			assert.equal(run.stderr, "");
			const counts = parseNestedCheckedRecordJvmResult(
				run.stdout, profile, mode
			);
			assert.deepEqual(await verifyNestedCheckedRecordJvmDeployment(
				sourceFree, context
			), closure);
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
			schemaVersion: 1, route, mode, producerCommit, runtime, builds
			, receipt, installation, consumers, resourceChecks
			, loadCeiling: maxLoad, declaredGlibcFloor: floor
			, expectedBindingIrSha256: hashBindingIr(expected)
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreeReplay: true
			, relocatedInstallation: true, sourceFreeDeployment: true
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
