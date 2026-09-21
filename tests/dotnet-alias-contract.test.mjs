/**
 * Preserve Lean alias identities without inventing CLR wrapper identities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { generateDotnetBindingPackage } from "../src/backends/dotnet/generate.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { aliasPrimitives, nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";

const managedTypes = {
	AUnit: "Unit", ABool: "bool", AU8: "byte", AU16: "ushort"
	, AU32: "uint", AU64: "ulong"
	, AI8: "sbyte", AI16: "short", AI32: "int", AI64: "long"
	, ANat: "global::System.Numerics.BigInteger"
	, AInt: "global::System.Numerics.BigInteger"
	, AF32: "float", AF64: "double", AText: "string", ABytes: "byte[]"
	, AChar: "global::System.Text.Rune", AWord: "ulong", ASignedWord: "long"
	, Count: "uint", OtherCount: "uint", Rows: "uint[][]"
	, Maybe: "Option<Option<Unit>>", Outcome: "Result<(uint, byte[]), string>"
	, ScalarsView: "Scalars", PacketView: "Packet", Packets: "Packet[]"
};

test(".NET alias evidence binds installed contracts, cleanup, compiler rejection and SDK-free deployments", async () => {
	const record = JSON.parse(await readFile("docs/evidence/dotnet-aliases-20260921.json"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(nativeAliasReviewedIr())));
	assert.deepEqual(record.signatures, nativeAliasSignatures); assert.deepEqual(record.primitives, aliasPrimitives);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.runs.map(run => `${run.path}/${run.profile}`), ["ordinary-source/dotnet", "reviewed-ir/dotnet"]);
	for(const run of record.runs)
	{
		assert.equal(run.checks, 3876);
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/alias-consumers/dotnet.cs")));
		for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(run[flag], true);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
		const { faults, installed } = run;
		assert.equal(faults.checks, 180); assert.equal(faults.malformedChecks, 17); assert.equal(faults.partialInputChecks, 64);
		assert.equal(faults.isolatedInstrumentedProjection, true); assert.equal(faults.releaseAssemblyUnchanged, true);
		assert.deepEqual(faults.replacements, [56, 1, 1, 1, 31, 13]);
		assert.equal(faults.probeSourceSha256, sha256(await readFile("tests/fixtures/alias-consumers/dotnet-faults.cs")));
		for(const field of ["apiSourceSha256", "runtimeSourceSha256", "instrumentedRuntimeSha256"]) assert.match(faults[field], /^[a-f0-9]{64}$/);
		assert.notEqual(faults.runtimeSourceSha256, faults.instrumentedRuntimeSha256);
		assert.equal(installed.onlyPreparedDependency, true); assert.equal(installed.sourceFree, true);
		assert.equal(installed.sourceFreeExecutions, 2); assert.equal(installed.sourceFreeChecks, run.checks);
		assert.equal(installed.assemblySha256, installed.deployment["LeanBridge.Aliases.dll"].sha256);
		for(const field of ["compilerSha256", "assemblySha256", "packageReceiptSha256", "manifestSha256", "xmlSha256"]) assert.match(installed[field], /^[a-f0-9]{64}$/);
		const sort = values => [...values].sort((a, b) => a.id.localeCompare(b.id));
		assert.deepEqual(sort(installed.aliases), sort(nativeAliasReviewedIr().types.filter(type => type.kind === "alias").map(({ id, name, target }) => ({ id, name, target, managedType: managedTypes[name] }))));
		const negatives = JSON.parse(await readFile("tests/fixtures/alias-consumers/dotnet-invalid.json"));
		assert.equal(installed.rejectionSourceSha256, sha256(await readFile("tests/fixtures/alias-consumers/dotnet-invalid.json")));
		assert.equal(installed.rejected.length, 12);
		assert.deepEqual(installed.rejected, negatives.map(({ name, statement, code }) => ({ name, codes: [code], sourceSha256: sha256(`using LeanBridge.Aliases; static class Invalid { static void Test() { ${statement} } }`) })));
		assert.equal(run.packages.length, 1); const [pkg] = run.packages;
		assert.equal(pkg.target, "nuget"); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.artifacts[0].path, "archives/Lean.Aliases.1.0.0.nupkg");
		assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
		const native = Object.entries(installed.deployment).filter(([path]) => path.startsWith("runtimes/"));
		assert.equal(native.length, 4);
		for(const [, file] of native)
		{ assert.ok(file.bytes > 0); assert.match(file.sha256, /^[a-f0-9]{64}$/); }
	}
	const libraries = run => Object.fromEntries(Object.entries(run.installed.deployment).filter(([path]) => path.startsWith("runtimes/")));
	assert.deepEqual(libraries(record.runs[0]), libraries(record.runs[1]));
});

test(".NET alias installed evidence promotes exactly six copied positions and runs in CI", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const observed = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("dotnet-aliases-installed"));
	assert.equal(observed.length, 6);
	for(const cell of observed)
	{
		assert.equal(cell.shape, "alias"); assert.equal(cell.profile, "dotnet");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["dotnet-aliases-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_DOTNET_ALIAS_TEST=1 node --test tests\/dotnet-aliases.test.mjs/);
	assert.match(workflow, /test -s build\/aliases\/dotnet.json/);
	assert.match(workflow, /path: \|[^]*?build\/aliases\/dotnet.json/);
});

test(".NET alias manifests preserve all names, exact targets and transparent managed types", () => {
	const ir = nativeAliasReviewedIr(), files = generateCopiedDotnetPackage(ir);
	assert.deepEqual(files, generateCopiedDotnetPackage(structuredClone(ir)));
	assert.deepEqual(files, generateDotnetBindingPackage(ir));
	auditManagedBindingPackage(ir, files, "dotnet");
	const aliases = JSON.parse(files["binding-manifest.json"]).aliases;
	assert.deepEqual(aliases, ir.types.filter(type => type.kind === "alias").map(({ id, name, target }) => ({ id, name, target, managedType: managedTypes[name] })));
	assert.equal(aliases.length, 27);
	const source = files["src/LeanBridge.Aliases/Api.cs"];
	assert.match(source, /uint Increment\(uint @value0\)/);
	assert.match(source, /void EchoUnit\(Unit @value0\)/);
	assert.match(source, /global::System.Numerics.BigInteger EchoNat\(global::System.Numerics.BigInteger @value0\)/);
	assert.match(source, /Option<Option<Unit>> EchoMaybe\(Option<Option<Unit>> @value0\)/);
	assert.match(source, /uint\[\]\[\] ReverseRows\(uint\[\]\[\] @value0\)/);
	assert.match(source, /sealed record Packet\(uint Count, string Text, uint\[\]\[\] Rows/);
	assert.doesNotMatch(source, /(?:using|class|struct|record) (?:Count|ANat|Rows|PacketView)\b/);
	assert.match(files["README.md"], /C# using aliases are local to source files/);
});

test(".NET XML API documentation retains alias chains, sites and escaped container targets", () => {
	const files = generateCopiedDotnetPackage(nativeAliasReviewedIr());
	const source = files["src/LeanBridge.Aliases/Api.cs"];
	assert.match(source, /<term><c>Count<\/c><\/term><description><c>AU32<\/c>/);
	assert.match(source, /array&lt;list&lt;Count&gt;&gt;/);
	assert.match(source, /Result&lt;\(uint, byte\[\]\), string&gt;/);
	assert.match(source, /<param name="value0">Contract type: <c>ANat<\/c>\.<\/param>/);
	assert.match(source, /<returns>Contract type: <c>OtherCount<\/c>\.<\/returns>/);
	assert.match(source, /<param name="Count">Contract type: <c>Count<\/c>\.<\/param>/);
	for(const name of Object.keys(managedTypes)) assert.ok(source.includes(`<term><c>${name}</c></term>`), name);
});

test(".NET alias catalog entries do not become generated CLR names", () => {
	const ir = nativeAliasReviewedIr(); ir.types.find(type => type.name === "Count").name = "Api";
	const files = generateCopiedDotnetPackage(ir), source = files["src/LeanBridge.Aliases/Api.cs"];
	assert.equal(JSON.parse(files["binding-manifest.json"]).aliases.find(type => type.name === "Api").managedType, "uint");
	assert.equal([...source.matchAll(/public static class Api/g)].length, 1);
	assert.doesNotMatch(source, /using Api =|(?:record|struct) Api/);
	assert.match(source, /uint Increment\(uint @value0\)/);
});

test("alias-free .NET projections omit alias catalogs and alias-only documentation", () => {
	for(const ir of [callableReviewedIr(), listReviewedIr()])
	{
		const files = generateCopiedDotnetPackage(ir);
		assert.equal(Object.hasOwn(JSON.parse(files["binding-manifest.json"]), "aliases"), false);
		assert.doesNotMatch(files["README.md"], /Copied Lean aliases/);
	}
});
