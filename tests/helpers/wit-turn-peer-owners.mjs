/** @file Execute package-local WIT registration tables in the same Wasmtime store. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { witTurnOwnerLifecycle, witTurnOwners } from "../../src/backends/wit/application-turn-owners.mjs";

const exec = promisify(execFile), fixtures = resolve("tests/fixtures/static-host-workers");
test("two WIT registration tables close independently over one defining object table", async t => {
	const root = await mkdtemp(join(tmpdir(), "wit-peer-owners-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const resources = [{ name: "item", retain: "retain-item", same: "same-item" }];
	const descriptor = { interfaceName: "objects", contract: { error: "fault", resources } };
	const callbacks = { interfaceName: "callbacks", exchange: { slots: [{ type: "item" }] } };
	const graph = ["(component"
		, await readFile(join(fixtures, "peer-owner.wat"), "utf8")
		, witTurnOwners(descriptor, null).replace("(component", "(component $base")
		, witTurnOwners(descriptor, callbacks).replace("(component", "(component $ext")
		, "(instance $obj (instantiate $definition))"
		, '(instance $v (instantiate $base (with "objects" (instance $obj))))'
		, '(export "objects" (instance $obj))'];
	for(const id of ["a", "b"])
	{
		graph.push(`(instance $p${id} (instantiate $definition))`
			, `(instance $${id} (instantiate $ext (with "objects" (instance $obj)) (with "object-owners" (instance $v)) (with "callbacks" (instance $p${id}))))`
			, `(export "provider-${id}" (instance $p${id})) (export "table-${id}" (instance $${id}))`);
	}
	graph.push(witTurnOwnerLifecycle("$v", ["$a", "$b"]), ")");
	await writeFile(join(root, "audit.wat"), graph.join("\n"));
	const wasm = process.env.LEAN_BRIDGE_WASM_TOOLS ?? "wasm-tools";
	await exec(wasm, ["parse", "audit.wat", "-o", "audit.wasm"], { cwd: root });
	await exec(wasm, ["validate", "audit.wasm"], { cwd: root });
	const sdk = resolve(process.env.LEAN_BRIDGE_ASYNC_WASMTIME_C_API), lib = join(sdk, "lib");
	const args = ["-std=gnu11", "-Wall", "-Wextra", "-Werror"
		, "-I" + join(sdk, "include"), join(fixtures, "peer-owner-audit.c")
		, "-L" + lib, "-lwasmtime", "-o", "audit"];
	await exec(process.env.CC ?? "cc", args, { cwd: root });
	const r = await exec(join(root, "audit"), [], { cwd: root, timeout: 20000
		, env: { PATH: "/no-tools", LD_LIBRARY_PATH: lib, RAYON_NUM_THREADS: "1" } });
	assert.equal(r.stdout.trim(), "closed both orders; failed group bind rolled back; destructor counts balanced");
});
