/**
 * Compile an independent input-API probe against the actual deployed managed assembly.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nominalSubtypeDotnetBuildFlags, nominalSubtypeDotnetEmptyFeeds, nominalSubtypeDotnetEnvironment, verifyNominalSubtypeDotnetTools } from "./nominal-subtype-dotnet-tools.mjs";

export const nominalSubtypeDotnetInputNames = Object.freeze([
	"First", "Second", "Combine", "Nested"
	, "Echo", "EventFirst", "EventSecond"
	, "Aliases", "InspectAliasPair", "EchoGroups"
	, "EchoPair", "EchoEvent", "PlainFin"
]);
export const nominalSubtypeDotnetApiProbe = `using LeanBridge.Nominalsubtypes;
namespace NominalProbe;
public static class Probe
{
${nominalSubtypeDotnetInputNames.map((name, index) => `    public const string Method${index} = nameof(Api.${name});`).join("\n")}
    public static Pair? InputValue => null;
}
`;

/**
 * Reject a failed full build or incomplete/unrelated result-only diagnostic set.
 *
 * @param record - Original process result and compiler-produced SARIF.
 * @param mode - Required API selection.
 */
export const checkNominalSubtypeDotnetProbe = (record, mode) => {
	assert.ok(["full", "result-only"].includes(mode));
	assert.equal(record.restore.code, 0); assert.equal(record.restore.stderr, "");
	assert.equal(record.build.stderr, "");
	assert.equal(record.diagnostics.version, "2.1.0");
	assert.equal(record.diagnostics.runs.length, 1);
	const results = record.diagnostics.runs[0].results;
	if(mode === "full")
	{
		assert.equal(record.build.code, 0); assert.deepEqual(results, []);
		assert.deepEqual(Object.keys(record.outputs), ["Probe.dll"]);
		const output = record.outputs["Probe.dll"];
		assert.deepEqual(Object.keys(output).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(output.bytes) && output.bytes > 0);
		assert.match(output.sha256, /^[a-f0-9]{64}$/u);
		return;
	}
	assert.equal(record.build.code, 1); assert.deepEqual(record.outputs, {});
	assert.equal(results.length, nominalSubtypeDotnetInputNames.length + 1, record.build.stdout);
	const names = [];
	for(const result of results)
	{
		assert.equal(result.level, "error");
		const message = result.message.text ?? result.message;
		if(result.ruleId === "CS0117")
		{
			const match = /^'Api' does not contain a definition for '([A-Za-z]+)'$/u.exec(message);
			assert.ok(match, message); names.push(match[1]);
		}
		else
		{
			assert.equal(result.ruleId, "CS0246");
			assert.equal(message, "The type or namespace name 'Pair' could not be found (are you missing a using directive or an assembly reference?)");
			names.push("Pair");
		}
		const name = names.at(-1), expression = name === "Pair" ? "Pair? InputValue" : `nameof(Api.${name})`;
		const line = nominalSubtypeDotnetApiProbe.split("\n").findIndex(source => source.includes(expression)) + 1;
		assert.ok(line > 0); assert.equal(result.locations.length, 1);
		const location = result.locations[0].physicalLocation;
		assert.equal(location.artifactLocation.uri, pathToFileURL(join(record.cwd, "probe.cs")).href);
		assert.equal(location.region.startLine, line); assert.equal(location.region.endLine, line);
	}
	assert.deepEqual(names.sort(), [...nominalSubtypeDotnetInputNames, "Pair"].sort());
};

/**
 * Keep the consumer's closed installation untouched and retain original probe records.
 *
 * @param options - Exact assembly and original tool selection.
 * @param options.root - Fresh isolated probe directory.
 * @param options.assembly - Original verified deployed assembly bytes.
 * @param options.tools - Actual selected SDK/host record.
 * @param options.mode - Required API selection.
 * @param options.output - Fresh retained-record directory.
 */
export const runNominalSubtypeDotnetProbe = async ({ root, assembly, tools, mode, output }) => {
	await assert.rejects(access(root), { code: "ENOENT" }); await mkdir(root, { recursive: true });
	await verifyNominalSubtypeDotnetTools(tools);
	const project = '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><OutputType>Library</OutputType><Nullable>enable</Nullable><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultItems>false</EnableDefaultItems><EnableDefaultCompileItems>false</EnableDefaultCompileItems><EnableNETAnalyzers>false</EnableNETAnalyzers><ErrorLog>errors.sarif,version=2.1</ErrorLog></PropertyGroup><ItemGroup><Compile Include="probe.cs"/><Reference Include="LeanBridge.Nominalsubtypes"><HintPath>library/LeanBridge.Nominalsubtypes.dll</HintPath><Private>false</Private></Reference></ItemGroup></Project>';
	const inputs = { "Probe.csproj": project
		, "probe.cs": nominalSubtypeDotnetApiProbe
		, "NuGet.Config": nominalSubtypeDotnetEmptyFeeds
		, "global.json": canonicalJson({ sdk: { version: tools.sdk.version, rollForward: "disable", allowPrerelease: false } })
		, "library/LeanBridge.Nominalsubtypes.dll": assembly };
	for(const [path, bytes] of Object.entries(inputs)) await saveLakeFile(root, path, bytes);
	const environment = nominalSubtypeDotnetEnvironment(root, tools.command), commands = [];
	const run = async args => {
		const result = await captureCorpusCompiler(tools.command, args, root, environment);
		commands.push({ command: tools.command, args, cwd: root, run: result }); return result;
	};
	const restore = await run(["restore", "--configfile", "NuGet.Config", ...nominalSubtypeDotnetBuildFlags]);
	assert.equal(restore.code, 0, restore.stdout + restore.stderr);
	const build = await run(["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out", ...nominalSubtypeDotnetBuildFlags]);
	const diagnosticsBytes = await readFile(join(root, "errors.sarif")), outputs = {};
	if(mode === "full")
	{
		const bytes = await readFile(join(root, "out/Probe.dll")); outputs["Probe.dll"] = { bytes: bytes.length, sha256: sha256(bytes) };
		await saveLakeFile(output, "api-probe/out/Probe.dll", bytes);
	}
	else await assert.rejects(access(join(root, "out/Probe.dll")), { code: "ENOENT" });
	const record = { cwd: root, restore, build, diagnostics: JSON.parse(diagnosticsBytes), outputs };
	await saveLakeFile(output, "api-probe/processes.json", canonicalJson({ commands, environment }));
	await saveLakeFile(output, "api-probe/errors.sarif", diagnosticsBytes);
	await saveLakeFile(output, "api-probe/record.json", canonicalJson(record));
	for(const [path, bytes] of Object.entries(inputs))
	{
		assert.deepEqual(await readFile(join(root, path)), Buffer.from(bytes));
		await saveLakeFile(output, `api-probe/inputs/${path}`, bytes);
	}
	await verifyNominalSubtypeDotnetTools(tools); checkNominalSubtypeDotnetProbe(record, mode);
	return { ...record, assemblySha256: sha256(assembly) };
};
