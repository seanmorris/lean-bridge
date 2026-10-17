/**
 * Exact checked-refinement diagnostics through recursive WIT graph packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compileCopiedWitGraphPackageModel, witGraphPackageReadme } from "../src/backends/wit/copied-graph-package.mjs";
import { renderWitGraphHostSource } from "../src/backends/wit/copied-graph-host.mjs";
import { witConversionPrelude } from "../src/backends/wit/copied-conversions.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import "./helpers/wit-graph-diagnostic-source-history-tests.mjs";
import { mutualCheckedRecordReview } from "./helpers/mutual-checked-record-fixture.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { recursiveCheckedRecordReview } from "./helpers/recursive-checked-record-fixture.mjs";

const component = Buffer.from("stand-in component bytes");
const fixed = '  if (status) { failure = wasmtime_error_new("Native Lean graph call failed"); goto done; }';
const checked = /^ {2}if \(status\) \{\n {4}\/\* The adapter resets[^]*?\n {2}\}$/gmu;

test("WIT graph diagnostics are explicit and leave other packages byte-identical", () => {
	for(const ir of [nativeRecursiveReviewedIr(), mutualCheckedRecordReview(), recursiveCheckedRecordReview()])
	{
		const before = structuredClone(ir), off = compileCopiedWitGraphPackageModel(ir, {});
		const explicit = compileCopiedWitGraphPackageModel(ir, {}, { refinementDiagnostics: false });
		assert.deepEqual(ir, before);
		assert.deepEqual(explicit.manifest, off.manifest);
		assert.equal(renderWitGraphHostSource(explicit, component), renderWitGraphHostSource(off, component));
		assert.equal(witGraphPackageReadme(explicit, "2.36"), witGraphPackageReadme(off, "2.36"));
		const host = renderWitGraphHostSource(off, component);
		assert.doesNotMatch(host + JSON.stringify(off.manifest) + witGraphPackageReadme(off, "2.36"), /_graph_error|refinementDiagnostics|refinement diagnostic/u);
		assert.equal(host.split(fixed).length - 1, off.layout.roots.length);
	}
	for(const value of [0, 1, "true", null])
		assert.throws(() => compileCopiedWitGraphPackageModel(mutualCheckedRecordReview(), {}, { refinementDiagnostics: value }), /must be explicit/u);
});

test("WIT graph diagnostics keep the public interface and route every native call once", () => {
	for(const ir of [mutualCheckedRecordReview(), recursiveCheckedRecordReview()])
	{
		const off = compileCopiedWitGraphPackageModel(ir, {}), on = compileCopiedWitGraphPackageModel(ir, {}, { refinementDiagnostics: true });
		// The wire interface, component text and C header are the same package surface.
		for(const key of ["wit", "wat", "hostHeader", "layoutSha256", "prefix"]) assert.equal(on[key], off[key], key);
		assert.deepEqual({ ...on.manifest, graph: { ...on.manifest.graph, refinementDiagnostics: undefined } }
			, { ...off.manifest, graph: { ...off.manifest.graph, refinementDiagnostics: undefined } });
		assert.equal(on.manifest.graph.refinementDiagnostics, true); assert.equal(off.manifest.graph.refinementDiagnostics, undefined);
		const host = renderWitGraphHostSource(on, component), blocks = host.match(checked);
		assert.equal(blocks.length, on.layout.roots.length); assert.ok(!host.includes(fixed));
		for(const block of blocks)
			assert.equal(block.split(`${on.prefix}_graph_error()`).length, 2, "one diagnostic read per failed call");
		assert.equal(host.replace(checked, fixed), renderWitGraphHostSource(off, component));
		const readme = witGraphPackageReadme(on, "2.36");
		assert.match(readme, /final cause is the exact Lean diagnostic/u);
		assert.equal(readme.replace(/A rejected checked refinement returns[^\n]*\n\n/u, ""), witGraphPackageReadme(off, "2.36"));
	}
});

test("WIT graph diagnostics read once, only for invalid input, and retire on malformed text", async () => {
	const on = compileCopiedWitGraphPackageModel(mutualCheckedRecordReview(), {}, { refinementDiagnostics: true });
	const block = renderWitGraphHostSource(on, component).match(checked)[0];
	const helper = name => {
		const start = witConversionPrelude.indexOf(`static inline bool ${name}(`);
		assert.ok(start >= 0, name);
		return witConversionPrelude.slice(start, witConversionPrelude.indexOf("\n}\n", start) + 3);
	};
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-graph-diagnostics-"));
	try
	{
		// Stand-ins model the adapter's one-shot text, runtime retirement and Wasmtime error text.
		await saveLakeFile(root, "probe.c", `#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
typedef struct { char message[96]; } wasmtime_error_t;
static wasmtime_error_t errors[16]; static int used, reads, retired;
static const char *staged;
static wasmtime_error_t *wasmtime_error_new(const char *text) { snprintf(errors[used].message, sizeof(errors[used].message), "%s", text); return &errors[used++]; }
static const char *${on.prefix}_graph_error(void) { ++reads; const char *text = staged; staged = NULL; return text; }
static void lean_bridge_native_runtime_retire(void) { ++retired; }
${helper("lb_buffer")}${helper("lb_utf8")}
static wasmtime_error_t *run(uint32_t status, const char *text) {
  staged = text;
  wasmtime_error_t *failure = NULL;
${block}
done:
  staged = NULL; return failure;
}
static int shown;
static void show(uint32_t status, const char *text) {
  int before = retired; wasmtime_error_t *failure = run(status, text);
  printf("%s[\\"%s\\",%d]", shown++ ? "," : "", failure ? failure->message : "", retired - before);
}
int main(void) {
  printf("[");
  show(0, "stale"); show(1, "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne");
  show(1, NULL); show(1, "\\xc3\\xa9"); show(1, "\\xff"); show(1, "");
  show(2, "stale"); show(3, "stale"); show(5, "stale");
  printf("],%d\\n", reads); return 0;
}
`);
		await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-Wall", "-Wextra", "-Werror", "-Wno-unused-function", "probe.c", "-o", "probe"], root, { PATH: "/usr/bin:/bin" });
		const run = await runCopied(join(root, "probe"), [], root, { PATH: "/usr/bin:/bin" });
		assert.equal(run.stderr, "");
		const [outcomes, reads] = JSON.parse(`[${run.stdout.trim()}]`);
		assert.deepEqual(outcomes, [
			["", 0]
			, ["arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne", 0]
			, ["Native Lean graph call failed", 0]
			, ["é", 0]
			, ["Malformed native refinement diagnostic; runtime retired", 1]
			, ["Malformed native refinement diagnostic; runtime retired", 1]
			, ["Native Lean graph call failed", 0]
			, ["Native Lean graph call failed", 0]
			, ["Native Lean graph call failed", 0]
		]);
		// Only the five status-1 failures consult the adapter.
		assert.equal(reads, 5);
	}
	finally
	{
		await rm(root, { recursive: true });
	}
});

test("native WIT evidence selects graph diagnostics with the shared adapter rule", async () => {
	const evidence = await readFile("src/build/native-wit-artifacts.mjs", "utf8");
	assert.match(evidence, /compileCopiedWitGraphPackageModel\(model\.bindingIr, settings\n\t+, \{ refinementDiagnostics: nativeGraphRefinementDiagnostics\(model\) \}\)/u);
	assert.match(evidence, /model\.copiedGraph\.callbacks \? compileCallableWitGraphPackageModel\(model\.bindingIr, settings\)/u);
	for(const ir of [mutualCheckedRecordReview(), recursiveCheckedRecordReview()])
		assert.ok(ir.declarations.some(item => item.source.extensions["lean-lang.org/refinements"].parameters.some(Boolean)));
});
