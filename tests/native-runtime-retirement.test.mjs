/**
 * Execute the shared broker's irreversible failure and retained-owner rules.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { brokerHeader, brokerSource } from "../src/backends/native/runtime-broker.mjs";
import { nativeCallbackHeader, nativeCallbackBroker } from "../src/build/native-component.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("shared native retirement rejects cached components and callbacks but preserves owned cleanup", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-native-runtime-retirement-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await saveLakeFile(root, "lean_bridge_native_runtime.h", `${brokerHeader}\n${nativeCallbackHeader}`);
	await saveLakeFile(root, "lean/lean.h", `#pragma once
typedef struct { unsigned error; } lean_object;
static inline int lean_io_result_is_error(lean_object *value) { return value->error; }
static inline void lean_dec(lean_object *value) { (void)value; }
void lean_finalize_task_manager(void);
void lean_io_mark_end_initialization(void);
void lean_init_task_manager(void);
`);
	const fixture = await readFile("tests/fixtures/structured-types/native-runtime-retirement.c", "utf8");
	await saveLakeFile(root, "check.c", `#define _POSIX_C_SOURCE 200809L\n${brokerSource}\n${nativeCallbackBroker}\n${fixture}`);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror", "-pthread", "-I", root, "check.c", "-o", "check"], root, { PATH: "/usr/bin:/bin" });
	for(const mode of ["cold", "core-failure", "first-failure", "component-failure", "retire", "shutdown", "threads"])
	{
		const result = await runCopied(join(root, "check"), [mode], root);
		assert.equal(result.stdout, `native-runtime-ok ${mode}\n`); assert.equal(result.stderr, "");
	}
});
