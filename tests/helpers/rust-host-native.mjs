/** @file Check compiled Rust host interfaces, export visibility, and shared native domain identity. */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildRustHostPair } from "./rust-host-pair.mjs";

test("two compiled Rust host components share one native domain with private member symbols", async t => {
	const root = await mkdtemp(join(tmpdir(), "rust-host-pair-"));
	t.after(() => rm(root, {recursive: true, force: true}));
	const keep = process.env.LEAN_BRIDGE_RUST_HOST_HANDOFFS;
	const install = join(keep ? await mkdtemp(join(keep, "rust-host-libs-")) : root, "install");
	const {libs} = await buildRustHostPair(root, install, process.env);
	t.diagnostic(JSON.stringify({install,libs}));
});
