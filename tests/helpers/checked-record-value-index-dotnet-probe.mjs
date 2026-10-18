/**
 * Compile an independent API probe against the deployed value-index assembly.
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
import {
	nominalSubtypeDotnetBuildFlags
	, nominalSubtypeDotnetEmptyFeeds
	, nominalSubtypeDotnetEnvironment
	, verifyNominalSubtypeDotnetTools
} from "./nominal-subtype-dotnet-tools.mjs";
import {
	checkedRecordValueIndexDotnetAssembly
} from "./checked-record-value-index-dotnet-package.mjs";

export const checkedRecordValueIndexDotnetInputNames = Object.freeze([
	"TrueBoolIndex", "FalseBoolIndex", "AbStringIndex", "EmptyStringIndex"
	, "UnicodeStringIndex", "EmptySizedIndex", "ZeroNatIndex", "WideNatIndex"
]);
export const checkedRecordValueIndexDotnetResultNames = Object.freeze([
	"ProduceTrueBool", "ProduceFalseBool", "ProduceAb", "ProduceEmptyString"
	, "ProduceUnicodeString", "ProduceEmptySized", "ProduceZeroNat"
	, "ProduceWideNat"
]);
export const checkedRecordValueIndexDotnetApiProbe = `using LeanBridge.Checkedrecordvalueindices;
namespace CheckedRecordValueIndexProbe;
public static class Probe
{
${checkedRecordValueIndexDotnetInputNames.map((name, index) => `    public const string Method${index} = nameof(Api.${name});`).join("\n")}
${checkedRecordValueIndexDotnetResultNames.map((name, index) => `    public const string Result${index} = nameof(Api.${name});`).join("\n")}
    public static On? OnValue => null;
    public static Off? OffValue => null;
    public static Ab? AbValue => null;
    public static EmptyToken? EmptyTokenValue => null;
    public static UnicodeToken? UnicodeTokenValue => null;
    public static EmptySized? EmptySizedValue => null;
    public static ZeroToken? ZeroTokenValue => null;
    public static WideToken? WideTokenValue => null;
}
`;

/**
 * Reject a failed full build or incomplete result-only diagnostics.
 *
 * @param record - Original compiler processes and SARIF diagnostics.
 * @param mode - Required full or result-only API mode.
 */
export const checkCheckedRecordValueIndexDotnetProbe = (record, mode) => {
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
	const expected = [...checkedRecordValueIndexDotnetInputNames];
	assert.equal(results.length, expected.length, record.build.stdout);
	const names = [];
	for(const result of results)
	{
		assert.equal(result.level, "error");
		const message = result.message.text ?? result.message;
		let name, expression;
		if(result.ruleId === "CS0117")
		{
			const match = /^'Api' does not contain a definition for '([A-Za-z]+)'$/u
				.exec(message);
			assert.ok(match, message); name = match[1]; expression = `nameof(Api.${name})`;
		}
		else assert.fail(`Unexpected C# diagnostic ${result.ruleId}: ${message}`);
		names.push(name);
		const line = checkedRecordValueIndexDotnetApiProbe.split("\n")
			.findIndex(source => source.includes(expression)) + 1;
		assert.ok(line > 0); assert.equal(result.locations.length, 1);
		const location = result.locations[0].physicalLocation;
		assert.equal(
			location.artifactLocation.uri
			, pathToFileURL(join(record.cwd, "probe.cs")).href
		);
		assert.equal(location.region.startLine, line);
		assert.equal(location.region.endLine, line);
	}
	assert.deepEqual(names.sort(), expected.sort());
};

/**
 * Keep the closed installation untouched and retain original probe records.
 *
 * @param root0 - Isolated compiler-probe inputs.
 * @param root0.root - Fresh isolated probe directory.
 * @param root0.assembly - Original deployed managed assembly bytes.
 * @param root0.tools - Selected .NET host and SDK.
 * @param root0.mode - Required full or result-only API mode.
 * @param root0.output - Fresh retained-record directory.
 */
export const runCheckedRecordValueIndexDotnetProbe = async ({
	root, assembly, tools, mode, output
}) => {
	await assert.rejects(access(root), { code: "ENOENT" });
	await mkdir(root, { recursive: true });
	await verifyNominalSubtypeDotnetTools(tools);
	const project = `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><OutputType>Library</OutputType><Nullable>enable</Nullable><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultItems>false</EnableDefaultItems><EnableDefaultCompileItems>false</EnableDefaultCompileItems><EnableNETAnalyzers>false</EnableNETAnalyzers><ErrorLog>errors.sarif,version=2.1</ErrorLog></PropertyGroup><ItemGroup><Compile Include="probe.cs"/><Reference Include="${checkedRecordValueIndexDotnetAssembly}"><HintPath>library/${checkedRecordValueIndexDotnetAssembly}.dll</HintPath><Private>false</Private></Reference></ItemGroup></Project>`;
	const inputs = {
		"Probe.csproj": project
		, "probe.cs": checkedRecordValueIndexDotnetApiProbe
		, "NuGet.Config": nominalSubtypeDotnetEmptyFeeds
		, "global.json": canonicalJson({
			sdk: {
				version: tools.sdk.version, rollForward: "disable", allowPrerelease: false
			}
		})
		, [`library/${checkedRecordValueIndexDotnetAssembly}.dll`]: assembly
	};
	for(const [path, bytes] of Object.entries(inputs))
		await saveLakeFile(root, path, bytes);
	const environment = nominalSubtypeDotnetEnvironment(root, tools.command);
	const commands = [];
	const run = async args => {
		const result = await captureCorpusCompiler(
			tools.command, args, root, environment
		);
		commands.push({ command: tools.command, args, cwd: root, run: result });
		return result;
	};
	const restore = await run([
		"restore", "--configfile", "NuGet.Config", ...nominalSubtypeDotnetBuildFlags
	]);
	assert.equal(restore.code, 0, restore.stdout + restore.stderr);
	const build = await run([
		"build", "--no-restore", "--disable-build-servers"
		, "-p:UseSharedCompilation=false", "-o", "out"
		, ...nominalSubtypeDotnetBuildFlags
	]);
	const diagnosticsBytes = await readFile(join(root, "errors.sarif"));
	const outputs = {};
	if(mode === "full")
	{
		const bytes = await readFile(join(root, "out/Probe.dll"));
		outputs["Probe.dll"] = { bytes: bytes.length, sha256: sha256(bytes) };
		await saveLakeFile(output, "api-probe/out/Probe.dll", bytes);
	}
	else await assert.rejects(access(join(root, "out/Probe.dll")), { code: "ENOENT" });
	const record = {
		cwd: root, restore, build, diagnostics: JSON.parse(diagnosticsBytes), outputs
	};
	await saveLakeFile(output, "api-probe/processes.json", canonicalJson({
		commands, environment
	}));
	await saveLakeFile(output, "api-probe/errors.sarif", diagnosticsBytes);
	await saveLakeFile(output, "api-probe/record.json", canonicalJson(record));
	for(const [path, bytes] of Object.entries(inputs))
	{
		assert.deepEqual(await readFile(join(root, path)), Buffer.from(bytes));
		await saveLakeFile(output, `api-probe/inputs/${path}`, bytes);
	}
	await verifyNominalSubtypeDotnetTools(tools);
	checkCheckedRecordValueIndexDotnetProbe(record, mode);
	return { ...record, assemblySha256: sha256(assembly) };
};
