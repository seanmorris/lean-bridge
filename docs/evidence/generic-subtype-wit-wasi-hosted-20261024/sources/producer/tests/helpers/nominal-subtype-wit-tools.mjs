/**
 * Record explicit compiler and wasm-tools commands and the pinned Wasmtime C API.
 * Tool distributions remain trusted inputs, separate from installed package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

/**
 * Reject ambient command discovery for this installed acceptance.
 *
 * @param environment - Explicit producer selections.
 */
export const nominalSubtypeWitToolSelection = environment => {
	const selected = { cc: environment.CC
		, wasmTools: environment.LEAN_BRIDGE_WASM_TOOLS
		, wasmtimeCapi: environment.LEAN_BRIDGE_WASMTIME_C_API };
	for(const [name, path] of Object.entries(selected))
		assert.ok(typeof path === "string" && isAbsolute(path) && !path.includes("\0"), `Select an absolute WIT ${name} path`);
	return selected;
};

/**
 * Require every selected official header, library and license, with no substituted bytes.
 *
 * @param files - Selected-file identities from the actual C API directory.
 */
export const assertNominalSubtypeWitCapi = files => {
	assert.equal(sha256(canonicalJson(files)), wasmtimeCapiIdentity.filesSha256);
	for(const path of ["LICENSE", "include/wasmtime.h", "include/wasmtime/component.h", "lib/libwasmtime.so"])
		assert.ok(files[path]?.bytes > 0, path);
};

/**
 * Inspect the exact selected compiler, package tools and pinned Wasmtime files.
 *
 * @param selected - Explicit absolute tool selections.
 * @param cwd - Existing record directory.
 */
export const inspectNominalSubtypeWitTools = async (selected, cwd) => {
	assert.deepEqual(selected, nominalSubtypeWitToolSelection({ CC: selected.cc
		, LEAN_BRIDGE_WASM_TOOLS: selected.wasmTools
		, LEAN_BRIDGE_WASMTIME_C_API: selected.wasmtimeCapi }));
	const commands = {};
	const paths = { cc: selected.cc
		, wasmTools: selected.wasmTools
		, pkgConfig: "/usr/bin/pkg-config"
		, assembler: "/usr/bin/as", linker: "/usr/bin/ld"
		, readelf: "/usr/bin/readelf", tar: "/usr/bin/tar"
		, gzip: "/usr/bin/gzip", getconf: "/usr/bin/getconf" };
	for(const [role, path] of Object.entries(paths))
	{
		const command = await realpath(path), info = await stat(command);
		assert.ok(info.isFile() && (info.mode & 0o111) !== 0, role);
		const bytes = await readFile(command);
		commands[role] = { selected: path, command, bytes: bytes.length, sha256: sha256(bytes) };
	}
	const versions = {};
	for(const role of ["cc", "wasmTools", "pkgConfig", "assembler", "linker", "readelf", "tar", "gzip"])
	{
		const command = commands[role].command, args = ["--version"], run = await runCopied(command, args, cwd);
		assert.equal(run.stderr, ""); assert.ok(run.stdout.trim());
		versions[role] = { command, args, run };
	}
	assert.match(versions.wasmTools.run.stdout, /^wasm-tools 1\.245\.1(?: |\n)/u);
	const wasmtimeRoot = await realpath(selected.wasmtimeCapi), files = {};
	for(const path of (await nativeArtifactPaths(wasmtimeRoot)).filter(path => path === "LICENSE" || path === "lib/libwasmtime.so" || (path.startsWith("include/") && path.endsWith(".h"))))
	{
		const bytes = await readFile(join(wasmtimeRoot, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	assertNominalSubtypeWitCapi(files);
	const header = await readFile(join(wasmtimeRoot, "include/wasmtime.h"), "utf8");
	assert.equal(header.match(/^#define WASMTIME_VERSION "([^"]+)"$/mu)?.[1], wasmtimeCapiIdentity.version);
	for(const entry of Object.values(commands))
	{
		assert.equal(await realpath(entry.command), entry.command);
		const bytes = await readFile(entry.command); assert.equal(bytes.length, entry.bytes); assert.equal(sha256(bytes), entry.sha256);
	}
	return { selected, commands, versions, wasmtime: { root: wasmtimeRoot, ...wasmtimeCapiIdentity, files } };
};
