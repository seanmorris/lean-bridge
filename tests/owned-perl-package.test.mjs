/**
 * Install owned CPAN archives without Lean sources or producer tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { readVerifiedCpanPackage } from "../src/release/cpan-package.mjs";
import { installCpanArchive } from "../src/release/cpan-install.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { inspectOwnedPerlInstalledAssets } from "./helpers/owned-perl-installed-assets.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const explain = error => { error.message += `: ${JSON.stringify(error.details ?? {})}`; throw error; };

for(const complete of [false, true])
for(const reviewed of [false, true]) test(`installed owned Perl ${complete ? "callbacks" : "scalars"} preserve private GMP and source-free loading (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1200000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-perl-package-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), producer = join(directory, "producer"), handoff = join(directory, "handoff");
	const fixture = complete ? "owned-dotnet-callables" : "owned-scalars";
	await cp(resolve("tests/fixtures/onboarding", fixture), project, { recursive: true });
	const config = reviewed ? { schemaVersion: 1, modules: ["Owned"] }
		: JSON.parse(await readFile(join(project, "lean-bridge.exports.json"), "utf8"));
	config.targets = { cpan: { module: "LeanBridge::OwnedProbe", version: "0.007" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(reviewed)
	{
		const ir = complete ? ownedDotnetCallbacksReviewedIr() : ownedPythonScalarsReviewedIr();
		if(!complete) ir.component = { ...ir.component, id: "owned-scalars@1.0.0", name: "owned-scalars", version: "1.0.0" };
		await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ir));
	}
	const perls = perlGraphCommands(), before = await lakeInputState(project);
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const environment = { ...process.env, LEAN_BRIDGE_PERLS: JSON.stringify(perls), LEAN_BRIDGE_LEAN_PREFIX: leanPrefix };
	const cli = resolve("scripts/lean-bridge.mjs");
	t.diagnostic("CLI builds the Lean component, shared runtime and owned CPAN package");
	const invocation = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "build", "--project", project, "--output", producer, "--target", "cpan", "--json"]
		, cwd: directory, env: environment, timeoutMs: 600000 }).catch(explain);
	const response = JSON.parse(invocation.stdout);
	assert.equal(response.status, "ok");
	const built = response.result;
	assert.deepEqual(built.targets, ["cpan"]);
	assert.equal(built.backend, "perl");
	assert.deepEqual(await lakeInputState(project), before);
	const model = JSON.parse(await readFile(join(producer, "native/component/model.json"), "utf8"));
	assert.ok(model.ownedGraph.hostCallbacks);
	assert.equal("moduleName" in model, false);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), reviewed);
	const prepared = await readVerifiedCpanPackage(join(producer, "packages/component"));
	assert.equal(prepared.manifest.ownedValues.schemaVersion, 1);
	assert.equal(prepared.manifest.prebuilt.length, perls.length);
	const packageSet = await copyPackageSetHandoff(producer, handoff);
	assert.deepEqual(packageSet.packages.map(pkg => [pkg.target, pkg.role]), [["cpan", "component"], ["cpan", "runtime"]]);
	await rm(project, { recursive: true, force: true });
	await rm(producer, { recursive: true, force: true });
	const receiptPath = join(handoff, "package-set-receipt.json");
	await verifyPackageSetReceipt({ receiptPath });
	const verification = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "verify", "--receipt", receiptPath, "--json"]
		, cwd: directory, env: copiedCleanEnvironment }).catch(explain);
	assert.equal(JSON.parse(verification.stdout).result.verificationType, "local-package-set");
	const consumerSource = await readFile(`tests/fixtures/structured-types/owned-perl-${complete ? "signatures" : "installed-scalars"}.pl`, "utf8");
	const expectedExports = complete ? [
		"bundle", "callback_record", "callback_recursive", "construct", "dispatch"
		, "echo_alias", "echo_array", "echo_chain", "echo_list", "echo_mixed"
		, "echo_nested", "echo_option", "echo_record", "echo_recursive"
		, "echo_result", "echo_row", "echo_tuple", "echo_variant", "factory"
		, "identity_closure", "label", "make_record", "make_recursive"
		, "new_ticket", "payload", "primary", "repeatedly", "retain_callback"
		, "retain_ticket", "serial", "twice"
		, ...["bool", "bytes", "char", "f32", "f64", "i16", "i32", "i64", "i8"
			, "int", "isize", "nat", "string", "u16", "u32", "u64", "u8", "unit"
			, "usize"].map(kind => "via_" + kind)
		, "with_function"
	] : ["bits32", "bits64", "echo", "inspect", "make_packet", "new_ticket", "option_case", "units"];
	const observations = [];
	for(const [index, perl] of perls.entries()) for(const mode of ["prebuilt-only", "build-xs"])
	{
		const consumer = join(directory, `consumer-${index}-${mode}`);
		const prefix = join(consumer, "installed"), tools = join(consumer, "tools");
		await mkdir(tools, { recursive: true });
		const commands = ["make", "tar", "gzip", "sh", "cp", "mv", "rm"
			, "chmod", "mkdir", "touch", "true"
			, ...mode === "build-xs" ? ["cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld"] : []];
		for(const command of commands) await symlink(`/usr/bin/${command}`, join(tools, command));
		const installEnv = { ...copiedCleanEnvironment, PATH: tools
			, ...mode === "build-xs" ? { CC: "/usr/bin/cc", LD: "/usr/bin/cc" } : {} };
		for(const pkg of built.packages)
		{
			const archive = join(handoff, "archives", pkg.archive);
			assert.equal(sha256(await readFile(archive)), pkg.sha256);
			await installCpanArchive({ archive, workingRoot: consumer, prefix, perl, mode, environment: installEnv }).catch(explain);
		}
		const relocated = join(consumer, "relocated");
		await rename(prefix, relocated);
		await saveLakeFile(consumer, "consumer.pl", consumerSource);
		const execution = await runCopied(perl, ["consumer.pl", ...complete ? ["--installed"] : []], consumer
			, { ...copiedCleanEnvironment, PERL5LIB: join(relocated, "lib/perl5") });
		assert.equal(execution.stderr, "");
		const observed = JSON.parse(execution.stdout);
		assert.ok(observed.checks > 100);
		if(complete)
		{
			assert.equal(observed.primitives, 19); assert.equal(observed.brokerIdentities, 0);
			assert.equal(expectedExports.length, 51);
		}
		else assert.equal(observed.live, 0);
		assert.deepEqual(observed.exports, expectedExports);
		const assets = await inspectOwnedPerlInstalledAssets({
			consumer, prefix: relocated, perl
			, owned: prepared.manifest.ownedValues
		});
		observations.push({ perl, mode, observed, assets });
		t.diagnostic(JSON.stringify({ perl, mode, observed, assetChecks: assets.observations.length }));
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile(resolve("build/owned-perl-package"), `${complete ? "callbacks-" : ""}${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		packages: built, observations, installedPackage: true
		, cliIntegrated: true, cliBuild: response, packageSetReceipt: packageSet
		, receiptVerifiedWithoutProducer: true, sourceUnchanged: true
		, producerRemoved: true, relocated: true
		, consumerSha256: sha256(consumerSource), owned: prepared.manifest.ownedValues
		, files: prepared.manifest.files
	}));
});
