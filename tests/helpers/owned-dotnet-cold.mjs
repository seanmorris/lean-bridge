/**
 * Reproduce a generated loader's first use after an installed peer forks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { verifiedDotnetAssets } from "../../src/backends/dotnet/verified-assets.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Describe the offline probe's exact package references and compile inputs.
 *
 * @param packages - Installed peer package coordinates.
 * @param assembly - Fixed or counterfactual probe assembly name.
 */
export const ownedDotnetColdProject = (packages, assembly) => `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><AssemblyName>${assembly}</AssemblyName><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="ColdProgram.cs"/><Compile Include="ColdAssets.cs"/>${packages.map(item => `<PackageReference Include="${item.name}" Version="[${item.version}]"/>`).join("")}</ItemGroup></Project>`;

/**
 * Compile cold-loader probes against the same installed NuGet peer set.
 *
 * @param options - Offline consumer and SDK environment, before removal.
 * @param options.consumer - Existing consumer with a local feed.
 * @param options.packages - Installed peer package coordinates.
 * @param options.command - Absolute SDK executable.
 * @param options.env - Isolated SDK environment.
 */
export const prepareOwnedDotnetCold = async ({ consumer, packages, command, env }) => {
	const pkg = packages.find(item => item.name === "owned-peer"); assert.ok(pkg);
	const compiledBytes = await readFile(join(consumer, "packages", pkg.name, pkg.version, "lean-bridge/native-dotnet.json"));
	const compiled = JSON.parse(compiledBytes), members = verifiedDotnetAssets(compiled.evidence);
	const source = await readFile("tests/fixtures/structured-types/owned-dotnet-cold.cs", "utf8");
	const native = await readFile("tests/fixtures/structured-types/owned-dotnet-cold.c", "utf8");
	await saveLakeFile(consumer, "ColdProgram.cs", source);
	await saveLakeFile(consumer, "cold-fork.c", native);
	await runCopied("/usr/bin/cc", ["-shared", "-fPIC", "-std=c11", "-Wall", "-Wextra", "-Werror", "cold-fork.c", "-o", "out/cold-fork.so"], consumer, { PATH: "/usr/bin:/bin" });
	const currentProcess = "global::System.AppDomain.CurrentDomain.GetData(ProcessKey) is int original ? original : CurrentProcess()";
	assert.equal(members.split(currentProcess).length, 2);
	const variants = [];
	for(const counterfactual of [false, true])
	{
		const assembly = counterfactual ? "ColdCounter" : "ColdGuard";
		const loader = counterfactual ? members.replace(currentProcess, "CurrentProcess()") : members;
		const generated = `internal static class ColdAssets\n{\n    static ColdAssets() { ColdState.Initialized = true; }\n${loader}}\n`;
		await saveLakeFile(consumer, "ColdAssets.cs", generated);
		const project = ownedDotnetColdProject(packages, assembly);
		const projectFile = `${assembly}.csproj`;
		await saveLakeFile(consumer, projectFile, project);
		await runCopied(command, ["restore", projectFile, "--configfile", "NuGet.Config"], consumer, env);
		await runCopied(command, ["build", projectFile, "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], consumer, env);
		const files = {};
		for(const extension of ["dll", "deps.json", "runtimeconfig.json"])
		{
			const filename = `${assembly}.${extension}`, bytes = await readFile(join(consumer, "out", filename));
			files[filename] = { bytes: bytes.length, sha256: sha256(bytes) };
		}
		variants.push({ assembly, counterfactual
			, loaderSha256: sha256(generated), projectSha256: sha256(project)
			, assemblySha256: files[`${assembly}.dll`].sha256, files });
	}
	for(const variant of variants) for(const [filename, recorded] of Object.entries(variant.files))
	{
		const bytes = await readFile(join(consumer, "out", filename));
		assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, recorded);
	}
	return { compiled, compiledSha256: sha256(compiledBytes)
		, evidence: compiled.evidence
		, membersSha256: sha256(members), sourceSha256: sha256(source)
		, nativeSha256: sha256(native), variants };
};

/**
 * Test the guard before our inherited registry lock, under default protections.
 *
 * @param options - SDK-free relocated deployment and prepared probe identities.
 * @param options.directory - Relocated directory with no source or package cache.
 * @param options.runtime - Runtime-only executable and clean environment.
 * @param options.prepared - Identities returned by prepareOwnedDotnetCold.
 */
export const checkOwnedDotnetCold = async ({ directory, runtime, prepared }) => {
	const observations = [];
	for(const origin of ["owned", "copied", "plain"]) for(const counterfactual of [false, true])
	{
		const assembly = counterfactual ? "ColdCounter" : "ColdGuard", kind = counterfactual ? 1 : 0;
		const args = [`${assembly}.dll`, origin, String(kind)];
		const result = await processBuildRunner.capture({
			command: runtime.executable, args
			, cwd: directory, env: runtime.env, timeoutMs: 20000 })
			.catch(error => { error.message += ": " + JSON.stringify(error.details); throw error; });
		assert.equal(result.code, 0);
		assert.equal(result.stderr, "");
		const lines = result.stdout.trim().split("\n"); assert.equal(lines.length, 2);
		const preflight = JSON.parse(lines[0]), observed = JSON.parse(lines[1]);
		assert.deepEqual(observed, { childExit: counterfactual ? 1 : 0 });
		assert.deepEqual(preflight, { origin, kind, installedOrigin: true
			, coldInParent: true, registryLockHeld: true, defaultClrProtections: true });
		observations.push({ ...preflight, counterfactual, childExit: observed.childExit, exitCode: result.code });
	}
	return { ...prepared, observations };
};
