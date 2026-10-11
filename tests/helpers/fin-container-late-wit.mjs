/**
 * Independently specified WIT late-argument input preservation caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export const finLateWitChecks = 7065;
export const finLateWitExpected = `fin-late-ok:${finLateWitChecks}\n`;

/** Inline the complete public-value helper so the installed caller needs no repository files. */
export const finLateWitConsumer = async () => {
	const prefix = "tests/fixtures/fin-container-late-consumers/";
	const header = await readFile(prefix + "wit-values.h", "utf8");
	const consumer = await readFile(prefix + "wit-wasi.c", "utf8");
	const include = '#include "wit-values.h"\n';
	assert.equal(consumer.split(include).length, 2);
	return consumer.replace(include, header + "\n");
};
