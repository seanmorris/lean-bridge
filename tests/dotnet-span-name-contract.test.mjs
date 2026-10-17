/**
 * Public copied records named Span coexist with the qualified BCL span type.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";

test("C# public records may use Span after runtime spans are qualified", () => {
	const ir = collectionReviewedIr();
	ir.types.find(type => type.name === "Pair").name = "Span";
	const files = generateCopiedDotnetPackage(ir);
	const api = files["src/LeanBridge.Collections/Api.cs"];
	const runtime = files["src/LeanBridge.Collections/Runtime.cs"];
	assert.match(api, /public sealed record Span\(uint First, string Second\)/u);
	assert.match(api, /Span Pair/u);
	assert.match(runtime, /global::System\.Span<byte>/u);
	assert.doesNotMatch(runtime, /(?<![.:])\bSpan<byte>/u);
});
