/**
 * Compile the immutable Rust caller against all four generated public APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	generateCopiedRustPackage
} from "../../src/backends/rust/copied-values.mjs";
import {
	zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";
import {
	zeroPayloadRustCaller, zeroPayloadRustFeatures, zeroPayloadRustRoutes
	, zeroPayloadRustTarget
} from "./zero-payload-checked-record-rust-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_ZERO_PAYLOAD_RUST_CALLER_TEST === "1";

test("zero-payload Rust caller type-checks against both API modes", {
	skip: !enabled, timeout: 300_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-rust-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const cargo = resolve(".toolchains/rust-1.90.0/bin/cargo");
	const rustc = resolve(".toolchains/rust-1.90.0/bin/rustc");
	const caller = await zeroPayloadRustCaller();
	for(const route of zeroPayloadRustRoutes)
	{
		const cell = join(root, route);
		const pkg = join(cell, "package");
		const consumer = join(cell, "consumer");
		const selection = zeroPayloadBrowserSelection(route);
		const files = generateCopiedRustPackage(
			selection.expected, null, zeroPayloadRustTarget
		);
		for(const [path, source] of Object.entries(files))
			await saveLakeFile(pkg, path, source);
		const manifest = `[package]\nname = "zero-payload-caller"\nversion = "0.0.0"\nedition = "2021"\n[features]\nresult-only = []\nreviewed = []\n[dependencies]\nzeropayloadcheckedrecords = { path = "../package" }\n`;
		await saveLakeFile(consumer, "Cargo.toml", manifest);
		await saveLakeFile(consumer, "src/main.rs", caller);
		const features = zeroPayloadRustFeatures(route);
		const run = spawnSync(cargo, [
			"check", "--offline", "--manifest-path", join(consumer, "Cargo.toml")
			, ...features.length ? ["--features", features.join(",")] : []
		], {
			cwd: cell, encoding: "utf8", timeout: 240_000
			, env: {
				...process.env, RUSTC: rustc, CARGO_BUILD_JOBS: "1"
				, CARGO_TARGET_DIR: join(cell, "target"), RUSTFLAGS: "-Dwarnings"
			}
		});
		assert.equal(run.error, undefined);
		assert.equal(run.status, 0, `${route}: ${run.stderr}`);
		assert.equal(run.stdout, "");
		t.diagnostic(`${route}: ${run.stderr.trim().split("\n").at(-1)}`);
	}
});
