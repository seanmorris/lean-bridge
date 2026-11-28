/** @file Exercise the actual shared Rust owner module using a separately compiled client crate. */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

test("Rust Rc identities are nominal, shared between sessions, and retained by the declared anchor", async t => {
	const root = await mkdtemp(join(tmpdir(), "rust-host-owner-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const rust = process.env.LEAN_BRIDGE_RUSTC ?? "rustc";
	const flags = ["--edition=2021", "-Dwarnings", "-Cdebuginfo=0", "-Ccodegen-units=1"];
	await run(rust, [...flags, "--crate-type=rlib", "--crate-name=owner", resolve("src/backends/rust/task-runtime/src/owner.rs"), "-o", "libowner.rlib"], root, process.env);
	await run(rust, [...flags, resolve("tests/fixtures/rust-host-members/owner.rs"), "--extern", "owner=libowner.rlib", "-o", "client"], root, process.env);
	assert.match(await run("./client", [], root, { PATH: "/no-tools" }), /reentrant destruction/u);
});
