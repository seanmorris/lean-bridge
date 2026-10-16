/**
 * Require a single offline NuGet dependency graph without executable build imports.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Reconstruct NuGet restore files and the deployed dependency graph independently.
 *
 * @param options - Original relative byte reader and authenticated installation inputs.
 * @param options.read - Selection-relative retained-record reader.
 * @param options.root - Historical consumer directory, used only as a string.
 * @param options.sdk - Actual selected SDK record.
 * @param options.cacheFiles - Authenticated package-relative cache file identities.
 * @param options.archiveSha512 - Digest derived from the verified original nupkg.
 * @param options.nativeFiles - Exact package-relative native library paths.
 */
export const checkNestedCheckedRecordDotnetRestore = async ({ read, root, sdk, cacheFiles, archiveSha512, nativeFiles }) => {
	const json = async path => JSON.parse(await read(`consumer-environment/${path}`));
	const projectPath = root + "/Consumer.csproj";
	const assembly = "lib/net8.0/LeanBridge.Nestedcheckedrecords.dll";
	const coordinate = "Nestedcheckedrecords.Api/1.0.0";
	const restore = { projectUniqueName: projectPath, projectName: "Consumer"
		, projectPath, packagesPath: root + "/packages", outputPath: root + "/obj/"
		, projectStyle: "PackageReference", configFilePaths: [root + "/NuGet.Config"]
		, originalTargetFrameworks: ["net8.0"], sources: { [root + "/feed"]: {} }
		, frameworks: { "net8.0": { targetAlias: "net8.0", projectReferences: {} } }
		, warningProperties: { allWarningsAsErrors: true, warnAsError: ["NU1605"] }
		, restoreAuditProperties: { enableAudit: "false", auditLevel: "low", auditMode: "direct" } };
	const project = { version: "1.0.0", restore
		, frameworks: { "net8.0": { targetAlias: "net8.0"
			, dependencies: { "Nestedcheckedrecords.Api": { target: "Package", version: "[1.0.0, 1.0.0]" } }
			, imports: ["net461", "net462", "net47", "net471", "net472", "net48", "net481"]
			, assetTargetFallback: true, warn: true
			, frameworkReferences: { "Microsoft.NETCore.App": { privateAssets: "all" } }
			, runtimeIdentifierGraphPath: `${sdk.directory}/${sdk.version}/PortableRuntimeIdentifierGraph.json` } } };
	assert.deepEqual(await json("obj/Consumer.csproj.nuget.dgspec.json"), {
		format: 1, restore: { [projectPath]: {} }
		, projects: { [projectPath]: project }
	});
	const runtimeTargets = Object.fromEntries(nativeFiles.map(path => [path, { assetType: "native", rid: "linux-x64" }]));
	assert.deepEqual(await json("obj/project.assets.json"), {
		version: 3
		, targets: { "net8.0": { [coordinate]: { type: "package"
			, compile: { [assembly]: { related: ".xml" } }
			, runtime: { [assembly]: { related: ".xml" } }, runtimeTargets } } }
		, libraries: { [coordinate]: { sha512: archiveSha512, type: "package"
			, path: "nestedcheckedrecords.api/1.0.0"
			, files: Object.keys(cacheFiles).filter(path => !path.endsWith(".nupkg")).sort() } }
		, projectFileDependencyGroups: { "net8.0": ["Nestedcheckedrecords.Api >= 1.0.0 <= 1.0.0"] }
		, packageFolders: { [root + "/packages"]: {} }, project
	});
	const cache = await json("obj/project.nuget.cache");
	assert.match(cache.dgSpecHash, /^[A-Za-z0-9+/]{11}=$/u);
	assert.deepEqual(cache, { version: 2, dgSpecHash: cache.dgSpecHash
		, success: true
		, projectFilePath: projectPath
		, expectedPackageFiles: [root + "/packages/nestedcheckedrecords.api/1.0.0/nestedcheckedrecords.api.1.0.0.nupkg.sha512"]
		, logs: [] });
	const header = '\uFEFF<?xml version="1.0" encoding="utf-8" standalone="no"?>\n';
	const projectXml = '<Project ToolsVersion="14.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003"';
	assert.equal((await read("consumer-environment/obj/Consumer.csproj.nuget.g.targets")).toString(), header + projectXml + " />");
	const props = (await read("consumer-environment/obj/Consumer.csproj.nuget.g.props")).toString();
	const version = /<NuGetToolVersion [^>]+>([0-9]+\.[0-9]+\.[0-9]+)<\/NuGetToolVersion>/u.exec(props)?.[1];
	assert.equal(typeof version, "string");
	const values = { RestoreSuccess: "True", RestoreTool: "NuGet"
		, ProjectAssetsFile: "$(MSBuildThisFileDirectory)project.assets.json"
		, NuGetPackageRoot: root + "/packages"
		, NuGetPackageFolders: root + "/packages"
		, NuGetProjectStyle: "PackageReference", NuGetToolVersion: version };
	const condition = " '$(ExcludeRestorePackageImports)' != 'true' ";
	const properties = Object.entries(values).map(([name, value]) =>
		`    <${name} Condition=" '$(${name})' == '' ">${value}</${name}>\n`).join("");
	assert.equal(props, header + projectXml + ">\n"
		+ `  <PropertyGroup Condition="${condition}">\n${properties}  </PropertyGroup>\n`
		+ `  <ItemGroup Condition="${condition}">\n`
		+ `    <SourceRoot Include="${root}/packages/" />\n  </ItemGroup>\n</Project>`);
	const deployedNative = Object.fromEntries(nativeFiles.map(path => [path, {
		rid: "linux-x64", assetType: "native", fileVersion: "0.0.0.0"
	}]));
	assert.deepEqual(await json("out/Consumer.deps.json"), {
		runtimeTarget: { name: ".NETCoreApp,Version=v8.0", signature: "" }
		, compilationOptions: {}
		, targets: { ".NETCoreApp,Version=v8.0": {
			"Consumer/1.0.0": { dependencies: { "Nestedcheckedrecords.Api": "1.0.0" }
				, runtime: { "Consumer.dll": {} } }
			, [coordinate]: { runtime: { [assembly]: { assemblyVersion: "1.0.0.0", fileVersion: "1.0.0.0" } }
				, runtimeTargets: deployedNative } } }
		, libraries: { "Consumer/1.0.0": { type: "project", serviceable: false, sha512: "" }
			, [coordinate]: { type: "package", serviceable: true
				, sha512: "sha512-" + archiveSha512
				, path: "nestedcheckedrecords.api/1.0.0"
				, hashPath: "nestedcheckedrecords.api.1.0.0.nupkg.sha512" } }
	});
};
