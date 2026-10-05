/**
 * Verify the same owned layouts independently with the C compiler and CLR.
 *
 * @file
 */
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedDotnetLayout } from "../src/backends/dotnet/owned-layout.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("C# owned layouts preserve finite recursion, opaque identities and all scalar widths", () => {
	const ir = ownedCppCompositionReviewedIr(), original = structuredClone(ir);
	const layout = compileOwnedDotnetLayout(ir);
	assert.deepEqual(ir, original);
	// The C model includes freshly allocated host-argument predicate functions.
	assert.deepEqual(JSON.parse(JSON.stringify(compileOwnedDotnetLayout(ir))), JSON.parse(JSON.stringify(layout)));
	assert.equal(layout.types.length, 41);
	const ticket = layout.types.find(node => node.name === "Ticket"), chain = layout.types.find(node => node.name === "Chain");
	assert.equal(ticket.raw, "nint"); assert.equal(ticket.size, 8); assert.equal(ticket.aggregate, false);
	assert.equal(chain.payloadOffset, 8); assert.equal(chain.size, 24);
	assert.ok(chain.cases.find(branch => branch.sourceName === "link").fields[1].pointer);
	assert.ok(layout.types.every(node => node.size > 0 && node.size % node.alignment === 0));
	assert.ok(layout.callbackLayouts.every(node => node.size === 32));
	assert.doesNotMatch(layout.rawSource, /DllImport|NativeLibrary|lean_object|System\.Text\.Json|\bbool\b/u);
	const scalar = compileOwnedDotnetLayout(ownedPythonScalarsReviewedIr());
	assert.equal(scalar.types.filter(node => node.kind === "primitive").length, 19);
	assert.equal(scalar.types.find(node => node.name === "Scalars").fields.length, 19);
});

for(const scalar of [false, true]) for(const reviewed of [false, true]) test(`C and CLR verify owned ${scalar ? "scalar" : "composed"} storage (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		fixture: scalar ? "owned-scalars" : "owned-cpp-composition"
		, hostCallbacks: true, ...scalar ? { witness: "import Owned\n" } : {}
		, ...reviewed ? { reviewedIr: scalar ? ownedPythonScalarsReviewedIr() : ownedCppCompositionReviewedIr() } : {}
	});
	const layout = compileOwnedDotnetLayout(compiled.model.bindingIr), checks = [], managed = [];
	const equal = (expression, expected) => checks.push(`_Static_assert(${expression} == ${expected}, ${JSON.stringify(expression)});`);
	const offset = (raw, field, expected) => managed.push(`Offset<${raw}>("${field}", ${expected});`);
	for(const node of layout.types)
	{
		equal(`sizeof(${node.cName})`, node.size); equal(`_Alignof(${node.cName})`, node.alignment);
		managed.push(`Size<${node.raw}>(${node.size}, ${node.alignment});`);
		if(!node.aggregate) continue;
		if(node.element || node.kind === "primitive")
		{
			equal(`offsetof(${node.cName}, data)`, node.dataOffset); equal(`offsetof(${node.cName}, length)`, node.lengthOffset);
			offset(node.raw, "Data", node.dataOffset); offset(node.raw, "Length", node.lengthOffset);
		}
		if(node.kind === "variant")
		{
			equal(`offsetof(${node.cName}, kind)`, node.kindOffset); equal(`offsetof(${node.cName}, cases)`, node.payloadOffset);
			offset(node.raw, "Kind", node.kindOffset); offset(node.raw, "Cases", node.payloadOffset);
		}
		if(node.kind === "option")
		{ equal(`offsetof(${node.cName}, has_value)`, node.flagOffset); offset(node.raw, "Flag", node.flagOffset); }
		if(node.kind === "result")
		{ equal(`offsetof(${node.cName}, is_ok)`, node.flagOffset); offset(node.raw, "Flag", node.flagOffset); }
		for(const field of node.fields)
		{ equal(`offsetof(${node.cName}, ${field.name})`, field.offset); offset(node.raw, field.rawName, field.offset); }
		for(const branch of node.cases)
		{
			managed.push(`Size<${branch.raw}>(${branch.size}, ${branch.alignment});`);
			offset(`OwnedUnion${node.index}`, branch.rawName, 0);
			for(const field of branch.fields)
			{
				equal(`offsetof(${node.cName}, cases.${branch.name}.${field.name})`, node.payloadOffset + field.offset);
				offset(branch.raw, field.rawName, field.offset);
			}
		}
	}
	for(const node of layout.callbackLayouts)
	{
		equal(`sizeof(${node.name})`, node.size); equal(`_Alignof(${node.name})`, node.alignment);
		managed.push(`Size<${node.raw}>(${node.size}, ${node.alignment});`);
		for(const field of node.fields)
		{ equal(`offsetof(${node.name}, ${field.name})`, field.offset); offset(node.raw, field.rawName, field.offset); }
	}
	for(const [name, raw, at] of [["_mp_alloc", "Allocated", layout.mpz.allocated], ["_mp_size", "Length", layout.mpz.length], ["_mp_d", "Data", layout.mpz.data]])
	{ equal(`offsetof(__mpz_struct, ${name})`, at); offset("OwnedMpz", raw, at); }
	equal("sizeof(__mpz_struct)", layout.mpz.size); equal("_Alignof(__mpz_struct)", layout.mpz.alignment);
	equal("GMP_NAIL_BITS", 0); equal("sizeof(mp_limb_t)", 8); equal(`sizeof(${layout.c.prefix}_status)`, 4);
	managed.push(`Size<OwnedMpz>(${layout.mpz.size}, ${layout.mpz.alignment});`);
	await saveLakeFile(compiled.directory, "owned-dotnet.h", layout.c.header);
	const source = `#include "owned-dotnet.h"\n#include <stddef.h>\n#include <stdio.h>\n${checks.join("\n")}\nint main(void) { puts("${checks.length}"); return 0; }\n`;
	const execute = await compiled.compile("dotnet-layout", source), observed = await execute();
	assert.equal(observed.stderr, ""); assert.equal(Number(observed.stdout.trim()), checks.length);
	const consumer = `using System;
using System.Runtime.InteropServices;
${layout.rawSource}
internal static unsafe class Program
{
    private static int checks;
    [StructLayout(LayoutKind.Sequential)]
    private struct Alignment<T> where T : unmanaged
    {
        internal byte Prefix;
        internal T Value;
        internal Alignment(T value) { Prefix = 0; Value = value; }
    }
    private static void Check(bool value, string message) { if (!value) throw new Exception(message); ++checks; }
    private static void Size<T>(int size, int alignment) where T : unmanaged
    {
        var value = new Alignment<T>(default);
        Check(sizeof(T) == size, typeof(T).Name + " size");
        Check((byte*)&value.Value - (byte*)&value == alignment, typeof(T).Name + " alignment");
    }
    private static void Offset<T>(string field, int offset) where T : unmanaged
    { Check(Marshal.OffsetOf<T>(field).ToInt64() == offset, typeof(T).Name + "." + field); }
    private static void Main()
    {
        ${managed.join("\n        ")}
        Console.WriteLine(checks);
    }
}
`;
	await saveLakeFile(compiled.directory, "Program.cs", consumer);
	await saveLakeFile(compiled.directory, "Layout.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>');
	await saveLakeFile(compiled.directory, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	const dotnet = resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet");
	const env = { PATH: "/usr/bin:/bin", DOTNET_ROOT: dirname(dotnet)
		, DOTNET_CLI_HOME: join(compiled.directory, "home")
		, DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1"
		, NUGET_PACKAGES: join(compiled.directory, "packages") };
	await runCopied(dotnet, ["build", "Layout.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], compiled.directory, env);
	const result = await runCopied(dotnet, ["out/Layout.dll"], compiled.directory, env);
	assert.equal(result.stderr, "");
	const managedChecks = managed.reduce((sum, line) => sum + (line.startsWith("Size<") ? 2 : 1), 0);
	assert.equal(Number(result.stdout.trim()), managedChecks);
	await saveLakeFile(resolve("build/owned-dotnet-layout"), `${scalar ? "scalars-" : ""}${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		checks: checks.length, managedChecks, compiledLayout: true
		, installedPackage: false
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, headerSha256: sha256(layout.c.header)
		, rawSourceSha256: sha256(layout.rawSource)
		, cProbeSha256: sha256(source)
		, managedProbeSha256: sha256(consumer)
		, layouts: layout.types, callbackLayouts: layout.callbackLayouts
		, mpz: layout.mpz
	}));
	t.diagnostic(`${checks.length} C and ${managedChecks} CLR storage assertions passed`);
});
