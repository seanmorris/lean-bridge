/**
 * Bind typed API diagnostics to the original assembly and isolated compiler invocation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkedRecordValueIndexDotnetApiProbe, checkCheckedRecordValueIndexDotnetProbe } from "./checked-record-value-index-dotnet-probe.mjs";
import { nominalSubtypeDotnetBuildFlags, nominalSubtypeDotnetEmptyFeeds, nominalSubtypeDotnetEnvironment } from "./nominal-subtype-dotnet-tools.mjs";
import { checkedRecordValueIndexDotnetAssembly } from "./checked-record-value-index-dotnet-package.mjs";

/**
 * Check actual managed compilation, complete diagnostics and all original inputs.
 *
 * @param options - Original records and independently verified package identity.
 * @param options.read - Selection-relative original reader.
 * @param options.json - Canonical JSON reader.
 * @param options.mode - Full or result-only API.
 * @param options.root - Original consumer root, not a directory to reopen.
 * @param options.tools - Authenticated selected host and SDK.
 * @param options.assembly - Original managed assembly file identity.
 * @param options.report - Original top-level API probe summary.
 */
export const checkCheckedRecordValueIndexDotnetProbeRecords = async ({ read, json, mode, root, tools, assembly, report }) => {
	const record = await json("api-probe/record.json");
	assert.deepEqual(Object.keys(record).sort(), ["build", "cwd", "diagnostics", "outputs", "restore"]);
	assert.equal(record.cwd, posix.join(posix.dirname(root), "api-probe"));
	const project = '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><OutputType>Library</OutputType><Nullable>enable</Nullable><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultItems>false</EnableDefaultItems><EnableDefaultCompileItems>false</EnableDefaultCompileItems><EnableNETAnalyzers>false</EnableNETAnalyzers><ErrorLog>errors.sarif,version=2.1</ErrorLog></PropertyGroup><ItemGroup><Compile Include="probe.cs"/><Reference Include="LeanBridge.Checkedrecordvalueindices"><HintPath>library/LeanBridge.Checkedrecordvalueindices.dll</HintPath><Private>false</Private></Reference></ItemGroup></Project>';
	const inputs = { "Probe.csproj": project
		, "probe.cs": checkedRecordValueIndexDotnetApiProbe
		, "NuGet.Config": nominalSubtypeDotnetEmptyFeeds
		, "global.json": canonicalJson({ sdk: { version: tools.sdk.version
			, rollForward: "disable", allowPrerelease: false } }) };
	for(const [path, source] of Object.entries(inputs))
		assert.equal((await read(`api-probe/inputs/${path}`)).toString(), source);
	const bytes = await read(`api-probe/inputs/library/${checkedRecordValueIndexDotnetAssembly}.dll`);
	assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, assembly);
	assert.deepEqual(report, { ...record, assemblySha256: assembly.sha256 });
	assert.deepEqual(JSON.parse(await read("api-probe/errors.sarif")), record.diagnostics);
	const processes = await json("api-probe/processes.json");
	assert.deepEqual(Object.keys(processes).sort(), ["commands", "environment"]);
	assert.deepEqual(processes.environment, nominalSubtypeDotnetEnvironment(record.cwd, tools.command));
	const commands = [["restore", "--configfile", "NuGet.Config", ...nominalSubtypeDotnetBuildFlags]
		, ["build", "--no-restore", "--disable-build-servers"
			, "-p:UseSharedCompilation=false", "-o", "out"
			, ...nominalSubtypeDotnetBuildFlags]];
	assert.equal(processes.commands.length, 2);
	for(const [index, args] of commands.entries())
	{
		const run = index ? record.build : record.restore;
		assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);
		assert.equal(typeof run.stdout, "string"); assert.ok(run.stdout.length > 0);
		assert.deepEqual(processes.commands[index], {
			command: tools.command, args, cwd: record.cwd, run
		});
	}
	checkCheckedRecordValueIndexDotnetProbe(record, mode);
	if(mode === "full")
	{
		const output = await read("api-probe/out/Probe.dll");
		assert.deepEqual(record.outputs["Probe.dll"], { bytes: output.length, sha256: sha256(output) });
	}
	return record;
};
