/**
 * Close original NuGet inputs, generated build inputs and the actual deployed application.
 * The explicitly selected .NET SDK and shared framework remain trusted toolchains.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { readClosedPackageZip } from "./closed-package-zip.mjs";
import { verifyFinContainerEdgeFileClosure } from "./fin-container-edge-closure.mjs";

const receiptPath = "lean-bridge/package-receipt.json";
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const immutable = files => Object.freeze(Object.fromEntries(Object.entries(files).map(([path, value]) => [path, Object.freeze(value)])));
const restoredNames = ["Consumer.csproj.nuget.dgspec.json", "Consumer.csproj.nuget.g.props", "Consumer.csproj.nuget.g.targets", "project.assets.json", "project.nuget.cache"];
const buildFlags = ["-noAutoResponse", "-p:ImportDirectoryBuildProps=false", "-p:ImportDirectoryBuildTargets=false", "-p:ImportDirectoryPackagesProps=false", "-p:MSBuildEnableWorkloadResolver=false"];
const environment = (root, command) => ({ ...copiedCleanEnvironment
	, DOTNET_ROOT: dirname(command), DOTNET_CLI_HOME: join(root, "dotnet-home")
	, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1"
	, DOTNET_MULTILEVEL_LOOKUP: "0", NUGET_PACKAGES: join(root, "packages")
	, NUGET_HTTP_CACHE_PATH: join(root, "http-cache") });
const verifyFiles = async (root, files, exact = false) => {
	assert.equal(await realpath(root), resolve(root), ".NET directory must not traverse a symlink");
	if(exact) assert.deepEqual(await nativeArtifactPaths(root), Object.keys(files).sort(), "unrecorded or missing .NET file");
	for(const [path, expected] of Object.entries(files))
	{
		assert.ok((await lstat(join(root, path))).isFile(), `regular .NET input: ${path}`);
		assert.equal(await realpath(join(root, path)), join(resolve(root), path), `.NET input must not traverse a symlink: ${path}`);
		assert.deepEqual(identity(await readFile(join(root, path))), expected, `.NET file drift: ${path}`);
	}
};

/**
 * Read the complete archive and derive the cache layout before NuGet sees any input.
 * NuGet omits OPC metadata and lowercases the nuspec filename in its package cache.
 *
 * @param bytes - Original deterministic NuGet archive.
 * @param archiveSha256 - Package-set artifact digest.
 */
export const inspectFinContainerEdgeDotnetArchive = (bytes, archiveSha256) => {
	assert.match(archiveSha256, /^[a-f0-9]{64}$/u);
	assert.equal(sha256(bytes), archiveSha256, "original .NET archive drift");
	const members = readClosedPackageZip(bytes), receiptBytes = members.get(receiptPath)?.toString("utf8");
	assert.equal(typeof receiptBytes, "string", ".NET receipt missing");
	const receipt = JSON.parse(receiptBytes);
	assert.equal(canonicalJson(receipt), receiptBytes); assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.kind, "lean-bridge-ordinary-nuget-package"); assert.equal(receipt.ecosystem, "nuget");
	assert.match(receipt.name, /^[A-Za-z][A-Za-z0-9_.-]*$/u);
	assert.match(receipt.version, /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u);
	assert.match(receipt.assembly, /^[A-Za-z][A-Za-z0-9_.]*$/u);
	assert.deepEqual([...members.keys()].sort(), [...Object.keys(receipt.files), receiptPath].sort(), "unrecorded or missing .NET archive file");
	assert.equal(new Set([...members.keys()].map(path => path.toLowerCase())).size, members.size, "case-colliding NuGet paths");
	for(const [path, entry] of Object.entries(receipt.files)) assert.deepEqual(identity(members.get(path)), entry, `.NET archive member drift: ${path}`);
	for(const path of members.keys())
		assert.ok(!/^(?:build|buildTransitive|buildMultiTargeting|analyzers|tools|content|contentFiles)\//iu.test(path), "unexpected NuGet executable discovery input");
	const nuspec = members.get(`${receipt.name}.nuspec`)?.toString("utf8");
	assert.equal(typeof nuspec, "string");
	assert.ok(nuspec.includes(`<id>${receipt.name}</id>`) && nuspec.includes(`<version>${receipt.version}</version>`));
	assert.doesNotMatch(nuspec, /<!DOCTYPE|<!ENTITY|<dependency\b|<references\b|<frameworkAssemblies\b/iu);
	assert.ok(members.has(`lib/net8.0/${receipt.assembly}.dll`));
	const cacheFiles = {};
	for(const [path, data] of members)
	{
		if(path === "[Content_Types].xml" || path === "_rels/.rels") continue;
		const target = path === `${receipt.name}.nuspec` ? `${receipt.name.toLowerCase()}.nuspec` : path;
		cacheFiles[target] = identity(data);
	}
	return { members, receipt, receiptBytes, cacheFiles, packageFileSetSha256: sha256(canonicalJson([...members.keys()].sort())) };
};

const verifyInputs = async context => {
	const { root, command, inputs, cacheFiles, packageDirectory, buildInputs } = context;
	assert.equal(await realpath(command), command, ".NET host target drift");
	assert.deepEqual(identity(await readFile(command)), context.interpreter, ".NET host drift");
	await verifyFiles(root, inputs);
	assert.deepEqual(await nativeArtifactPaths(join(root, "feed")), [context.archiveName]);
	await verifyFiles(join(root, "packages"), cacheFiles, true);
	const closure = await verifyFinContainerEdgeFileClosure({ installed: join(root, "inspection"), receiptPath, receiptBytes: context.receiptBytes });
	assert.equal(closure.packageFileSetSha256, context.packageFileSetSha256);
	assert.deepEqual(await readFile(join(root, "packages", packageDirectory, receiptPath)), Buffer.from(context.receiptBytes));
	if(buildInputs)
	{
		await verifyFiles(join(root, "obj"), buildInputs);
		const imports = (await readdir(join(root, "obj"))).filter(path => /\.(?:props|targets)$/u.test(path)).sort();
		assert.deepEqual(imports, restoredNames.filter(path => /\.(?:props|targets)$/u.test(path)), "unrecorded NuGet build import");
	}
	return closure;
};

/**
 * Verify original package/cache inputs and every deployed file without starting .NET.
 *
 * @param context - Archive-derived inputs and outputs of a checked host compilation.
 */
export const verifyFinContainerEdgeDotnetEnvironment = async context => {
	const closure = await verifyInputs(context);
	assert.ok(context.outputs?.["Consumer.dll"], "compiled .NET consumer required");
	await verifyFiles(join(context.root, "out"), context.outputs, true);
	return { ...closure, cacheFilesSha256: sha256(canonicalJson(context.cacheFiles))
		, buildInputsSha256: sha256(canonicalJson(context.buildInputs))
		, deployedFilesSha256: sha256(canonicalJson(context.outputs))
		, interpreterSha256: context.interpreter.sha256 };
};

/**
 * Run the fixed application with no inherited startup hooks or additional dependency paths.
 *
 * @param context - Current root and authenticated installation identities.
 */
export const runFinContainerEdgeDotnet = async context => {
	await verifyFinContainerEdgeDotnetEnvironment(context);
	try
	{
		return await runCopied(context.command, ["out/Consumer.dll"], context.root, environment(context.root, context.command));
	}
	finally
	{
		await verifyFinContainerEdgeDotnetEnvironment(context);
	}
};

/**
 * Restore a closed package, check NuGet outputs before build, and pin the deployed application.
 *
 * @param options - Fresh consumer root and original package-set archive.
 * @param options.root - Directory containing only consumer.cs.
 * @param options.archive - Original verified archive path.
 * @param options.archiveSha256 - Package-set digest.
 * @param options.command - Explicit trusted .NET host.
 */
export const installFinContainerEdgeDotnet = async ({ root, archive, archiveSha256, command: selected }) => {
	assert.equal(await realpath(root), resolve(root));
	assert.deepEqual(await nativeArtifactPaths(root), ["consumer.cs"], "fresh .NET consumer directory required");
	const bytes = await readFile(archive), original = inspectFinContainerEdgeDotnetArchive(bytes, archiveSha256);
	const { receipt } = original, command = await realpath(selected), env = environment(root, command);
	const interpreter = identity(await readFile(command));
	const listed = await runCopied(command, ["--list-sdks"], root, env);
	const sdks = [...listed.stdout.matchAll(/^(8\.0\.[0-9]+) \[([^\r\n]+)\]$/gmu)];
	assert.equal(sdks.length, 1, "select exactly one installed .NET 8 SDK");
	assert.equal(await realpath(sdks[0][2]), join(dirname(command), "sdk"));
	const archiveName = `${receipt.name}.${receipt.version}.nupkg`, packageDirectory = `${receipt.name.toLowerCase()}/${receipt.version}`;
	const project = `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultItems>false</EnableDefaultItems><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="consumer.cs"/><PackageReference Include="${receipt.name}" Version="[${receipt.version}]"/></ItemGroup></Project>`;
	const contents = {
		"consumer.cs": await readFile(join(root, "consumer.cs"))
		, "Consumer.csproj": project
		, "NuGet.Config": '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>'
		, "global.json": canonicalJson({ sdk: { version: sdks[0][1], rollForward: "disable", allowPrerelease: false } })
		, [`feed/${archiveName}`]: bytes };
	for(const [path, data] of Object.entries(contents))
	{
		if(path === "consumer.cs") continue;
		await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), data, { flag: "wx" });
	}
	for(const [path, data] of original.members)
	{
		await mkdir(dirname(join(root, "inspection", path)), { recursive: true });
		await writeFile(join(root, "inspection", path), data, { flag: "wx" });
	}
	const contentHash = createHash("sha512").update(bytes).digest("base64"), cachedArchive = `${receipt.name.toLowerCase()}.${receipt.version}.nupkg`;
	const packageFiles = { ...original.cacheFiles
		, [cachedArchive]: identity(bytes)
		, [`${cachedArchive}.sha512`]: identity(contentHash)
		, ".nupkg.metadata": identity(JSON.stringify({ version: 2, contentHash, source: join(root, "feed") }, null, 2)) };
	const context = { root, command, interpreter, packageDirectory, archiveName
		, receiptBytes: original.receiptBytes
		, packageFileSetSha256: original.packageFileSetSha256
		, inputs: immutable(Object.fromEntries(Object.entries(contents).map(([path, data]) => [path, identity(data)])))
		, cacheFiles: immutable(Object.fromEntries(Object.entries(packageFiles).map(([path, entry]) => [`${packageDirectory}/${path}`, entry]))) };
	await verifyFiles(root, context.inputs);
	await runCopied(command, ["restore", "--configfile", "NuGet.Config", ...buildFlags], root, env);
	await verifyInputs(context);
	assert.deepEqual(await nativeArtifactPaths(join(root, "obj")), restoredNames, "unexpected generated NuGet input");
	context.buildInputs = immutable(Object.fromEntries(await Promise.all(restoredNames.map(async path => [path, identity(await readFile(join(root, "obj", path)))]))));
	const assets = JSON.parse(await readFile(join(root, "obj/project.assets.json")));
	assert.deepEqual(Object.keys(assets.libraries), [`${receipt.name}/${receipt.version}`]);
	assert.deepEqual(Object.keys(assets.packageFolders), [join(root, "packages")]);
	await verifyInputs(context);
	await runCopied(command, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out", ...buildFlags], root, env);
	await verifyInputs(context);
	assert.equal(sha256(await readFile(archive)), archiveSha256, ".NET archive changed during installation");
	const supplied = {};
	for(const [path, entry] of Object.entries(receipt.files))
	{
		if(path.startsWith("lib/net8.0/") && /\.(?:dll|xml)$/u.test(path)) supplied[path.slice("lib/net8.0/".length)] = entry;
		else if(path.startsWith("runtimes/linux-x64/native/")) supplied[path] = entry;
	}
	const generated = ["Consumer.deps.json", "Consumer.dll", "Consumer.pdb", "Consumer.runtimeconfig.json"], outputs = {};
	for(const path of await nativeArtifactPaths(join(root, "out")))
	{
		const actual = identity(await readFile(join(root, "out", path)));
		if(Object.hasOwn(supplied, path)) assert.deepEqual(actual, supplied[path], `deployed NuGet asset drift: ${path}`);
		else assert.ok(generated.includes(path), `unrecorded deployed .NET file: ${path}`);
		outputs[path] = actual;
	}
	for(const path of [...generated, ...Object.keys(supplied).filter(path => !path.endsWith(".xml"))]) assert.ok(Object.hasOwn(outputs, path), `missing deployed .NET file: ${path}`);
	context.outputs = immutable(outputs); Object.freeze(context);
	await verifyFinContainerEdgeDotnetEnvironment(context);
	return { context, run: () => runFinContainerEdgeDotnet(context) };
};
