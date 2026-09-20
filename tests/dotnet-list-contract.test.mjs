/**
 * .NET List identity, typed arrays and bounded copied conversions.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { generateDotnetBindingPackage } from "../src/backends/dotnet/generate.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { listReviewedIr, listSignatures } from "./helpers/list-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";

test(".NET List evidence binds both installed archives to signatures, cleanup probes and runtime-only execution", async () => {
	const evidence = JSON.parse(await readFile("docs/evidence/dotnet-lists-20260920.json"));
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(evidence.signatures), sort(listSignatures));
	assert.deepEqual(evidence.runs.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of evidence.runs)
	{
		assert.equal(run.profile, "dotnet"); assert.equal(run.checks, 99180);
		assert.deepEqual(sort(run.signatures), sort(listSignatures));
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/list-consumers/dotnet.cs")));
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true); assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].target, "nuget");
		assert.equal(run.packages[0].artifacts.length, 1); assert.match(run.packages[0].artifacts[0].path, /\.nupkg$/);
		assert.match(run.packages[0].artifacts[0].sha256, /^[a-f0-9]{64}$/);
		const { faults, installed } = run;
		assert.equal(faults.checks, 214); assert.equal(faults.layoutChecks, 9); assert.equal(faults.partialInputChecks, 16);
		assert.equal(faults.isolatedInstrumentedProjection, true); assert.equal(faults.releaseAssemblyUnchanged, true);
		assert.equal(faults.probeSourceSha256, sha256(await readFile("tests/fixtures/list-consumers/dotnet-faults.cs")));
		for(const field of ["apiSourceSha256", "runtimeSourceSha256", "instrumentedRuntimeSha256"]) assert.match(faults[field], /^[a-f0-9]{64}$/);
		assert.deepEqual(faults.replacements, [156, 1, 1, 1, 27, 27]);
		assert.equal(installed.sourceFree, true); assert.equal(installed.onlyPreparedDependency, true);
		assert.equal(installed.sourceFreeChecks, run.checks); assert.equal(installed.sourceFreeExecutions, 2);
		assert.equal(installed.assemblySha256, installed.deployment["LeanBridge.Lists.dll"].sha256);
		assert.equal(installed.rejected.length, 12); assert.equal(new Set(installed.rejected.map(item => item.name)).size, 12);
		const codes = { "scalar-result": "CS0029", "wrong-record-field": "CS0029", "fixed-overflow": "CS0031", "platform-overflow": "CS1021" };
		for(const rejected of installed.rejected)
		{ assert.deepEqual(rejected.codes, [codes[rejected.name] ?? "CS1503"]); assert.match(rejected.sourceSha256, /^[a-f0-9]{64}$/); }
	}
});

test(".NET Lists use typed owned arrays with separate List/Array contract and native identities", () => {
	const ir = listReviewedIr(), model = compileCopiedDotnetModel(ir), files = generateCopiedDotnetPackage(ir);
	assert.equal(model.surface.functions.length, 27);
	assert.deepEqual(files, generateCopiedDotnetPackage(structuredClone(ir)));
	assert.deepEqual(files, generateDotnetBindingPackage(ir));
	auditManagedBindingPackage(ir, files, "dotnet");
	const source = files["src/LeanBridge.Lists/Api.cs"], native = files["src/LeanBridge.Lists/Runtime.cs"];
	assert.match(source, /uint\[\] ReverseUint32\(uint\[\]/);
	assert.match(source, /uint\[\]\[\] Mix\(uint\[\]\[\]/);
	assert.match(source, /Option<Result<\(global::System.Numerics.BigInteger, Unit\), string>>\[\] Branches/);
	assert.doesNotMatch(source, /unsafe|DllImport|IntPtr|nint/);
	assert.match(native, /value\.Length > \(nuint\)\(\(16 \* 1024 \* 1024\) \/ Math.Max/);
	assert.match(native, /value.Data == 0 \|\| \(nuint\)value.Data % 4 != 0/);
	assert.match(native, /finally \{ Native.Clear\d+\(ref output\); \}/);
	const word = { kind: "primitive", name: "uint32" };
	const list = model.surface.copy({ kind: "apply", constructor: "list", arguments: [word] });
	const array = model.surface.copy({ kind: "apply", constructor: "array", arguments: [word] });
	assert.notEqual(list.name, array.name); assert.notEqual(model.nativeType(list), model.nativeType(array));
	assert.equal(model.publicType(list), model.publicType(array));
	assert.match(files["README.md"], /Lean List inputs, results and record fields use typed C# arrays/);
});

test(".NET Lists reject borrowed identities, compound callbacks and record name collisions", () => {
	for(const position of ["parameter", "result"])
	{
		const ir = callableReviewedIr(), callback = ir.types.find(type => type.kind === "callback");
		const list = { kind: "apply", constructor: "list", arguments: [{ kind: "primitive", name: "uint32" }] };
		if(position === "parameter") callback.callable.parameters[0].type = list;
		else callback.callable.result.type = list;
		assert.throws(() => compileCopiedDotnetModel(ir), /callbacks currently require copied primitive/);
	}
	const borrowed = listReviewedIr(); borrowed.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => compileCopiedDotnetModel(borrowed), /copy ownership/);
	const collision = listReviewedIr(); collision.types[0].name = "Option";
	assert.throws(() => compileCopiedDotnetModel(collision), /record name collides/);
});

test(".NET List output guards use scalar and compound alignment before allocation", () => {
	const ir = listReviewedIr(), model = compileCopiedDotnetModel(ir);
	const native = generateCopiedDotnetPackage(ir)["src/LeanBridge.Lists/Runtime.cs"];
	const alignments = {
		unit: 1, bool: 1, uint8: 1, int8: 1, uint16: 2, int16: 2
		, uint32: 4, int32: 4, float32: 4, char: 4
		, uint64: 8, int64: 8, float64: 8, nat: 8, int: 8, string: 8, bytes: 8
	};
	for(const [name, alignment] of Object.entries(alignments))
	{
		const fn = model.surface.functions.find(fn => fn.field === `reverse_${name}`), copy = model.surface.copy(fn.declaration.result.type);
		const body = native.split(` From${copy.index}(`)[1].split("\n    }")[0];
		assert.ok(body.indexOf("value.Length >") < body.indexOf("AllocateUninitializedArray"));
		assert.ok(body.includes(`value.Data % ${alignment} != 0`), name);
	}
	const pairs = model.surface.copies.find(copy => copy.element?.compound === "tuple");
	const body = native.split(` From${pairs.index}(`)[1].split("\n    }")[0];
	assert.ok(body.includes("value.Data % 4 != 0"), "a Bool/Char product has alignment four, not its eight-byte size");
});
