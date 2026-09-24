/**
 * Rust structured callable admission and executable callback ownership regression.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { generateCopiedRustPackage, copiedRustLock } from "../src/backends/rust/copied-values.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { rustStructuredOwnershipTests } from "./helpers/rust-structured-callable-ownership.mjs";
import { parseStructuredRustFaults } from "./helpers/rust-structured-callable-install.mjs";
import { assertRustStructuredCodegenRegression } from "./helpers/rust-structured-callable-regression.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

test("Rust structured callables preserve all earlier generated copied packages byte for byte", async () => {
	const record = JSON.parse(await readFile("docs/evidence/rust-structured-codegen-regression-20260924.json"));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assertRustStructuredCodegenRegression(record);
	const altered = structuredClone(record);
	Object.values(altered.fixtures[0].files)[0].sha256 = "0".repeat(64);
	assert.throws(() => assertRustStructuredCodegenRegression(altered));
});

test("Rust admits structured callbacks while rejecting recursive, retained and higher-order payloads", () => {
	const { surface } = compileCopiedRustModel(structuredCallableReviewedIr());
	assert.equal(surface.functions.length, 26); assert.equal(surface.callbacks.size, 14);
	for(const mutate of [
		ir => { ir.types.find(type => type.callable).callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.callable).callable.result.lifetime = { scope: "explicit", anchor: null }; }
		, ir => { ir.types.find(type => type.callable).callable.resultMode = "promise"; }
		, ir => { const callback = ir.types.find(type => type.callable); callback.callable.result.type = { kind: "named", id: callback.id }; }
	]) {
		const ir = structuredCallableReviewedIr(); mutate(ir);
		assert.throws(() => compileCopiedRustModel(ir), { code: "unsupported-native-c-signature" });
	}
	assert.throws(() => compileCopiedRustModel(structuredCallableReviewedIr({ recursive: true })), { code: "unsupported-native-c-signature" });
	const files = generateCopiedRustPackage(structuredCallableReviewedIr());
	const source = files["src/lib.rs"];
	assert.match(source, /impl FnMut\(Vec<Option<String>>\) -> Result<Vec<Option<String>>, Error>/u);
	assert.match(source, /impl FnMut\(Result<Option<u32>, Vec<String>>\) -> Result<Result<Option<u32>, Vec<String>>, Error>/u);
	assert.match(source, /impl FnMut\(Payload\) -> Result<Payload, Error>/u);
	assert.doesNotMatch(source, /unsafe|extern|c_void|dispatch/u);
	assert.match(files["README.md"], /acyclic copied structured callbacks/u);
	assert.doesNotMatch(files["README.md"], /Compound callables, resources and async remain unsupported|List callback payloads remain unsupported/u);
	assert.match(files["binding-manifest.json"], /acyclic structured callables/u);
});

test("Rust fault reports require error and panic checks for each structured shape", () => {
	const shapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias"];
	const valid = shapes.map(shape => `structured-rust-faults:${shape}:5:12`).join("\n");
	assert.equal(parseStructuredRustFaults(valid).length, 8);
	for(const value of [valid.replace("alias", "array"), valid.replace(":5:", ":4:"), valid.replace(":12", ":0"), valid.replace(":12", ":11")])
		assert.throws(() => parseStructuredRustFaults(value));
});

test("Rust nested callback results keep their owners until native copying finishes", { skip: process.env.LEAN_BRIDGE_RUST_STRUCTURED_CALLABLE_TEST !== "1", timeout: 180_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-rust-structured-ownership-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = structuredCallableReviewedIr(), model = compileCopiedRustModel(ir);
	const files = generateCopiedRustPackage(ir, null, { name: "structured-api", version: "1.0.0" });
	for(const [path, bytes] of Object.entries(files)) await saveLakeFile(root, path, bytes);
	await saveLakeFile(root, "Cargo.lock", await copiedRustLock("structured-api", "1.0.0"));
	await saveLakeFile(root, "src/bin/consumer.rs", await readFile("tests/fixtures/structured-callable-consumers/rust.rs"));
	const source = rustStructuredOwnershipTests(model), original = files["src/__runtime.rs"];
	await saveLakeFile(root, "src/__runtime.rs", original + source);
	const environment = nativeFixtureEnvironment(["rust"]);
	const env = { ...environment, RUSTC: environment.LEAN_BRIDGE_RUSTC };
	await runCopied(environment.LEAN_BRIDGE_CARGO, ["check", "--offline", "--locked", "--all-targets"], root, env);
	const args = ["test", "--offline", "--locked", "--lib", "structured_ownership", "--", "--test-threads=1"];
	const fixed = await runCopied(environment.LEAN_BRIDGE_CARGO, args, root, env);
	assert.match(fixed.stdout, /8 passed; 0 failed/u);
	const retention = / {8}\/\/ The C caller copies after this trampoline returns\. Retain the Rust owner\.\n {8}let mut retained = scope.vector\(1\)\?;\n {8}retained.push\(result\);\n {8}scope.keep\(retained\)\?;/gu;
	assert.equal([...original.matchAll(retention)].length, 12);
	await saveLakeFile(root, "src/__runtime.rs", original.replace(retention, "") + source);
	await assert.rejects(runCopied(environment.LEAN_BRIDGE_CARGO, args, root, env), error => {
		assert.match(error.details?.stdout ?? "", /1 passed; 7 failed/u);
		for(const shape of ["alias", "array", "list", "record", "result", "tuple", "variant"])
			assert.ok(error.details.stdout.includes(`${shape}_result_owner_survives_trampoline_return ... FAILED`));
		return true;
	});
	await saveLakeFile(root, "src/__runtime.rs", original + source);
});
