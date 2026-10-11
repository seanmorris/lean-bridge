/**
 * Compile the late-input caller and exercise real Wasmtime snapshot controls.
 * These checks do not claim installed Lean execution.
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
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerReviewedIr } from "./reviewed-fin-container-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_FIN_LATE_SOURCE_TEST === "1";
test("late WIT input checks compile against the generated public header", { skip: !enabled }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-late-wit-source-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const wasmtime = resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? ".toolchains/wasmtime42");
	const header = await readFile("tests/fixtures/fin-container-late-consumers/wit-values.h", "utf8");
	await saveLakeFile(root, "wit-values.h", header);
	await saveLakeFile(root, "fincontainers_wasmtime.h", renderWitHostHeader(compileCopiedWitModel(finContainerReviewedIr())));
	await saveLakeFile(root, "consumer.c", await readFile("tests/fixtures/fin-container-late-consumers/wit-wasi.c", "utf8"));
	const flags = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-I.", `-I${join(wasmtime, "include")}`];
	const compiled = await runCopied("/usr/bin/cc", [...flags, "-fsyntax-only", "consumer.c"], root);
	assert.equal(compiled.stdout, ""); assert.equal(compiled.stderr, "");
	await saveLakeFile(root, "snapshots.c", '#include "wit-values.h"\n#include <stdio.h>\nint main(void) { unsigned n = late_snapshot_controls(); if(n != 11) return 1; printf("snapshot-controls:%u\\n", n); }\n');
	const build = await runCopied("/usr/bin/cc", [...flags, "snapshots.c", `-L${join(wasmtime, "lib")}`, `-Wl,-rpath,${join(wasmtime, "lib")}`, "-lwasmtime", "-o", "snapshots"], root, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
	assert.equal(build.stdout, ""); assert.equal(build.stderr, "");
	const observed = await runCopied(join(root, "snapshots"), [], root);
	assert.equal(observed.stdout, "snapshot-controls:11\n"); assert.equal(observed.stderr, "");
});
