/**
 * Build owned Java/Kotlin archives and consume their public APIs offline.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedJvmEvidence } from "../src/build/owned-jvm-artifacts.mjs";
import { packageOwnedMaven } from "../src/release/owned-maven.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { ownedJvmInstalledFixture } from "./helpers/owned-jvm-installed.mjs";
import { inspectOwnedJvmInstalledAssets } from "./helpers/owned-jvm-installed-assets.mjs";
import { rejectOwnedJvmPackageMutations } from "./helpers/owned-jvm-package-tamper.mjs";
import { installedJvmCorpus } from "./helpers/type-corpus-jvm.mjs";
import { prepareJvmCorpusDependencies } from "./helpers/type-corpus-jvm-tools.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

for(const scalar of [false, true]) for(const reviewed of [false, true])
	test(`owned Maven ${scalar ? "scalars" : "callbacks"} installs offline (${reviewed ? "reviewed" : "ordinary"})`, {
		skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1200000
	}, async t => {
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-owned-maven-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const author = join(root, "author"), project = join(author, "project");
		const working = join(author, "release"), handoff = join(root, "handoff");
		await cp(resolve(`tests/fixtures/onboarding/${scalar ? "owned-scalars" : "owned-dotnet-callables"}`), project, { recursive: true });
		const config = reviewed ? { schemaVersion: 1, modules: ["Owned"] } : await json(join(project, "lean-bridge.exports.json"));
		config.targets = { maven: { name: "org.leanbridge:owned-values", version: "1.2.3" } };
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
		if(reviewed)
		{
			const ir = scalar ? ownedPythonScalarsReviewedIr() : ownedDotnetCallbacksReviewedIr();
			if(scalar) ir.component = { ...ir.component, id: "owned-scalars@1.0.0", name: "owned-scalars", version: "1.0.0" };
			await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ir));
		}
		const environment = nativeFixtureEnvironment(["java", "kotlin"]);
		const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX, before = await lakeInputState(project);
		t.diagnostic("CLI builds the Lean component, shared runtime and owned Maven package");
		const cli = resolve("scripts/lean-bridge.mjs");
		const invocation = await processBuildRunner.capture({ command: process.execPath
			, args: [cli, "build", "--project", project, "--output", working, "--target", "maven", "--json"]
			, cwd: root, env: environment, timeoutMs: 600000 })
			.catch(error => { error.message += ": " + (error.details?.stdout ?? "") + (error.details?.stderr ?? ""); throw error; });
		const response = JSON.parse(invocation.stdout);
		assert.equal(response.status, "ok");
		const built = response.result;
		assert.deepEqual(await lakeInputState(project), before);
		const options = { working
			, nativeRoot: join(working, "native/component")
			, runtimeRoot: join(working, "native/runtime")
			, leanPrefix, environment
			, settings: config.targets.maven };
		assert.equal(built.backend, "owned-jvm-v1");
		const adapterRoot = join(working, "native/owned-jvm-binding"), jvmRoot = join(working, "native/jvm");
		const verified = await ownedJvmEvidence({ ...options, adapterRoot });
		assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), reviewed);
		const compiled = await json(join(jvmRoot, "native-jvm.json"));
		const manifest = await json(join(working, "packages/maven/jar/META-INF/lean-bridge/package-receipt.json"));
		const tamperRejections = await rejectOwnedJvmPackageMutations({
			...options, adapterRoot, jvmRoot
			, glibcMinimumVersion: built.glibcMinimumVersion
		}, verified, compiled);
		const reassembled = await packageOwnedMaven({ ...options
			, working: join(author, "reassembled"), adapterRoot, jvmRoot
			, glibcMinimumVersion: built.glibcMinimumVersion });
		assert.deepEqual(reassembled.packages, built.packages);
		for(const pkg of built.packages)
			assert.deepEqual(await readFile(join(working, "archives", pkg.archive)), await readFile(join(author, "reassembled/archives", pkg.archive)));
		const receipt = await copyPackageSetHandoff(working, handoff);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["maven"]);
		const pkg = receipt.packages[0];
		t.diagnostic("Preparing hashed Maven plugin dependencies on the producer side");
		const dependencies = await prepareJvmCorpusDependencies({ directory: author, handoff, pkg, environment, clean: copiedCleanEnvironment });
		const fixture = await ownedJvmInstalledFixture(scalar, verified.projection.namespace, verified.projection.functions.map(fn => fn.publicName));
		const input = { metadata: await json(join(options.nativeRoot, "metadata.json"))
			, sourceIdentity: verified.model.sourceIdentity
			, component: verified.model.component };
		await rm(author, { recursive: true, force: true });
		await assert.rejects(access(author), { code: "ENOENT" });
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const checked = await processBuildRunner.capture({ command: process.execPath
			, args: [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"]
			, cwd: root, env: copiedCleanEnvironment });
		assert.equal(JSON.parse(checked.stdout).result.verificationType, "local-package-set");
		const observations = [];
		for(const profile of ["java", "kotlin"])
		{
			t.diagnostic(`${profile}: offline installation, source-free consumer and runtime-only relocation`);
			const profileHandoff = join(root, "handoff-" + profile);
			await cp(handoff, profileHandoff, { recursive: true });
			const result = await installedJvmCorpus({ library: { jvmModule: verified.projection.namespace }
				, profile, consumer: join(root, "consumer"), handoff: profileHandoff
				, pkg, dependencies, environment, clean: copiedCleanEnvironment
				, fixture: { ...fixture, ...!scalar && !reviewed && profile === "java"
					? { inspectInstalled: inspectOwnedJvmInstalledAssets } : {} } });
			assert.equal(result.observation.errors.length, 0);
			assert.equal(result.jvm.packageReceiptSha256, sha256(canonicalJson(manifest)));
			const checks = Number(result.observation.results.find(item => item.id === "owned/checks").observed.integer);
			assert.ok(checks >= (scalar ? 8 : 24));
			const signatures = Number(result.observation.results.find(item => item.id === "owned/signatures").observed.integer);
			assert.equal(signatures, scalar ? 8 : 51);
			observations.push({ profile, checks, ...result });
			await rm(join(root, "consumer", profile), { recursive: true, force: true });
		}
		await saveLakeFile(resolve("build/owned-jvm-packaging"), `${scalar ? "scalars" : "callbacks"}-${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
			schemaVersion: 1, planNode: 1219, reviewed, scalar
			, compiledLean: true, installedMaven: true
			, cliIntegrated: true, deterministicReassembly: true
			, cliBuild: response, packageSetReceipt: receipt
			, receiptVerifiedWithoutProducer: true
			, sourceUnchanged: true, sourceRemovedBeforeInstallation: true
			, input
			, componentReceipt: verified.receipt, adapterReceipt: verified.adapter
			, tamperRejections
			, compiledProjection: compiled, manifest, package: pkg
			, dependencies, observations
		}));
		t.diagnostic(JSON.stringify(observations.map(({ profile, checks }) => ({ profile, checks }))));
	});
