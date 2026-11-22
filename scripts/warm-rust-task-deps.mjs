/**
 * Cache the third-party Cargo archives for offline installed tests without compiling Rust or Lean.
 *
 * @file
 */
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const support = fileURLToPath(new URL("../src/backends/rust/task-runtime", import.meta.url));
const root = await mkdtemp(join(tmpdir(), "rust-task-registry-"));
try
{
	await mkdir(join(root, "src")); await writeFile(join(root, "src/lib.rs"), "");
	await writeFile(join(root, "Cargo.toml"), `[package]\nname="lean-bridge-task-placeholder"\nversion="0.0.0"\nedition="2021"\n[dependencies]\nnum-bigint="=0.4.6"\nsha2="=0.10.9"\nlean-bridge-task-runtime={path=${JSON.stringify(support)},version="=0.1.0"}\n`);
	await copyFile(new URL("../src/backends/rust/task-component.lock", import.meta.url), join(root, "Cargo.lock"));
	await promisify(execFile)(process.env.LEAN_BRIDGE_CARGO ?? "cargo", ["fetch", "--locked"], { cwd: root
		, env: { ...process.env, RUSTC: process.env.LEAN_BRIDGE_RUSTC ?? "rustc", CARGO_BUILD_JOBS: "1" } });
} finally
{ await rm(root, { recursive: true, force: true }); }
