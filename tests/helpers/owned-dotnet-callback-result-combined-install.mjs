/**
 * Install the original NuGet peer and relocate it without producer tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { ownedDotnetCallbackInstalledProbe, checkOwnedDotnetCallbackDocumentation
	, rejectOwnedDotnetCallbackConsumers } from "./owned-dotnet-callback-result-installed.mjs";
import { ownedDotnetBorrowProject } from "./owned-dotnet-borrow-installed.mjs";
import { ownedDotnetRuntimeOnly } from "./owned-dotnet-installed.mjs";
import { prepareOwnedDotnetCallbackInstalledProcess, runOwnedDotnetCallbackInstalledProcess } from "./owned-dotnet-callback-result-installed-process.mjs";

/**
 * Build public consumers from the archive, then defer SDK-free relocation.
 *
 * @param options - Original handoff and compiler-authenticated .NET projection.
 */
export const installOwnedDotnetCallbackCombined = async options => {
	const { handoff, receipt, consumer, environment, verified, compiled } = options;
	const packages = receipt.packages.filter(item => item.target === "nuget");
	assert.equal(packages.length, 1);
	const pkg = packages[0], archive = join(handoff, pkg.artifacts[0].path);
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	const root = join(consumer, "dotnet");
	await mkdir(join(root, "feed"), { recursive: true });
	await cp(archive, join(root, "feed", `${pkg.name}.${pkg.version}.nupkg`));
	const source = await ownedDotnetCallbackInstalledProbe(true);
	await saveLakeFile(root, "Program.cs", source);
	await saveLakeFile(root, "Consumer.csproj", ownedDotnetBorrowProject(pkg, "Program.cs"));
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
	const command = environment.LEAN_BRIDGE_DOTNET;
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(command)
		, DOTNET_CLI_HOME: join(root, "home"), NUGET_PACKAGES: join(root, "packages")
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" };
	await runCopied(command, ["restore", "Consumer.csproj", "--configfile", "NuGet.Config"], root, env);
	await runCopied(command, ["build", "Consumer.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
	const installed = join(root, "packages", pkg.name.toLowerCase(), pkg.version);
	const manifest = JSON.parse(await readFile(join(installed, "lean-bridge/package-receipt.json"), "utf8"));
	assert.equal(manifest.schemaVersion, 5);
	assert.equal(manifest.runtimeIdentity, verified.receipt.runtimeIdentity);
	assert.deepEqual(manifest.ownedValues, verified.projection.contract);
	await verifyNativeFiles(installed, Object.fromEntries(Object.entries(manifest.files)
		.filter(([path]) => !["[Content_Types].xml", "_rels/.rels", `${pkg.name}.nuspec`].includes(path))));
	const executed = await runCopied(command, ["out/Consumer.dll"], root, env);
	assert.equal(executed.stderr, "");
	const observation = JSON.parse(executed.stdout);
	assert.deepEqual(observation, { checks: 57, safePublicApi: true });
	const consumerOptions = { consumer: root, pkg, command, env
		, model: verified.projection, hostCallbacks: true };
	const invalidConsumers = await rejectOwnedDotnetCallbackConsumers(consumerOptions);
	const documentation = await checkOwnedDotnetCallbackDocumentation(consumerOptions);
	const installedProcess = await prepareOwnedDotnetCallbackInstalledProcess({ ...consumerOptions, combined: true });
	const report = { manifest, observation, checks: observation.checks
		, consumerSha256: sha256(source), invalidConsumers, documentation
		, installedProcess
		, adapterReceipt: verified.adapter, compiledProjection: compiled
		, sourceFreeInstallation: true, cliRemovedBeforeConsumerInstall: true
		, offlineInstall: true };
	const relocate = async () => {
		await assert.rejects(access(handoff), { code: "ENOENT" });
		for(const name of ["feed", "packages", "obj"])
		{ await rm(join(root, name), { recursive: true }); await assert.rejects(access(join(root, name)), { code: "ENOENT" }); }
		for(const name of ["Program.cs", "Consumer.csproj", "NuGet.Config", "Example.cs", "Example.csproj", "Invalid.cs", "Invalid.csproj", "Process.cs", "Process.csproj", "process-fork.c"])
		{ await rm(join(root, name)); await assert.rejects(access(join(root, name)), { code: "ENOENT" }); }
		await rename(join(root, "out"), join(root, "relocated"));
		await rename(join(root, "examples"), join(root, "relocated-examples"));
		await rename(join(root, "process"), join(root, "relocated-process"));
		const runtime = await ownedDotnetRuntimeOnly(join(root, "runtime-only"), command);
		const moved = await runCopied(runtime.executable, ["relocated/Consumer.dll"], root, runtime.env);
		assert.deepEqual(moved, executed);
		const relocatedProcess = await runOwnedDotnetCallbackInstalledProcess({
			consumer: root, command: runtime.executable, env: runtime.env
			, combined: true, output: "relocated-process" });
		assert.deepEqual(relocatedProcess, installedProcess.observations);
		for(const { name, code, stdout, stderr } of documentation.observed)
			assert.deepEqual(await runCopied(runtime.executable, [`relocated-examples/${name}/Example.dll`], root, runtime.env), { code, stdout, stderr });
		Object.assign(report, { relocatedChecks: observation.checks
			, sourceFreeRelocatedExecution: true, consumerSourceRemoved: true
			, handoffRemovedBeforeRelocatedExecution: true
			, packageCacheRemoved: true, sdkFreeExecution: true
			, relocatedDocumentation: documentation.observed, relocatedProcess });
	};
	return { report, relocate };
};
