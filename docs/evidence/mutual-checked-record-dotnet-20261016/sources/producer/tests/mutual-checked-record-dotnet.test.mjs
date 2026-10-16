/**
 * Generated and installed .NET acceptance for mutually recursive checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	compileCopiedDotnetGraphPackageModel, generateCopiedDotnetGraphPackage
} from "../src/backends/dotnet/copied-graph-package.mjs";
import { dotnetConversionIr } from "./helpers/dotnet-graph-probes.mjs";
import {
	mutualCheckedRecordDotnetReview, mutualCheckedRecordDotnetSelection
} from "./helpers/mutual-checked-record-dotnet-fixture.mjs";

test("recursive checked-record C# packages consume only authenticated native diagnostics", () => {
	const ir = mutualCheckedRecordDotnetReview(), before = structuredClone(ir);
	const model = compileCopiedDotnetGraphPackageModel(ir);
	const files = generateCopiedDotnetGraphPackage(ir);
	assert.deepEqual(ir, before); assert.equal(model.refinementDiagnostics, true);
	const calls = files[`src/${model.assembly}/Calls.cs`];
	const runtime = files[`src/${model.assembly}/Runtime.cs`];
	assert.match(calls, /GetExport\(handle, "mutualcheckedrecords_graph_error"\)/u);
	assert.ok(calls.indexOf('GetExport(handle, "mutualcheckedrecords_graph_error")')
		< calls.indexOf('GetExport(handle, "mutualcheckedrecords_graph_initialize")'));
	assert.match(calls, /delegate\* unmanaged\[Cdecl\]<byte\*>\)symbols\[6\]/u);
	assert.match(runtime, /while \(length <= 16 \* 1024 && message\[length\] != 0\)/u);
	assert.match(runtime, /Utf8\.GetString\(new global::System\.ReadOnlySpan<byte>\(message, length\)\)/u);
	assert.match(runtime, /throw new global::System\.ArgumentException\(text\)/u);
	assert.match(runtime, /throw new GraphInvalidNative\("Native refinement diagnostic is not UTF-8", error\)/u);
	assert.ok(JSON.parse(files["binding-manifest.json"]).supportedFeatures
		.includes("checked-refinement-diagnostics"));
});

test("ordinary recursive C# packages do not resolve an unavailable diagnostic export", () => {
	const model = compileCopiedDotnetGraphPackageModel(dotnetConversionIr());
	const files = generateCopiedDotnetGraphPackage(dotnetConversionIr());
	assert.equal(model.refinementDiagnostics, false);
	assert.doesNotMatch(files[`src/${model.assembly}/Calls.cs`], /_graph_error/u);
	assert.ok(!JSON.parse(files["binding-manifest.json"]).supportedFeatures
		.includes("checked-refinement-diagnostics"));
});

test("mutual checked-record C# selections are closed", () => {
	assert.deepEqual(mutualCheckedRecordDotnetSelection({}), {
		enabled: false, routes: ["ordinary", "reviewed"], maxLoad: 12
	});
	assert.throws(() => mutualCheckedRecordDotnetSelection({
		LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_DOTNET_ROUTES: "ordinary"
	}));
	assert.throws(() => mutualCheckedRecordDotnetSelection({
		LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_DOTNET_TEST: "1"
		, LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_DOTNET_ROUTES: "ordinary,ordinary"
	}));
});

import "./helpers/mutual-checked-record-dotnet-installed-tests.mjs";
