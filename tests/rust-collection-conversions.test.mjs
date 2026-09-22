/**
 * Compile and exercise generated Rust conversions without any Lean native library.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { copiedRustLock, generateCopiedRustPackage } from "../src/backends/rust/copied-values.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkRustCollectionTypes } from "./helpers/rust-collection-types.mjs";
import { rustCollectionConversionProbe } from "./helpers/rust-collection-probes.mjs";

test("generated Rust collection conversions retain values and release failed copies without a Lean runtime", { skip: process.env.LEAN_BRIDGE_RUST_CONVERSION_TEST !== "1", timeout: 120_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-rust-collection-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = collectionReviewedIr(), model = compileCopiedRustModel(ir);
	const files = generateCopiedRustPackage(ir, null, { name: "collections-api", version: "1.0.0" });
	const { source, probe } = await rustCollectionConversionProbe(model);
	const nativeFaults = await readFile("tests/fixtures/collection-consumers/rust-faults.rs", "utf8");
	for(const [path, content] of Object.entries(files))
		await saveLakeFile(root, path, content + (path === "src/__runtime.rs" ? `\n${probe}\n${nativeFaults}` : path === "Cargo.toml" ? '\n[[bin]]\nname="collection-consumer"\npath="src/main.rs"\n[profile.dev]\ndebug=0\nincremental=false\n' : ""));
	await saveLakeFile(root, "Cargo.lock", await copiedRustLock("collections-api", "1.0.0"));
	const environment = nativeFixtureEnvironment(["rust"]);
	const env = { ...environment, RUSTC: environment.LEAN_BRIDGE_RUSTC, RUSTFLAGS: "-Dwarnings", CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0", CARGO_TARGET_DIR: join(root, "target"), LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean" };
	const publicTypes = await checkRustCollectionTypes({ root, cargo: environment.LEAN_BRIDGE_CARGO, environment: env });
	const result = await processBuildRunner.capture({ command: environment.LEAN_BRIDGE_CARGO
		, args: ["test", "--locked", "--offline", "--lib", "collection_conversions::", "--", "--test-threads=1", "--nocapture"]
		, cwd: root
		, env
		, timeoutMs: 110_000 }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	assert.match(result.stdout, /4 passed; 0 failed/);
	assert.match(result.stdout, /1 filtered out/);
	assert.match(result.stdout, /collection-conversions-primitives:19/);
	assert.match(result.stdout, /collection-conversions-records:7:depth:24/);
	const checkpoints = Number(result.stdout.match(/collection-conversions-checkpoints:(\d+)/)?.[1]);
	assert.ok(checkpoints > 40);
	await saveLakeFile("build/collections", "rust-conversions.json", canonicalJson({ schemaVersion: 1
		, kind: "rust-collection-conversion-preflight"
		, compiledLean: false, installedPackage: false
		, tests: 4, primitiveShapes: 19, records: 7, fixedArrayDepth: 24
		, allocationErrorCheckpoints: checkpoints
		, unwindCheckpoints: checkpoints
		, publicTypes
		, nativeFaultsCompiled: true, nativeFaultsExecuted: false
		, nativeFaultsSha256: sha256(nativeFaults)
		, generatedSourceHashes: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]))
		, fixtureSha256: sha256(source), probeSha256: sha256(probe) }));
	t.diagnostic(`${publicTypes.rejected.length} invalid callers rejected; ${checkpoints} allocation errors and ${checkpoints} unwinding checkpoints recovered; no Lean library was loaded`);
});
