/**
 * Compile the WIT caller and exercise its independent value and diagnostic controls.
 * These source-only tests do not claim installed Lean execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader } from "../../src/backends/wit/copied-host.mjs";
import { structuralSubtypeConfiguration, structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypeWitConfiguration, structuralSubtypeWitCaller, structuralSubtypeWitCounts, parseStructuralSubtypeWitResult } from "./structural-subtype-wit-fixture.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("structural WIT configurations retain independent author contracts and complete callers", async () => {
	for(const route of ["ordinary", "reviewed"])
	{
		const configured = structuralSubtypeWitConfiguration(route), common = structuralSubtypeConfiguration(route, ["c"]);
		assert.deepEqual({ ...configured, targets: common.targets }, common);
		assert.deepEqual(configured.targets, { "wit-wasi": { name: "structuralsubtypes", version: "1.0.0" } });
	}
	assert.equal(await structuralSubtypeWitCaller("reviewed"), (await structuralSubtypeWitCaller("ordinary")).replaceAll(/arg([01])/gu, "value$1"));
	assert.throws(() => structuralSubtypeWitConfiguration("unknown"));
	await assert.rejects(structuralSubtypeWitCaller("unknown"));
	assert.deepEqual(parseStructuralSubtypeWitResult(JSON.stringify(structuralSubtypeWitCounts)), structuralSubtypeWitCounts);
	for(const key of Object.keys(structuralSubtypeWitCounts))
		assert.throws(() => parseStructuralSubtypeWitResult(JSON.stringify({ ...structuralSubtypeWitCounts, [key]: 0 })));
});

test("structural WIT callers compile and detect full-tree mutation and inexact error causes", { skip: process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_WIT_CALLER_TEST !== "1" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-wit-controls-"));
	t.after(() => rm(root, { recursive: true }));
	const wasmtime = resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? ".toolchains/wasmtime42");
	await saveLakeFile(root, "structuralsubtypes_wasmtime.h", renderWitHostHeader(compileCopiedWitModel(structuralSubtypeReview())));
	const flags = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-I.", `-I${join(wasmtime, "include")}`];
	for(const route of ["ordinary", "reviewed"])
	{
		await saveLakeFile(root, `${route}.c`, await structuralSubtypeWitCaller(route));
		const compiled = await runCopied("/usr/bin/cc", [...flags, "-fsyntax-only", `${route}.c`], root);
		assert.equal(compiled.stderr, ""); assert.equal(compiled.stdout, "");
	}
	await saveLakeFile(root, "wit-values.h", await readFile("tests/fixtures/structural-subtype-consumers/wit-values.h"));
	await saveLakeFile(root, "controls.c", String.raw`#include "wit-values.h"
#include <stdio.h>
int main(void) {
  (void)small; (void)wide;
  unsigned snapshots = snapshot_controls(); if (snapshots != 12) return 1;
  const char *cause = "arg0 was rejected by StructuralSubtypes.checkedPositive";
  const char *good[] = {cause, "error while executing at wasm backtrace:\n    0: 0x7a - <unknown>!<wasm function 0>\n\nCaused by:\n    arg0 was rejected by StructuralSubtypes.checkedPositive", "error while executing at wasm backtrace:\n    0: 0x8fa - forward!<wasm function 23>\n\nCaused by:\n    arg0 was rejected by StructuralSubtypes.checkedPositive\n"};
  const char *bad[] = {
    "prefix arg0 was rejected by StructuralSubtypes.checkedPositive",
    "arg0 was rejected by StructuralSubtypes.checkedPositive suffix",
    "arg0 was rejected by StructuralSubtypes.checkedPositive\n",
    "arg1 was rejected by StructuralSubtypes.checkedPositive",
    "error while executing at wasm backtrace:\n    0: frame\n\nCaused by:\n    arg0 was rejected by StructuralSubtypes.checkedPositive suffix",
    "some other error\n\nCaused by:\n    arg0 was rejected by StructuralSubtypes.checkedPositive",
    "error while executing at wasm backtrace:\n    0: frame\n\nCaused by:\n    first cause\n\nCaused by:\n    arg0 was rejected by StructuralSubtypes.checkedPositive",
    "error while executing at wasm backtrace:\n    0: frame\n\nCaused by:\n    arg0 was rejected by StructuralSubtypes.checkedPositive\n\n"
  };
  for (unsigned i = 0; i < 3; ++i) if (!exact_cause(good[i], strlen(good[i]), cause)) return 2;
  for (unsigned i = 0; i < 8; ++i) if (exact_cause(bad[i], strlen(bad[i]), cause)) return 3;
  const char hidden[] = "arg0 was rejected by StructuralSubtypes.checkedPositive\0hidden";
  if (exact_cause(hidden, sizeof(hidden) - 1, cause)) return 4;
  printf("{\"snapshots\":%u,\"diagnosticControls\":12}\n", snapshots);
}
`);
	await runCopied("/usr/bin/cc", [...flags, "controls.c", `-L${join(wasmtime, "lib")}`, `-Wl,-rpath,${join(wasmtime, "lib")}`, "-lwasmtime", "-o", "controls"], root, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
	const observed = await runCopied(join(root, "controls"), [], root);
	assert.equal(observed.stderr, ""); assert.deepEqual(JSON.parse(observed.stdout), { snapshots: 12, diagnosticControls: 12 });
});
