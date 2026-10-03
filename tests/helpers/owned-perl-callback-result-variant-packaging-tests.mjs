/**
 * Real independent no-host/host CPAN producers and relocated installed consumers.
 * No synthetic library is accepted as installed execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, statfs, symlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { archiveCpanPackage, readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { prepareOwnedReceiverCli } from "./owned-receiver-cli.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";

const consumerPath = "tests/fixtures/structured-types/owned-perl-callback-results-variants-installed.pl";
const driverPath = "tests/helpers/owned-perl-callback-result-variant-producer.mjs";
const assetProbePath = "tests/fixtures/structured-types/owned-perl-installed-assets.pl";
const pinnedAbis = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"];
const perlVariant = perl => {
	const variant = perl.match(/\/perl\/([^/]+)\/bin\/perl$/u)?.[1];
	assert.ok(pinnedAbis.includes(variant), perl); return variant;
};
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const compactJson = value => JSON.stringify(JSON.parse(canonicalJson(value)));
const expected = (variant, query) => ({
	checks: variant === "host" ? 64 : 39
	, phases: { surface: 2, native: 30
		, ...variant === "host" ? { host: 30 } : { no_host: 5 } }
	, variant
	, perlVersion: query.perlVersion
	, threaded: query.threaded
	, archname: query.abi.archname
});

// Keep complete raw failed executions as well as success. Nonzero status never
// satisfies the installed assertions, and every capture is checkpointed first.
const capture = (command, args, cwd, env, timeoutMs = 180000) => new Promise(resolveCapture => {
	const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
	const stdout = [], stderr = [];
	let spawnError = null, timedOut = false;
	const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
	child.stdout.on("data", bytes => stdout.push(bytes));
	child.stderr.on("data", bytes => stderr.push(bytes));
	child.on("error", error => { spawnError = error.message; });
	child.on("close", (code, signal) => {
		clearTimeout(timer);
		resolveCapture({ command, args, cwd, code, signal, timedOut, spawnError
			, stdout: Buffer.concat(stdout).toString("utf8")
			, stderr: Buffer.concat(stderr).toString("utf8") });
	});
});
const succeeded = execution => {
	assert.equal(execution.code, 0, JSON.stringify(execution));
	assert.equal(execution.signal, null); assert.equal(execution.spawnError, null); assert.equal(execution.timedOut, false);
};
const missing = async path => { await rm(path, { recursive: true }); await assert.rejects(access(path), { code: "ENOENT" }); };
const locate = (root, paths, suffix) => {
	const found = paths.filter(path => path.endsWith(suffix)); assert.equal(found.length, 1, suffix);
	return join(root, found[0]);
};
const diskAvailable = async () => { const disk = await statfs("/tmp"); return disk.bavail * disk.bsize; };

const installArchive = async ({ archive, consumer, prefix, perl, mode, environment, installs, checkpoint }) => {
	const root = await mkdtemp(join(consumer, ".cpan-install-"));
	const env = { ...environment, LEAN_BRIDGE_PERL_INSTALL_MODE: mode, PERL5LIB: join(prefix, "lib/perl5") };
	const item = { archive: basename(archive), mode, commands: [] }; installs.push(item);
	const run = async (command, args, cwd) => {
		const execution = await capture(command, args, cwd, env); item.commands.push(execution);
		await checkpoint(); succeeded(execution);
	};
	try
	{
		await run("tar", ["-xzf", archive, "-C", root], consumer);
		const entries = await readdir(root); assert.equal(entries.length, 1);
		const packageRoot = join(root, entries[0]);
		await run(perl, ["Makefile.PL", `INSTALL_BASE=${prefix}`], packageRoot);
		await run("make", ["test", "install"], packageRoot);
		const manifestBytes = await readFile(join(packageRoot, "lean-bridge-package.json"));
		const manifest = JSON.parse(manifestBytes), relative = manifest.module.replaceAll("::", "/");
		item.manifestIdentity = identity(manifestBytes);
		const receiptBytes = await readFile(join(packageRoot, "lib", relative, "install-receipt.json"));
		const receipt = JSON.parse(receiptBytes);
		item.receiptIdentity = identity(receiptBytes);
		if(mode === "build-xs")
		{
			const stem = manifest.module.split("::").at(-1);
			item.generatedC = identity(await readFile(join(packageRoot, "_xs-build", `${stem}.c`)));
			item.generatedXs = identity(await readFile(join(packageRoot, "_xs-build", `${stem}.so`)));
			assert.equal(item.generatedC.sha256, receipt.generatedCSha256);
			assert.equal(item.generatedXs.sha256, receipt.outputSha256);
			assert.equal(receipt.sourceSha256, manifest.files[manifest.xs]);
			assert.equal(receipt.runtimeIdentity, manifest.runtimeIdentity);
			assert.equal(receipt.commands.length, 2);
			const [compile, link] = receipt.commands;
			assert.deepEqual(compile.filter(argument => argument.endsWith(".c")), [`_xs-build/${stem}.c`]);
			assert.ok(compile.includes("-c"));
			assert.ok(link.includes(`_xs-build/${stem}.o`) && link.includes(`_xs-build/${stem}.so`));
			for(const command of [compile[0], link[0]]) assert.doesNotMatch(command, /(?:^|\/)(?:lean|lake|node|emcc)$/u);
			item.commandsSha256 = sha256(canonicalJson(receipt.commands));
		} else await assert.rejects(access(join(packageRoot, "_xs-build")), { code: "ENOENT" });
		await checkpoint();
	} finally
	{ await rm(root, { recursive: true, force: true }); }
};

const inspectAssets = async ({ consumer, prefix, perl, owned, paths, evidence, checkpoint }) => {
	const assets = [locate(prefix, paths, "/auto/LeanBridge/OwnedProbe/OwnedProbe.so")
		, ...[owned.gmpLibrary, owned.componentLibrary].map(name => locate(prefix, paths, "/LeanBridge/OwnedProbe/native/" + name))];
	const source = await readFile(assetProbePath, "utf8");
	await saveLakeFile(consumer, "inspect-assets.pl", source);
	evidence.assets = { sourceSha256: sha256(source), observations: [] };
	for(const asset of assets) for(const mode of ["cold", "warm"])
	{
		const original = await readFile(asset), forged = Buffer.concat([original, Buffer.from("\nchanged installed native asset\n")]);
		const replacement = join(consumer, "changed-native-file");
		await saveLakeFile(consumer, "changed-native-file", forged);
		try
		{
			const execution = await capture(perl, ["inspect-assets.pl", mode, asset, replacement, ...assets], consumer, {
				...copiedCleanEnvironment, PERL5LIB: join(prefix, "lib/perl5")
			});
			const item = { asset: basename(asset), original: identity(original), forged: identity(forged), execution };
			evidence.assets.observations.push(item); await checkpoint();
			succeeded(execution); assert.equal(execution.stderr, "");
			item.observation = JSON.parse(execution.stdout);
			assert.deepEqual(item.observation, { mode, checks: 7, brokerIdentities: 0 });
		} finally
		{ await saveLakeFile(dirname(asset), basename(asset), original); }
	}
};

const executeInstalled = async ({ context, archives, perls, packages, source, report, checkpoint, diagnostic }) => {
	for(const [index, perl] of perls.entries()) for(const mode of ["prebuilt-only", "build-xs"])
	{
		assert.ok(await diskAvailable() >= 700 * 1024 ** 2, "installed case requires 700 MiB free");
		const consumer = join(context.directory, `consumer-${index}-${mode}`);
		const staging = join(consumer, "handoff"), prefix = join(consumer, "installed"), tools = join(consumer, "tools");
		await mkdir(tools, { recursive: true });
		for(const command of [
			"make", "tar", "gzip", "sh", "cp", "mv", "rm"
			, "chmod", "mkdir", "touch", "true"
			, ...mode === "build-xs" ? ["cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld"] : []])
			await symlink(`/usr/bin/${command}`, join(tools, command));
		const environment = { ...copiedCleanEnvironment, PATH: tools
			, ...mode === "build-xs" ? { CC: "/usr/bin/cc", LD: "/usr/bin/cc" } : {} };
		const item = { perl, abiVariant: perlVariant(perl), mode, installs: [], receipts: [], executions: [] };
		report.observations.push(item);
		for(const archive of archives)
		{
			assert.equal(sha256(archive.bytes), archive.sha256);
			await saveLakeFile(staging, archive.archive, archive.bytes);
			await installArchive({ archive: join(staging, archive.archive)
				, consumer, prefix, perl, mode, environment
				, installs: item.installs, checkpoint });
		}
		await missing(staging); await missing(tools);
		const relocated = join(consumer, "relocated"); await rename(prefix, relocated);
		await assert.rejects(access(prefix), { code: "ENOENT" });
		item.removed = { handoff: staging, tools, originalPrefix: prefix }; item.relocated = relocated;
		const paths = await nativeArtifactPaths(relocated), query = report.abiQueries[index].observation;
		for(const [roleIndex, role] of ["runtime", "component"].entries())
		{
			const prepared = packages[role], name = role === "runtime" ? "Runtime" : "OwnedProbe";
			const receiptPath = locate(relocated, paths, `/LeanBridge/${name}/install-receipt.json`);
			const receiptBytes = await readFile(receiptPath), receipt = JSON.parse(receiptBytes);
			const extraction = item.installs[roleIndex];
			assert.deepEqual(identity(receiptBytes), extraction.receiptIdentity);
			assert.equal(extraction.manifestIdentity.sha256, sha256(canonicalJson(prepared.manifest)));
			assert.equal(receipt.operation, mode === "prebuilt-only" ? "prebuilt-xs" : "generated-xs-only");
			assert.deepEqual(receipt.abi, query.abi); assert.equal(sha256(compactJson(receipt.abi)), query.key);
			const binary = locate(relocated, paths, `/auto/LeanBridge/${name}/${name}.so`);
			const installed = identity(await readFile(binary)); assert.equal(installed.sha256, receipt.outputSha256);
			const selected = prepared.manifest.prebuilt.filter(candidate => canonicalJson(candidate.abi) === canonicalJson(receipt.abi));
			assert.equal(selected.length, 1); assert.equal(selected[0].abiKey, query.key);
			if(mode === "prebuilt-only") assert.equal(receipt.outputSha256, prepared.manifest.files[selected[0].path]);
			else
			{
				assert.equal(receipt.sourceSha256, prepared.manifest.files[prepared.manifest.xs]);
				assert.equal(receipt.commands.length, 2);
				assert.equal(sha256(canonicalJson(receipt.commands)), extraction.commandsSha256);
				assert.equal(receipt.generatedCSha256, extraction.generatedC.sha256);
				assert.equal(receipt.outputSha256, extraction.generatedXs.sha256);
			}
			item.receipts.push({ role, receipt, receiptIdentity: identity(receiptBytes), installed });
		}
		item.nativePayload = [];
		for(const role of ["runtime", "component"])
		{
			for(const [path, hash] of Object.entries(packages[role].manifest.files))
			{
				if(!/^lib\/.*\/native\//u.test(path)) continue;
				const installed = identity(await readFile(locate(relocated, paths, "/" + path.slice(4))));
				assert.equal(installed.sha256, hash);
				item.nativePayload.push({ role, path, ...installed });
			}
		}
		await saveLakeFile(consumer, "consumer.pl", source);
		for(let repeat = 0; repeat < 2; repeat++)
		{
			const execution = await capture(perl, ["consumer.pl", report.variant], consumer, {
				...copiedCleanEnvironment, PERL5LIB: join(relocated, "lib/perl5")
			});
			item.executions.push(execution); await checkpoint();
			succeeded(execution); assert.equal(execution.stderr, "");
			execution.observation = JSON.parse(execution.stdout);
			assert.deepEqual(execution.observation, expected(report.variant, query));
			assert.equal(execution.stdout, compactJson(execution.observation) + "\n");
		}
		await inspectAssets({ consumer
			, prefix: relocated, perl
			, owned: packages.component.manifest.ownedValues
			, paths, evidence: item, checkpoint });
		await checkpoint();
		diagnostic(JSON.stringify({ variant: report.variant
			, perl, mode, checks: expected(report.variant, query).checks
			, runtimeExecutions: item.executions.length
			, assetRejections: item.assets.observations.length }));
		await missing(consumer);
	}
};

for(const mode of ["ordinary", "reviewed"]) for(const variant of ["no-host", "host"])
test(`installed CPAN callback-result owners (${mode}, ${variant})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_VARIANT_PACKAGE_TEST !== "1"
	, timeout: 2400000
}, async t => {
	assert.ok(await diskAvailable() >= 2.5 * 1024 ** 3, "sequential CPAN variant requires 2.5 GiB before producer staging");
	const perls = perlGraphCommands();
	assert.deepEqual(perls.map(perlVariant), pinnedAbis, "all four pinned ABIs, in order");
	const configuration = mode === "ordinary" ? await ownedDotnetCallbackResultConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { cpan: { module: "LeanBridge::OwnedProbe", version: "0.010" } };
	const context = await prepareOwnedReceiverCli(t, {
		label: `perl-callback-variant-${mode}-${variant}`
		, configuration
		, source: ownedDotnetCallbackResultSource
		, profiles: ["perl"]
		, reviewedIr: mode === "reviewed" ? ownedDotnetCallbackResultReviewedIr() : null
		, environment: { LEAN_BRIDGE_PERLS: JSON.stringify(perls) }
	});
	const { directory, project, output, handoff, author } = context;
	const initial = await lakeInputState(project), cli = join(author, "node_modules/.bin/lean-bridge");
	const source = await readFile(consumerPath, "utf8"), driver = await readFile(driverPath, "utf8");
	const reportRoot = resolve("build/owned-perl-callback-result-variants"); await mkdir(reportRoot, { recursive: true });
	const savedHandoff = await mkdtemp(join(reportRoot, `${mode}-${variant}-package-handoff-`));
	const report = { schemaVersion: 1
		, mode, variant, stage: "producer", savedHandoff
		, producerInterface: variant === "no-host" ? "native-build-api" : "installed-cli"
		, cli: context.cli
		, cliInstallation: context.cliInstallation
		, producerExecutions: []
		, sourceInputs: { configuration
			, lean: await readFile(join(project, "Owned.lean"), "utf8")
			, reviewedIr: mode === "reviewed" ? ownedDotnetCallbackResultReviewedIr() : null }
		, producerDriver: variant === "no-host" ? { path: driverPath, source: driver, sha256: sha256(driver) } : null
		, consumer: { path: consumerPath, source, sha256: sha256(source) }
		, abiQueries: []
		, observations: []
		, limitations: ["no shared cross-language release"
			, "no native adapter owner or allocation counters"
			, "no-host producer uses the installed native build API, not the CLI build command"] };
	const checkpoint = () => saveLakeFile(savedHandoff, "observations.partial.json", canonicalJson(report));
	await checkpoint();
	if(variant === "no-host") await saveLakeFile(author, "native-build-api.mjs", driver);
	const build = async destination => {
		const args = variant === "host"
			? [cli, "build", "--project", project, "--target", "cpan", "--output", destination, "--json"]
			: [join(author, "native-build-api.mjs")
				, join(author, "node_modules", context.cli.package.name)
				, project, destination, context.environment.LEAN_BRIDGE_LEAN_PREFIX];
		const execution = await capture(process.execPath, args, directory, context.environment, 900000);
		report.producerExecutions.push(execution); await checkpoint(); succeeded(execution);
		const response = JSON.parse(execution.stdout); execution.response = response;
		assert.equal(response.status, "ok"); assert.deepEqual(response.result.targets, ["cpan"]);
		if(variant === "no-host") assert.equal(response.producerInterface, "native-build-api");
		assert.deepEqual(await lakeInputState(project), initial);
		return response.result;
	};
	try
	{
		t.diagnostic(`${mode}/${variant}: first real ${report.producerInterface} producer`);
		const built = await build(output), packages = {};
		for(const role of ["runtime", "component"]) packages[role] = await readVerifiedCpanPackage(join(output, "packages", role));
		const { manifest, files } = packages.component, model = JSON.parse(files.get("model.json"));
		assert.equal(manifest.ownedValues.schemaVersion, 5); assert.equal(manifest.prebuilt.length, 4);
		assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
		assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
		assert.equal(Boolean(model.ownedGraph.hostCallbacks), variant === "host");
		for(const key of ["resultAnchors", "inputTransfers", "receiverExports"]) assert.equal(Boolean(model.ownedGraph[key]), false, key);
		assert.equal(files.has("callbacks.c"), variant === "host");
		Object.assign(report, { built
			, manifest, runtimeManifest: packages.runtime.manifest
			, componentReceipt: JSON.parse(files.get("native-component.json"))
			, input: { metadata: JSON.parse(files.get("metadata.json")), sourceIdentity: model.sourceIdentity, component: model.component }
			, sources: Object.fromEntries([...files].filter(([path]) => /\.(?:h|c|xs|pm|lean)$/.test(path) || path === "model.json")
				.map(([path, bytes]) => [path, { ...identity(bytes), source: bytes.toString("utf8") }])) });
		report.packageSetReceipt = await copyPackageSetHandoff(output, savedHandoff);
		await copyPackageSetHandoff(output, handoff);
		await checkpoint();
		for(const perl of perls)
		{
			const execution = await capture(perl, ["-I."
				, "-MLeanBridgeBuild", "-MConfig", "-e"
				, 'print JSON::PP->new->canonical->encode({key => LeanBridgeBuild::abi_key(), abi => LeanBridgeBuild::abi(), perlVersion => "$^V", threaded => $Config{useithreads} ? 1 : 0})']
			, join(output, "packages/component"), context.environment);
			const item = { perl, execution }; report.abiQueries.push(item); await checkpoint(); succeeded(execution);
			assert.equal(execution.stderr, "");
			item.observation = JSON.parse(execution.stdout);
			const abi = perlVariant(perl);
			assert.equal(item.observation.perlVersion, "v" + abi.split("-")[0]);
			assert.equal(item.observation.threaded, Number(!abi.endsWith("unthreaded")));
			assert.equal(item.observation.abi.useithreads, abi.endsWith("unthreaded") ? "" : "define");
			assert.equal(item.observation.key, sha256(compactJson(item.observation.abi)));
			for(const role of ["runtime", "component"])
				assert.deepEqual(packages[role].manifest.prebuilt.find(entry => entry.abiKey === item.observation.key)?.abi, item.observation.abi);
		}
		report.reassembly = [];
		for(const role of ["runtime", "component"])
		{
			const again = await archiveCpanPackage({ packageRoot: join(output, "packages", role), outputRoot: join(directory, "reassembled") });
			const original = await readFile(join(output, "archives", again.receipt.archive)), repeated = await readFile(again.path);
			assert.deepEqual(repeated, original);
			report.reassembly.push({ role, receipt: again.receipt, original: identity(original), repeated: identity(repeated) });
		}
		await missing(join(directory, "reassembled"));
		const archives = await Promise.all(built.packages.map(async archive => ({ ...archive, bytes: await readFile(join(savedHandoff, "archives", archive.archive)) })));
		// The first output is already verified and preserved as unsigned archives. Do
		// not keep two uncompressed 150-MiB Lean runtimes while independently building.
		await missing(output); await checkpoint();
		const independent = join(directory, "independent");
		t.diagnostic(`${mode}/${variant}: independent second real producer`);
		const secondBuilt = await build(independent); assert.deepEqual(secondBuilt.packages, built.packages);
		report.independentPackageSetReceipt = (await readVerifiedPackageSetReceipt({ receiptPath: join(independent, "package-set-receipt.json") })).receipt;
		assert.deepEqual(report.independentPackageSetReceipt, report.packageSetReceipt);
		for(const role of ["runtime", "component"])
			assert.deepEqual((await readVerifiedCpanPackage(join(independent, "packages", role))).manifest, packages[role].manifest);
		report.independentArchives = [];
		for(const archive of archives)
		{
			const repeated = await readFile(join(independent, "archives", archive.archive)); assert.deepEqual(repeated, archive.bytes);
			report.independentArchives.push({ archive: archive.archive, original: identity(archive.bytes), repeated: identity(repeated) });
		}
		await missing(independent); await missing(project);
		report.cliVerificationExecution = await capture(process.execPath, [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"], directory, copiedCleanEnvironment);
		await checkpoint(); succeeded(report.cliVerificationExecution);
		report.cliVerification = JSON.parse(report.cliVerificationExecution.stdout);
		assert.equal(report.cliVerification.status, "ok"); assert.equal(report.cliVerification.result.verificationType, "local-package-set");
		await missing(author); await missing(handoff);
		report.removedBeforeInstallation = { project, output, independent, author, handoff };
		report.stage = "installed"; await checkpoint();
		t.diagnostic(`${mode}/${variant}: saved original archives at ${savedHandoff}; source-free installed matrix`);
		await executeInstalled({ context, archives, perls, packages, source, report, checkpoint, diagnostic: value => t.diagnostic(value) });
		assert.equal(report.observations.length, 8);
		report.stage = "complete"; await checkpoint();
		await saveLakeFile(reportRoot, `${mode}-${variant}-package.json`, canonicalJson(report));
	} catch(error)
	{
		report.failure = { message: error.message, stack: error.stack }; await checkpoint(); throw error;
	}
});
