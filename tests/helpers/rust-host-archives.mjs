/** @file Produce real binary Cargo host archives from both authoring routes. */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { publishRustHosts } from "./rust-host-publish.mjs";

test("offline CLI publishes Rust host crates from both routes with one exact runtime", {timeout: 3600000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"cargo-host-publisher-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const keep=process.env.LEAN_BRIDGE_RUST_HOST_HANDOFFS;
	const out=await mkdtemp(join(keep??root,"cargo-host-releases-"));
	await publishRustHosts(root,out,process.env);t.diagnostic(out);
});
