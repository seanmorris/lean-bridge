/**
 * Independent installed native Lean tests, sharing copied-value oracles.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** Assemble an installed consumer without using generated conversion logic. */
export const witCallableConsumer = async () => {
	const probe = await readFile(new URL("../fixtures/callable-consumers/wit-component.c", import.meta.url), "utf8");
	const start = probe.indexOf("static void ok("), end = probe.indexOf("static wasmtime_error_t *call(");
	assert.ok(start >= 0 && end > start);
	const source = await readFile(new URL("../fixtures/callable-consumers/wit-host.c", import.meta.url), "utf8");
	return source.replace("/* COPIED_ORACLES */", probe.slice(start, end));
};
