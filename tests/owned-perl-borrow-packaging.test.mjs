/**
 * Source-free CPAN handoffs retain compiler-authenticated borrowed-result lifetimes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { generateOwnedPerlPackage } from "../src/backends/perl/owned-package.mjs";
import { archiveCpanPackage, readVerifiedCpanPackage } from "../src/release/cpan-package.mjs";
import { installCpanArchive } from "../src/release/cpan-install.mjs";
import { verifyOwnedCpanTransfers } from "../src/release/owned-cpan-contract.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { inspectOwnedPerlInstalledAssets } from "./helpers/owned-perl-installed-assets.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const explain = error => { throw new Error(`${error.message}: ${JSON.stringify(error.details ?? {})}`, { cause: error }); };

test("CPAN borrowed-result metadata and POD bind the original whole owner", async () => {
	const record = JSON.parse(await readFile("docs/evidence/owned-borrow-results-20260930.json", "utf8"));
	for(const { input } of record.packages)
	{
		const model = createCompiledNativeModel(input, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true });
		const generated = generateOwnedPerlPackage({ model, metadata: input.metadata
			, receipt: { runtimeIdentity: "0".repeat(64), library: "libcomponent_01234567890123456789.so", nativeLibrary: { sha256: "1".repeat(64) } }
			, moduleName: "LeanBridge::OwnedProbe", gmpSha256: "2".repeat(64) });
		assert.equal(generated.owned.schemaVersion, 3);
		assert.equal(generated.owned.inputTransfers.arguments, "whole-values");
		assert.equal(generated.owned.inputTransfers.borrowedInputs, "reject");
		assert.equal(generated.owned.resultAnchors.emptyValues, "owner-scoped");
		assert.deepEqual(generated.owned.resultAnchors.exports, model.ownedGraph.resultAnchors.exports);
		assert.equal(JSON.parse(generated.files["binding-manifest.json"]).schemaVersion, 3);
		assert.match(generated.files["lib/LeanBridge/OwnedProbe.pm"], /Transfers consume the original native owner/u);
		assert.match(generated.files["lib/LeanBridge/OwnedProbe.pm"], /including empty arrays and None/u);
	}
});

test("Perl installer validates borrowed-result policies on each selected ABI", {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_BORROW_TEST !== "1", timeout: 240000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-borrow-installer-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const record = JSON.parse(await readFile("docs/evidence/owned-borrow-results-20260930.json", "utf8"));
	const input = record.packages[0].input;
	const model = createCompiledNativeModel(input, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true });
	const generated = generateOwnedPerlPackage({ model, metadata: input.metadata
		, receipt: { runtimeIdentity: "0".repeat(64), library: "libcomponent_01234567890123456789.so", nativeLibrary: { sha256: "1".repeat(64) } }
		, moduleName: "LeanBridge::OwnedProbe", gmpSha256: "2".repeat(64) });
	const manifest = { module: "LeanBridge::OwnedProbe", ownedValues: generated.owned };
	await saveLakeFile(directory, "LeanBridgeBuild.pm", await readFile("src/backends/perl/Build.pm"));
	await saveLakeFile(directory, "inc/LeanBridge/Runtime/Platform.pm", await readFile("src/backends/perl/Platform.pm"));
	await saveLakeFile(directory, "model.json", canonicalJson(model));
	await saveLakeFile(directory, "binding-manifest.json", generated.files["binding-manifest.json"]);
	for(const perl of perlGraphCommands())
	{
		const args = ["-I.", "-MLeanBridgeBuild", "-e", "LeanBridgeBuild::owned_values(LeanBridgeBuild::read_json('manifest.json')); print qq(ok\\n)"];
		await saveLakeFile(directory, "manifest.json", canonicalJson(manifest));
		const run = await runCopied(perl, args, directory, copiedCleanEnvironment);
		assert.equal(run.stdout, "ok\n"); assert.equal(run.stderr, "");
		for(const mutate of [
			value => { value.ownedValues.schemaVersion = 2; }
			, value => { delete value.ownedValues.resultAnchors; }
			, value => { value.ownedValues.resultAnchors.emptyValues = "unowned"; }
			, value => { value.ownedValues.resultAnchors.exports.pop(); }
			, value => { value.ownedValues.inputTransfers.arguments = "ordinary-values"; }
		]) {
			const changed = structuredClone(manifest); mutate(changed);
			await saveLakeFile(directory, "manifest.json", canonicalJson(changed));
			const binding = JSON.parse(generated.files["binding-manifest.json"]);
			binding.owned = changed.ownedValues;
			await saveLakeFile(directory, "binding-manifest.json", canonicalJson(binding));
			await assert.rejects(runCopied(perl, args, directory, copiedCleanEnvironment));
		}
		await saveLakeFile(directory, "binding-manifest.json", generated.files["binding-manifest.json"]);
	}
});

const rejectMutations = ({ manifest, files }) => {
	const cases = ["schema", "missing", "anchor", "empty", "ownership", "export"
		, "binding", "model", "receipt", "xs", "c-source"
		, "header", "module", "library"];
	for(const name of cases)
	{
		const changed = structuredClone(manifest), payload = new Map(files), owned = changed.ownedValues;
		const update = (path, mutate) => {
			const value = JSON.parse(payload.get(path)); mutate(value);
			payload.set(path, Buffer.from(canonicalJson(value)));
		};
		if(name === "schema") owned.schemaVersion = 2;
		else if(name === "missing") delete changed.ownedValues;
		else if(name === "anchor") owned.resultAnchors.anchor = "copied-owner";
		else if(name === "empty") owned.resultAnchors.emptyValues = "unowned";
		else if(name === "ownership") owned.inputTransfers.arguments = "ordinary-values";
		else if(name === "export") owned.resultAnchors.exports.pop();
		else if(name === "binding") update("binding-manifest.json", value => { delete value.owned.resultAnchors; });
		else if(name === "model") update("model.json", value => { delete value.ownedGraph.resultAnchors; });
		else if(name === "receipt") update("native-component.json", value => { value.resultAnchors.exports.pop(); });
		else
		{
			const path = { xs: "Component.xs", "c-source": `owned/src/${owned.prefix}.c`
				, header: `owned/include/${owned.prefix}.h`
				, module: "lib/LeanBridge/OwnedProbe.pm"
				, library: `lib/LeanBridge/OwnedProbe/native/${owned.componentLibrary}` }[name];
			payload.set(path, Buffer.concat([payload.get(path), Buffer.from("\n/* altered lifetime */\n")]));
		}
		for(const [path, value] of payload) changed.files[path] = sha256(value);
		assert.throws(() => verifyOwnedCpanTransfers(changed, payload), undefined, name);
	}
	return cases;
};

for(const mode of ["ordinary", "reviewed"]) test(`installed CPAN borrowed results survive source removal (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_BORROW_TEST !== "1", timeout: 1200000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-perl-borrow-packages-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const author = join(directory, "author"), project = join(author, "project");
	const producer = join(author, "release"), handoff = join(directory, "handoff");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedRustBorrowSource);
	const config = mode === "ordinary" ? await ownedRustBorrowConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { cpan: { module: "LeanBridge::OwnedProbe", version: "0.009" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustBorrowReviewedIr()));
	const perls = perlGraphCommands(), before = await lakeInputState(project);
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const environment = { ...process.env, LEAN_BRIDGE_PERLS: JSON.stringify(perls), LEAN_BRIDGE_LEAN_PREFIX: leanPrefix };
	const cli = resolve("scripts/lean-bridge.mjs");
	t.diagnostic(`${mode}: build authenticated borrowed-result CPAN archives`);
	const run = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "build", "--project", project, "--output", producer, "--target", "cpan", "--json"]
		, cwd: directory, env: environment, timeoutMs: 600000 }).catch(explain);
	const response = JSON.parse(run.stdout); assert.equal(response.status, "ok");
	const built = response.result; assert.deepEqual(built.targets, ["cpan"]);
	assert.deepEqual(await lakeInputState(project), before);
	const prepared = await readVerifiedCpanPackage(join(producer, "packages/component"));
	const { ownedValues: owned } = prepared.manifest;
	assert.equal(owned.schemaVersion, 3); assert.equal(owned.resultAnchors.exports.length, 19);
	assert.equal(owned.inputTransfers.arguments, "whole-values");
	assert.equal(prepared.manifest.prebuilt.length, perls.length);
	const model = JSON.parse(prepared.files.get("model.json"));
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const tamperRejections = rejectMutations(prepared);
	for(const name of ["runtime", "component"])
	{
		const again = await archiveCpanPackage({ packageRoot: join(producer, "packages", name), outputRoot: join(author, "reassembled") });
		assert.deepEqual(await readFile(again.path), await readFile(join(producer, "archives", again.receipt.archive)));
	}
	const packageSet = await copyPackageSetHandoff(producer, handoff);
	await rm(author, { recursive: true, force: true }); await assert.rejects(access(author), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const verification = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"]
		, cwd: directory, env: copiedCleanEnvironment }).catch(explain);
	assert.equal(JSON.parse(verification.stdout).result.verificationType, "local-package-set");
	const archives = await Promise.all(built.packages.map(async pkg => ({ ...pkg, bytes: await readFile(join(handoff, "archives", pkg.archive)) })));
	await rm(handoff, { recursive: true, force: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const consumerSource = await readFile("tests/fixtures/structured-types/owned-perl-borrows.pl", "utf8"), observations = [];
	for(const [index, perl] of perls.entries()) for(const installMode of ["prebuilt-only", "build-xs"])
	{
		const consumer = join(directory, `consumer-${index}-${installMode}`), staging = join(consumer, "handoff");
		const prefix = join(consumer, "installed"), tools = join(consumer, "tools");
		await mkdir(tools, { recursive: true });
		for(const command of ["make", "tar", "gzip", "sh", "cp", "mv", "rm"
			, "chmod", "mkdir", "touch", "true"
			, ...installMode === "build-xs" ? ["cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld"] : []])
			await symlink(`/usr/bin/${command}`, join(tools, command));
		const installEnv = { ...copiedCleanEnvironment, PATH: tools
			, ...installMode === "build-xs" ? { CC: "/usr/bin/cc", LD: "/usr/bin/cc" } : {} };
		for(const archive of archives)
		{
			assert.equal(sha256(archive.bytes), archive.sha256);
			await saveLakeFile(staging, archive.archive, archive.bytes);
			await installCpanArchive({ archive: join(staging, archive.archive)
				, workingRoot: consumer, prefix, perl, mode: installMode
				, environment: installEnv }).catch(explain);
		}
		await rm(staging, { recursive: true, force: true }); await assert.rejects(access(staging), { code: "ENOENT" });
		await rm(tools, { recursive: true, force: true });
		const relocated = join(consumer, "relocated"); await rename(prefix, relocated);
		await saveLakeFile(consumer, "consumer.pl", consumerSource);
		const runtimeEnv = { ...copiedCleanEnvironment, PATH: "/unavailable", PERL5LIB: join(relocated, "lib/perl5") };
		let observed;
		for(let repeat = 0; repeat < 2; repeat++)
		{
			const execution = await runCopied(perl, ["consumer.pl", "--installed"], consumer, runtimeEnv).catch(explain);
			assert.equal(execution.stderr, ""); const actual = JSON.parse(execution.stdout);
			assert.ok(actual.checks > 100); assert.equal(actual.brokerIdentities, 0);
			if(observed) assert.deepEqual(actual, observed); observed = actual;
		}
		const assets = await inspectOwnedPerlInstalledAssets({ consumer, prefix: relocated, perl, owned });
		observations.push({ perl, mode: installMode, runtimeOnlyRuns: 2, observed, assets });
		t.diagnostic(JSON.stringify({ perl, mode: installMode, checks: observed.checks, assetChecks: assets.observations.length }));
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile(resolve("build/owned-perl-borrow-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, packages: built, observations
		, installedPackage: true, cliIntegrated: true, cliBuild: response
		, packageSetReceipt: packageSet
		, receiptVerifiedWithoutProducer: true, sourceUnchanged: true
		, deterministicReassembly: true
		, producerRemoved: true, handoffRemovedBeforeExecution: true, relocated: true
		, consumerSha256: sha256(consumerSource), owned, manifest: prepared.manifest
		, componentReceipt: JSON.parse(prepared.files.get("native-component.json"))
		, files: prepared.manifest.files, tamperRejections
		, input: { metadata: JSON.parse(prepared.files.get("metadata.json")), sourceIdentity: model.sourceIdentity, component: model.component }
	}));
});
