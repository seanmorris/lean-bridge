/**
 * Independent CPAN builds and compiler-free or XS-only installed callbacks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, statfs, symlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { archiveCpanPackage, readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedDotnetCallbackResultCombinedConfiguration, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { prepareOwnedReceiverCli } from "./owned-receiver-cli.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";

const expected = { checks: 79, phases: { native: 25, host: 23, combined: 29 } };
const consumerPath = "tests/fixtures/structured-types/owned-perl-callback-results-installed.pl";
const assetProbePath = "tests/fixtures/structured-types/owned-perl-installed-assets.pl";
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });

const capture = async (command, args, cwd, env, timeoutMs = 180000) => ({
	command, args, cwd
	, ...await processBuildRunner.capture({ command, args, cwd, env, timeoutMs })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; })
});

const installArchive = async ({ archive, consumer, prefix, perl, mode, environment }) => {
	const root = await mkdtemp(join(consumer, ".cpan-install-"));
	const env = {
		...environment, LEAN_BRIDGE_PERL_INSTALL_MODE: mode
		, PERL5LIB: join(prefix, "lib/perl5")
	};
	const commands = [];
	try
	{
		commands.push(await capture("tar", ["-xzf", archive, "-C", root], consumer, env));
		const entries = await readdir(root); assert.equal(entries.length, 1);
		const packageRoot = join(root, entries[0]);
		commands.push(await capture(perl, ["Makefile.PL", `INSTALL_BASE=${prefix}`], packageRoot, env));
		commands.push(await capture("make", ["test", "install"], packageRoot, env));
		for(const command of commands) assert.equal(command.code, 0);
		return { archive: basename(archive), mode, commands };
	} finally
	{ await rm(root, { recursive: true, force: true }); }
};

const locate = (root, paths, suffix) => {
	const found = paths.filter(path => path.endsWith(suffix));
	assert.equal(found.length, 1, suffix);
	return join(root, found[0]);
};

const inspectAssets = async ({ consumer, prefix, perl, owned, paths }) => {
	const assets = [locate(prefix, paths, "/auto/LeanBridge/OwnedProbe/OwnedProbe.so")
		, ...[owned.gmpLibrary, owned.componentLibrary].map(name => locate(prefix, paths, "/LeanBridge/OwnedProbe/native/" + name))];
	const source = await readFile(assetProbePath, "utf8");
	await saveLakeFile(consumer, "inspect-assets.pl", source);
	const observations = [];
	for(const asset of assets) for(const mode of ["cold", "warm"])
	{
		const original = await readFile(asset), forged = Buffer.concat([original, Buffer.from("\nchanged installed native asset\n")]);
		const replacement = join(consumer, "changed-native-file");
		await saveLakeFile(consumer, "changed-native-file", forged);
		try
		{
			const args = ["inspect-assets.pl", mode, asset, replacement, ...assets];
			const execution = await capture(perl, args, consumer, {
				...copiedCleanEnvironment, PERL5LIB: join(prefix, "lib/perl5")
			});
			assert.equal(execution.code, 0); assert.equal(execution.stderr, "");
			const observation = JSON.parse(execution.stdout);
			assert.equal(observation.mode, mode); assert.equal(observation.checks, 7);
			assert.equal(observation.brokerIdentities, 0);
			observations.push({ asset: basename(asset), original: identity(original), forged: identity(forged), execution, observation });
		} finally
		{ await saveLakeFile(dirname(asset), basename(asset), original); }
	}
	return { sourceSha256: sha256(source), observations };
};

const executeInstalled = async ({ context, archives, perls, packages, source, diagnostic }) => {
	const observations = [];
	for(const [index, perl] of perls.entries()) for(const mode of ["prebuilt-only", "build-xs"])
	{
		const consumer = join(context.directory, `consumer-${index}-${mode}`);
		const staging = join(consumer, "handoff"), prefix = join(consumer, "installed"), tools = join(consumer, "tools");
		await mkdir(tools, { recursive: true });
		for(const command of [
			"make", "tar", "gzip", "sh", "cp", "mv", "rm"
			, "chmod", "mkdir", "touch", "true"
			, ...mode === "build-xs" ? ["cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld"] : []
		]) await symlink(`/usr/bin/${command}`, join(tools, command));
		const environment = {
			...copiedCleanEnvironment, PATH: tools
			, ...mode === "build-xs" ? { CC: "/usr/bin/cc", LD: "/usr/bin/cc" } : {}
		};
		const installs = [];
		for(const archive of archives)
		{
			assert.equal(sha256(archive.bytes), archive.sha256);
			await saveLakeFile(staging, archive.archive, archive.bytes);
			installs.push(await installArchive({ archive: join(staging, archive.archive), consumer, prefix, perl, mode, environment }));
		}
		await rm(staging, { recursive: true }); await assert.rejects(access(staging), { code: "ENOENT" });
		await rm(tools, { recursive: true }); await assert.rejects(access(tools), { code: "ENOENT" });
		const relocated = join(consumer, "relocated"); await rename(prefix, relocated);
		await assert.rejects(access(prefix), { code: "ENOENT" });
		const paths = await nativeArtifactPaths(relocated), receipts = [];
		for(const role of ["runtime", "component"])
		{
			const prepared = packages[role], name = role === "runtime" ? "Runtime" : "OwnedProbe";
			const receiptPath = locate(relocated, paths, `/LeanBridge/${name}/install-receipt.json`);
			const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
			assert.equal(receipt.operation, mode === "prebuilt-only" ? "prebuilt-xs" : "generated-xs-only");
			const binary = locate(relocated, paths, `/auto/LeanBridge/${name}/${name}.so`);
			const installed = identity(await readFile(binary));
			assert.equal(installed.sha256, receipt.outputSha256);
			const selected = prepared.manifest.prebuilt.filter(item => canonicalJson(item.abi) === canonicalJson(receipt.abi));
			assert.equal(selected.length, 1);
			if(mode === "prebuilt-only") assert.equal(receipt.outputSha256, prepared.manifest.files[selected[0].path]);
			else
			{
				assert.equal(receipt.sourceSha256, prepared.manifest.files[prepared.manifest.xs]);
				assert.ok(receipt.commands.length >= 2);
			}
			receipts.push({ role, receipt, installed });
		}
		assert.deepEqual(receipts[0].receipt.abi, receipts[1].receipt.abi);
		await saveLakeFile(consumer, "consumer.pl", source);
		const executions = [];
		for(let repeat = 0; repeat < 2; repeat++)
		{
			const execution = await capture(perl, ["consumer.pl"], consumer, {
				...copiedCleanEnvironment, PERL5LIB: join(relocated, "lib/perl5")
			});
			assert.equal(execution.code, 0); assert.equal(execution.stderr, "");
			const observation = JSON.parse(execution.stdout); assert.deepEqual(observation, expected);
			executions.push({ ...execution, observation });
		}
		const assets = await inspectAssets({ consumer, prefix: relocated, perl, owned: packages.component.manifest.ownedValues, paths });
		observations.push({ perl, mode, installs, receipts, executions, assets });
		diagnostic(JSON.stringify({ perl, mode, checks: expected.checks, runtimeExecutions: executions.length, assetRejections: assets.observations.length }));
		await rm(consumer, { recursive: true });
	}
	return observations;
};

for(const mode of ["ordinary", "reviewed"]) test(`installed CPAN callback-result matrix preserves combined owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_PACKAGE_TEST !== "1"
	, timeout: 2400000
}, async t => {
	const disk = await statfs("/tmp"); assert.ok(disk.bavail * disk.bsize >= 3 * 1024 ** 3, "CPAN matrix requires at least 3 GiB free");
	const configuration = mode === "ordinary" ? await ownedDotnetCallbackResultCombinedConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { cpan: { module: "LeanBridge::OwnedProbe", version: "0.010" } };
	const perls = perlGraphCommands(); assert.equal(perls.length, 4, "full installed matrix requires four pinned Perl ABIs");
	const context = await prepareOwnedReceiverCli(t, {
		label: `perl-callback-result-package-${mode}`, configuration
		, source: ownedDotnetCallbackResultCombinedSource, profiles: ["perl"]
		, reviewedIr: mode === "reviewed" ? ownedDotnetCallbackResultCombinedReviewedIr() : null
		, environment: { LEAN_BRIDGE_PERLS: JSON.stringify(perls) }
	});
	const { directory, project, output, handoff, author } = context;
	const initial = await lakeInputState(project), cliExecutions = [];
	const cli = join(author, "node_modules/.bin/lean-bridge");
	const build = async destination => {
		const execution = await capture(process.execPath, [cli, "build", "--project", project, "--target", "cpan", "--output", destination, "--json"], directory, context.environment, 900000);
		assert.equal(execution.code, 0);
		const response = JSON.parse(execution.stdout);
		assert.equal(response.status, "ok"); assert.deepEqual(response.result.targets, ["cpan"]);
		assert.deepEqual(await lakeInputState(project), initial);
		context.builds.push(response); cliExecutions.push({ ...execution, response });
		return response.result;
	};
	t.diagnostic(`${mode}: first real CLI producer build`);
	const built = await build(output), packages = {};
	for(const role of ["runtime", "component"]) packages[role] = await readVerifiedCpanPackage(join(output, "packages", role));
	const { manifest } = packages.component, model = JSON.parse(packages.component.files.get("model.json"));
	assert.equal(manifest.ownedValues.schemaVersion, 5); assert.equal(manifest.prebuilt.length, 4);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	for(const name of ["callbackResultAnchors", "resultAnchors", "inputTransfers", "receiverExports", "hostCallbacks"])
		assert.ok(model.ownedGraph[name], name);
	const reassembly = [];
	for(const role of ["runtime", "component"])
	{
		const again = await archiveCpanPackage({ packageRoot: join(output, "packages", role), outputRoot: join(directory, "reassembled") });
		const original = await readFile(join(output, "archives", again.receipt.archive)), repeated = await readFile(again.path);
		assert.deepEqual(repeated, original);
		reassembly.push({ role, receipt: again.receipt, original: identity(original), repeated: identity(repeated) });
	}
	await rm(join(directory, "reassembled"), { recursive: true });
	const first = await readVerifiedPackageSetReceipt({ receiptPath: join(output, "package-set-receipt.json") });
	const independent = join(directory, "independent");
	t.diagnostic(`${mode}: independent second real CLI producer build`);
	await build(independent);
	const second = await readVerifiedPackageSetReceipt({ receiptPath: join(independent, "package-set-receipt.json") });
	assert.deepEqual(second.receipt, first.receipt);
	const independentArchives = [];
	for(const role of ["runtime", "component"])
	{
		const other = await readVerifiedCpanPackage(join(independent, "packages", role));
		assert.deepEqual(other.manifest, packages[role].manifest);
	}
	for(const archive of built.packages)
	{
		const original = await readFile(join(output, "archives", archive.archive)), repeated = await readFile(join(independent, "archives", archive.archive));
		assert.deepEqual(repeated, original);
		independentArchives.push({ archive: archive.archive, original: identity(original), repeated: identity(repeated) });
	}
	await rm(independent, { recursive: true }); await assert.rejects(access(independent), { code: "ENOENT" });
	const packageSetReceipt = await copyPackageSetHandoff(output, handoff);
	const reportRoot = resolve("build/owned-perl-callback-results"); await mkdir(reportRoot, { recursive: true });
	const savedHandoff = await mkdtemp(join(reportRoot, `${mode}-combined-package-handoff-`));
	await copyPackageSetHandoff(output, savedHandoff);
	assert.deepEqual((await readVerifiedPackageSetReceipt({ receiptPath: join(savedHandoff, "package-set-receipt.json") })).receipt, packageSetReceipt);
	const input = { metadata: JSON.parse(packages.component.files.get("metadata.json")), sourceIdentity: model.sourceIdentity, component: model.component };
	const componentReceipt = JSON.parse(packages.component.files.get("native-component.json"));
	const producer = {
		schemaVersion: 1, mode, variant: "combined", cli: context.cli
		, cliInstallation: context.cliInstallation, cliBuilds: context.builds
		, cliExecutions, manifest, runtimeManifest: packages.runtime.manifest
		, componentReceipt, input, packageSetReceipt
		, independentPackageSetReceipt: second.receipt, independentArchives
		, reassembly, savedHandoff
	};
	await saveLakeFile(savedHandoff, "producer-observations.json", canonicalJson(producer));
	t.diagnostic(`${mode}: retained verified archives at ${savedHandoff}`);
	const archives = await Promise.all(built.packages.map(async archive => ({ ...archive, bytes: await readFile(join(handoff, "archives", archive.archive)) })));
	for(const path of [project, output])
	{ await rm(path, { recursive: true }); await assert.rejects(access(path), { code: "ENOENT" }); }
	const cliVerificationExecution = await capture(process.execPath, [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"], directory, copiedCleanEnvironment);
	const cliVerification = JSON.parse(cliVerificationExecution.stdout);
	assert.equal(cliVerificationExecution.code, 0); assert.equal(cliVerification.status, "ok");
	assert.equal(cliVerification.result.verificationType, "local-package-set");
	for(const path of [author, handoff])
	{ await rm(path, { recursive: true }); await assert.rejects(access(path), { code: "ENOENT" }); }
	const source = await readFile(consumerPath, "utf8");
	const observations = await executeInstalled({ context, archives, perls, packages, source, diagnostic: value => t.diagnostic(value) });
	assert.equal(observations.length, 8);
	await saveLakeFile(reportRoot, `${mode}-combined-package.json`, canonicalJson({
		...producer, cliVerification, cliVerificationExecution
		, consumerSha256: sha256(source), observations
		, limitations: ["no shared cross-language release", "no native adapter owner or allocation counters"]
	}));
});
