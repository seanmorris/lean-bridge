/**
 * Reconcile the original closed NuGet restore and managed deployment records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkedRecordValueIndexDotnetAssembly } from "./checked-record-value-index-dotnet-package.mjs";
import { checkCheckedRecordValueIndexDotnetRestore } from "./checked-record-value-index-dotnet-restore-records.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
export const checkedRecordValueIndexDotnetRestoreFiles = Object.freeze([
	"Consumer.csproj.nuget.dgspec.json", "Consumer.csproj.nuget.g.props"
	, "Consumer.csproj.nuget.g.targets", "project.assets.json"
	, "project.nuget.cache"
]);
export const checkedRecordValueIndexDotnetGeneratedOutputs = Object.freeze([
	"Consumer.deps.json", "Consumer.dll", "Consumer.pdb"
	, "Consumer.runtimeconfig.json"
]);
export const checkedRecordValueIndexDotnetCacheRecords = Object.freeze([
	".nupkg.metadata", "checkedrecordvalueindices.api.1.0.0.nupkg.sha512"
	, "checkedrecordvalueindices.api.nuspec"
]);

/**
 * Match all original input, cache, restore and output identities without filesystem discovery.
 *
 * @param options - Original relative readers and independent package identities.
 * @param options.read - Read original selection-relative bytes.
 * @param options.json - Canonical JSON reader.
 * @param options.nuget - Authenticated NuGet record.
 * @param options.packageReceipt - Authenticated package receipt.
 * @param options.tools - Original measured toolchain.
 * @param options.archiveSha512 - Digest independently computed from the original verified nupkg.
 * @param options.caller - Exact independent caller source.
 */
export const checkCheckedRecordValueIndexDotnetEnvironment = async ({ read, json, nuget, packageReceipt, tools, archiveSha512, caller }) => {
	const context = await json("installation.json");
	assert.deepEqual(Object.keys(context).sort(), ["archiveName", "buildInputs"
		, "cacheFiles", "command", "inputs", "interpreter", "outputs"
		, "packageDirectory", "packageFileSetSha256", "receiptBytes", "root"]);
	assert.equal(typeof context.root, "string");
	assert.ok(posix.isAbsolute(context.root));
	assert.equal(posix.normalize(context.root), context.root);
	assert.equal(posix.basename(context.root), "consumer");
	assert.equal(context.command, tools.command);
	assert.deepEqual(context.interpreter, tools.interpreter);
	assert.equal(context.receiptBytes, canonicalJson(packageReceipt));
	assert.equal(context.archiveName, "Checkedrecordvalueindices.Api.1.0.0.nupkg");
	assert.equal(context.packageDirectory, "checkedrecordvalueindices.api/1.0.0");
	assert.equal(context.packageFileSetSha256, sha256(canonicalJson(Object.keys(nuget.files).sort())));
	const archiveIdentity = { bytes: nuget.archive.bytes, sha256: nuget.archive.sha256 };
	const feed = "feed/" + context.archiveName;
	assert.deepEqual(Object.keys(context.inputs).sort(), ["consumer.cs"
		, "Consumer.csproj", "NuGet.Config", "global.json", feed].sort());
	assert.deepEqual(context.inputs[feed], archiveIdentity);
	const project = '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultItems>false</EnableDefaultItems><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="consumer.cs"/><PackageReference Include="Checkedrecordvalueindices.Api" Version="[1.0.0]"/></ItemGroup></Project>';
	const inputs = { "consumer.cs": caller, "Consumer.csproj": project
		, "NuGet.Config": '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>'
		, "global.json": canonicalJson({ sdk: { version: tools.sdk.version
			, rollForward: "disable", allowPrerelease: false } }) };
	for(const [path, text] of Object.entries(inputs))
	{
		assert.equal((await read(`consumer-environment/${path}`)).toString(), text);
		assert.deepEqual(context.inputs[path], identity(text));
	}
	const cache = {};
	for(const [path, file] of Object.entries(nuget.files))
	{
		if(path === "[Content_Types].xml" || path === "_rels/.rels") continue;
		cache[path === "Checkedrecordvalueindices.Api.nuspec" ? "checkedrecordvalueindices.api.nuspec" : path] = file;
	}
	const archiveName = "checkedrecordvalueindices.api.1.0.0.nupkg";
	cache[archiveName] = archiveIdentity;
	assert.match(archiveSha512, /^[A-Za-z0-9+/]{86}==$/u);
	const metadata = { version: 2, contentHash: archiveSha512
		, source: context.root + "/feed" };
	assert.equal((await read("consumer-environment/cache/.nupkg.metadata")).toString(), JSON.stringify(metadata, null, 2));
	assert.equal((await read(`consumer-environment/cache/${archiveName}.sha512`)).toString(), archiveSha512);
	for(const path of checkedRecordValueIndexDotnetCacheRecords)
	{
		const bytes = await read(`consumer-environment/cache/${path}`);
		if(path.endsWith(".nuspec")) assert.deepEqual(identity(bytes), cache[path]);
		else cache[path] = identity(bytes);
	}
	assert.deepEqual(context.cacheFiles, Object.fromEntries(Object.entries(cache)
		.map(([path, file]) => [`${context.packageDirectory}/${path}`, file])));
	assert.deepEqual(Object.keys(context.buildInputs).sort(), [...checkedRecordValueIndexDotnetRestoreFiles].sort());
	for(const path of checkedRecordValueIndexDotnetRestoreFiles)
		assert.deepEqual(context.buildInputs[path], identity(await read(`consumer-environment/obj/${path}`)));
	const assets = JSON.parse(await read("consumer-environment/obj/project.assets.json"));
	const coordinate = "Checkedrecordvalueindices.Api/1.0.0";
	assert.deepEqual(Object.keys(assets.libraries), [coordinate]);
	assert.equal(assets.libraries[coordinate].type, "package");
	assert.equal(assets.libraries[coordinate].sha512, archiveSha512);
	assert.equal(assets.libraries[coordinate].path, context.packageDirectory);
	assert.deepEqual(Object.keys(assets.packageFolders), [context.root + "/packages"]);
	assert.deepEqual(Object.keys(assets.targets), ["net8.0"]);
	assert.deepEqual(Object.keys(assets.targets["net8.0"]), [coordinate]);
	await checkCheckedRecordValueIndexDotnetRestore({ read, root: context.root
		, sdk: tools.sdk, cacheFiles: cache, archiveSha512
		, nativeFiles: Object.keys(packageReceipt.files)
			.filter(path => path.startsWith("runtimes/linux-x64/native/")) });
	const supplied = {};
	for(const [path, file] of Object.entries(packageReceipt.files))
	{
		if(path.startsWith("lib/net8.0/") && /\.(?:dll|xml)$/u.test(path))
			supplied[path.slice("lib/net8.0/".length)] = file;
		else if(path.startsWith("runtimes/linux-x64/native/")) supplied[path] = file;
	}
	assert.ok(supplied[`${checkedRecordValueIndexDotnetAssembly}.dll`]);
	assert.ok(Object.keys(supplied).some(path => path.endsWith(".so")));
	for(const [path, file] of Object.entries(context.outputs))
	{
		if(Object.hasOwn(supplied, path)) assert.deepEqual(file, supplied[path]);
		else assert.ok(checkedRecordValueIndexDotnetGeneratedOutputs.includes(path), path);
	}
	for(const path of [...checkedRecordValueIndexDotnetGeneratedOutputs
		, ...Object.keys(supplied).filter(path => !path.endsWith(".xml"))])
		assert.ok(context.outputs[path], path);
	for(const path of Object.keys(context.outputs)
		.filter(path => !path.startsWith("runtimes/") && path !== `${checkedRecordValueIndexDotnetAssembly}.dll`))
		assert.deepEqual(context.outputs[path], identity(await read(`consumer-environment/out/${path}`)));
	const dependencies = JSON.parse(await read("consumer-environment/out/Consumer.deps.json"));
	assert.deepEqual(Object.keys(dependencies.libraries).sort()
		, [coordinate, "Consumer/1.0.0"]);
	assert.equal(dependencies.libraries[coordinate].sha512, "sha512-" + archiveSha512);
	assert.equal(dependencies.libraries[coordinate].type, "package");
	const runtime = JSON.parse(await read("consumer-environment/out/Consumer.runtimeconfig.json"));
	assert.deepEqual(Object.keys(runtime), ["runtimeOptions"]);
	assert.equal(runtime.runtimeOptions.tfm, "net8.0");
	assert.deepEqual(runtime.runtimeOptions.framework, { name: "Microsoft.NETCore.App", version: "8.0.0" });
	assert.deepEqual(Object.keys(runtime.runtimeOptions).sort(), ["configProperties", "framework", "tfm"]);
	assert.deepEqual(runtime.runtimeOptions.configProperties, {
		"System.Runtime.Serialization.EnableUnsafeBinaryFormatterSerialization": false
	});
	const allFiles = { ...context.inputs, ...context.cacheFiles
		, ...context.buildInputs, ...context.outputs };
	for(const file of Object.values(allFiles))
	{
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
	}
	const closure = { receiptSha256: sha256(context.receiptBytes)
		, packageFileSetSha256: context.packageFileSetSha256
		, cacheFilesSha256: sha256(canonicalJson(context.cacheFiles))
		, buildInputsSha256: sha256(canonicalJson(context.buildInputs))
		, deployedFilesSha256: sha256(canonicalJson(context.outputs))
		, interpreterSha256: context.interpreter.sha256 };
	assert.deepEqual(nuget.closure, closure);
	return { context, root: context.root, closure };
};
