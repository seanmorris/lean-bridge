/**
 * Install the CPAN peer of one shared native/Wasm callback-result release.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
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

/**
 * Bind original CPAN archive bytes to the common native core before removal.
 *
 * @param options - Shared producer, original handoff and checked native inputs.
 */
export const prepareOwnedPerlCallbackCombined = async options => {
	const { root, mode, output, author, handoff, receipt, native, diagnostic } = options;
	const perls = perlGraphCommands();
	assert.equal(perls.length, 4, "The shared CPAN release requires all four pinned ABIs");
	const packages = {};
	for(const role of ["runtime", "component"])
		packages[role] = await readVerifiedCpanPackage(join(output, "profiles/native/packages", role));
	const { manifest, files } = packages.component;
	const model = JSON.parse(files.get("model.json"));
	const componentReceipt = JSON.parse(files.get("native-component.json"));
	const bindingManifest = JSON.parse(files.get("binding-manifest.json"));
	assert.deepEqual(model, native.model);
	assert.deepEqual(componentReceipt, native.receipt);
	assert.equal(manifest.ownedValues.schemaVersion, 5);
	assert.equal(manifest.nativeRuntimeIdentity, native.receipt.runtimeIdentity);
	assert.equal(packages.runtime.manifest.nativeRuntimeIdentity, native.receipt.runtimeIdentity);
	assert.equal(packages.runtime.manifest.runtimeIdentity, manifest.runtimeIdentity);
	assert.equal(manifest.prebuilt.length, 4);
	assert.equal(packages.runtime.manifest.prebuilt.length, 4);
	assert.deepEqual(manifest.ownedValues.callbackResultAnchors.signatures, native.model.ownedGraph.callbackResultAnchors.signatures);
	const library = files.get("lib/LeanBridge/OwnedProbe/native/" + manifest.ownedValues.componentLibrary);
	assert.deepEqual(identity(library), native.receipt.nativeLibrary);
	const selected = receipt.packages.filter(item => item.target === "cpan");
	assert.equal(selected.length, 2);
	assert.deepEqual(selected.map(item => item.role).sort(), ["component", "runtime"]);
	const archives = [];
	for(const role of ["runtime", "component"])
	{
		const pkg = selected.find(item => item.role === role);
		assert.equal(pkg.runtimeIdentity, native.receipt.runtimeIdentity);
		assert.equal(pkg.name, packages[role].manifest.distribution);
		assert.equal(pkg.version, packages[role].manifest.version);
		assert.equal(pkg.artifacts.length, 1);
		const artifact = pkg.artifacts[0], bytes = await readFile(join(handoff, artifact.path));
		assert.deepEqual(identity(bytes), { bytes: artifact.bytes, sha256: artifact.sha256 });
		archives.push({ archive: basename(artifact.path), sha256: artifact.sha256, bytes });
	}
	const source = await readFile(consumerPath, "utf8");
	const report = { manifest, runtimeManifest: packages.runtime.manifest
		, model, componentReceipt, bindingManifest
		, archives: archives.map(item => ({ archive: item.archive, ...identity(item.bytes) }))
		, consumerSha256: sha256(source), observations: []
		, limitations: ["no native adapter owner or allocation counters"] };
	const execute = async () => {
		for(const path of [output, author, handoff])
			await assert.rejects(access(path), { code: "ENOENT" });
		report.observations = await executeInstalled({
			context: { directory: join(root, mode + "-perl-installed") }
			, archives, perls, packages, source, diagnostic
		});
		assert.equal(report.observations.length, 8);
		await rm(join(root, mode + "-perl-installed"), { recursive: true });
	};
	return { report, execute };
};
