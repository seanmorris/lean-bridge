/**
 * Check explicit tool identities without opening historical absolute paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import { assertNominalSubtypeWitCapi } from "./nominal-subtype-wit-tools.mjs";

/**
 * Require a normalized recorded absolute path without opening it.
 *
 * @param path - Historical provenance path.
 */
export const nominalSubtypeWitAbsolute = path => assert.ok(typeof path === "string"
	&& posix.isAbsolute(path) && posix.normalize(path) === path && !path.includes("\0"));
/**
 * Require a complete successful captured process record.
 *
 * @param run - Original process result.
 */
export const nominalSubtypeWitSuccessful = run => {
	assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);
	assert.equal(run.code, 0); assert.equal(run.stderr, ""); assert.equal(typeof run.stdout, "string");
};

/**
 * Authenticate the recorded command selection, versions and pinned C API files.
 * Complete tool distributions remain trusted; they are not archived by this record.
 *
 * @param tools - Original pre-install and post-replay tool observation.
 */
export const assertNominalSubtypeWitToolRecords = tools => {
	assert.deepEqual(Object.keys(tools).sort(), ["commands", "selected", "versions", "wasmtime"]);
	assert.deepEqual(Object.keys(tools.selected).sort(), ["cc", "wasmTools", "wasmtimeCapi"]);
	for(const path of Object.values(tools.selected)) nominalSubtypeWitAbsolute(path);
	const paths = { cc: tools.selected.cc, wasmTools: tools.selected.wasmTools
		, pkgConfig: "/usr/bin/pkg-config", assembler: "/usr/bin/as"
		, linker: "/usr/bin/ld", readelf: "/usr/bin/readelf"
		, tar: "/usr/bin/tar", gzip: "/usr/bin/gzip"
		, getconf: "/usr/bin/getconf" };
	assert.deepEqual(Object.keys(tools.commands).sort(), Object.keys(paths).sort());
	assert.deepEqual(Object.keys(tools.versions).sort(), Object.keys(paths).filter(role => role !== "getconf").sort());
	for(const [role, selected] of Object.entries(paths))
	{
		const entry = tools.commands[role];
		assert.deepEqual(Object.keys(entry).sort(), ["bytes", "command", "selected", "sha256"]);
		assert.equal(entry.selected, selected); nominalSubtypeWitAbsolute(entry.command);
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0); assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
		if(role === "getconf") continue;
		const version = tools.versions[role];
		assert.deepEqual(Object.keys(version).sort(), ["args", "command", "run"]);
		assert.equal(version.command, entry.command); assert.deepEqual(version.args, ["--version"]);
		nominalSubtypeWitSuccessful(version.run); assert.ok(version.run.stdout.trim());
	}
	assert.match(tools.versions.wasmTools.run.stdout, /^wasm-tools 1\.245\.1(?: [^\n]+)?\n$/u);
	const { root, files, ...identity } = tools.wasmtime;
	nominalSubtypeWitAbsolute(root); assert.deepEqual(identity, wasmtimeCapiIdentity);
	assertNominalSubtypeWitCapi(files);
	for(const [path, file] of Object.entries(files))
	{
		assert.ok(path === "LICENSE" || path === "lib/libwasmtime.so" || (path.startsWith("include/") && path.endsWith(".h")));
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0); assert.match(file.sha256, /^[a-f0-9]{64}$/u);
	}
};
