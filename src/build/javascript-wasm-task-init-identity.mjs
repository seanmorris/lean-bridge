/** @file Bind a PIC Init archive to the pinned pthread runtime and its target headers. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { javascriptWasmTargetHeaders } from "./javascript-wasm-toolchain.mjs";

const digest = async path => createHash("sha256").update(await readFile(path)).digest("hex");

/**
 * Detect stale or mixed local build inputs before the strict Wasm link.
 * This is a build consistency check, not a publisher signature.
 *
 * @param runtime - Content-addressed threaded Lean build directory.
 * @param archive - Init archive produced from the pinned bootstrap C.
 */
export const taskInitIdentity = async (runtime, archive) => {
	const headers = {};
	for(const name of javascriptWasmTargetHeaders) headers[name] = await digest(join(runtime, "cmake/include/lean", name));
	const stamp = (await readFile(join(runtime, "source/.lean-wasm-patched"), "utf8")).trim();
	return {stamp, headers, archiveSha256: await digest(archive)};
};
