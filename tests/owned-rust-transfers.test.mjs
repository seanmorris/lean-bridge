/**
 * Explicit Rust consumption at the real Lean input-owner handoff.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedRustCallables } from "../src/backends/rust/owned-callables.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedRustTransferReviewedIr, ownedRustTransferConfiguration, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("Rust input consumption requires explicit capability and mutable references", () => {
	const ir = ownedRustTransferReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedRustCallables(ir), /call-scoped input borrows/u);
	const generated = generateOwnedRustCallables(ir, { transferredInputs: true });
	assert.deepEqual(ir, before); assert.equal(generated.c.functions.filter(item => item.transfers?.length).length, 20);
	assert.match(generated.apiSource, /retain_ticket\(a0: &mut Ticket\)/u);
	assert.match(generated.source, /moves\.arm\(\)\?/u);
	const reversed = structuredClone(ir); reversed.types.reverse();
	assert.equal(generateOwnedRustCallables(reversed, { transferredInputs: true }).apiSource, generated.apiSource);
	assert.equal(generateOwnedRustCallables(reversed, { transferredInputs: true }).source, generated.source);
	const borrowed = ownedAggregateReviewedIr();
	const enabled = generateOwnedRustCallables(borrowed, { transferredInputs: true }), baseline = generateOwnedRustCallables(borrowed);
	for(const key of ["apiSource", "valuesSource", "source"]) assert.equal(enabled[key], baseline[key]);
});

for(const mode of ["ordinary", "reviewed"]) test(`Rust inputs move atomically at the real Lean handoff (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RUST_TRANSFER_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...(mode === "ordinary" ? { configuration: await ownedRustTransferConfiguration() } : { reviewedIr: ownedRustTransferReviewedIr() })
		, hostCallbacks: true, sourceSuffix: ownedRustTransferSource
		, evidenceName: `rust-transfers-${mode}-inputs.json`
	});
	const native = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component
		, hostCallbacks: true, transferredInputs: true });
	const generated = generateOwnedRustCallables(native.layout.model.bindingIr, { transferredInputs: true });
	const handoff = "static inline void oc_transfer_consume(void *context) {";
	assert.ok(native.source.includes(handoff));
	const implementation = `#include <stdlib.h>
#include <stddef.h>
static size_t live, handoffs; static ptrdiff_t fail_after = -1;
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${native.source.replace(handoff, handoff + "\n  ++handoffs;")}
size_t owned_test_live(void) { return live; }
size_t owned_test_handoffs(void) { return handoffs; }
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) { lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities; }
`;
	for(const [path, source] of Object.entries(native.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	const environment = { PATH: "/usr/bin:/bin" };
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include")
		, "public-api.c", "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,--no-undefined"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-rust-transfers.so"], compiled.directory, environment);
	const template = await readFile("tests/fixtures/structured-types/owned-rust-transfers.rs", "utf8");
	await saveLakeFile(compiled.directory, "Cargo.toml", '[package]\nname="owned-rust-transfers"\nversion="1.0.0"\nedition="2021"\n[dependencies]\nnum-bigint="=0.4.6"\n[profile.dev]\ndebug=0\nincremental=false\n');
	await saveLakeFile(compiled.directory, "src/lib.rs", generated.apiSource + "\nmod owned_values;\n");
	await saveLakeFile(compiled.directory, "src/owned_values.rs", generated.source + `\n#[cfg(test)] mod tests { use super::*;\n${template}\n#[test] fn transfers() { main(); }\n}`);
	const env = { ...environment, RUSTC: resolve(process.env.LEAN_BRIDGE_RUSTC ?? ".toolchains/rust-1.90.0/bin/rustc")
		, RUSTFLAGS: `-Dwarnings -Lnative=${compiled.directory} -ldylib=owned-rust-transfers -Clink-arg=-Wl,-rpath,${compiled.directory}`
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
		, CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0" };
	const cargo = resolve(process.env.LEAN_BRIDGE_CARGO ?? ".toolchains/rust-1.90.0/bin/cargo");
	await runCopied(cargo, ["generate-lockfile", "--offline"], compiled.directory, env);
	let observed;
	try
	{ observed = await runCopied(cargo, ["test", "--offline", "--locked", "--lib", "--", "--nocapture", "--test-threads=1"], compiled.directory, env); }
	catch(error)
	{ throw new Error(JSON.stringify(error.details), { cause: error }); }
	assert.match(observed.stdout, /1 passed; 0 failed/u);
	const match = observed.stdout.match(/owned-rust-transfers:(\{[^\n]+\})/u); assert.ok(match, observed.stdout);
	const result = JSON.parse(match[1]); assert.ok(result.checks > 300);
	for(const key of ["rustBefore", "rustAfter", "nativeBefore", "nativeAfter", "multiRustBefore", "multiRustAfter", "multiNativeBefore", "multiNativeAfter", "panicBefore", "panicAfter", "multiPanicBefore", "multiPanicAfter"])
		assert.ok(result[key] > 0, key);
	assert.equal(result.live, 0); assert.equal(result.identities, 0);
	const rejected = [];
	for(const [name, code, diagnostic] of [
		["immutable-transfer", "fn invalid(value: &Ticket) { let _ = retain_ticket(value); }", /mutability|mutable/u]
		, ["immutable-container", "fn invalid(value: &[Ticket]) { let _ = echo_array(value); }", /mutability|mutable/u]
		, ...["Send", "Sync"].map(trait => [`reject-${trait.toLowerCase()}`, `fn require<T: ${trait}>() {} fn invalid() { require::<Ticket>(); }`, /cannot be (sent|shared) between threads safely/u])
	]) {
		await saveLakeFile(compiled.directory, `src/bin/${name}.rs`, `use owned_rust_transfers::*;\n${code}\nfn main() {}\n`);
		await assert.rejects(runCopied(cargo, ["check", "--offline", "--locked", "--bin", name], compiled.directory, env), error => {
			assert.match(error.details?.stderr ?? "", diagnostic); return true;
		});
		rejected.push(name);
	}
	await saveLakeFile(resolve("build/owned-rust-transfers"), `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, result, rejected
		, input: { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component }
		, apiSha256: sha256(generated.apiSource)
		, conversionsSha256: sha256(generated.source)
		, probeSha256: sha256(template), nativeSha256: sha256(implementation)
	}));
	t.diagnostic(JSON.stringify(result));
});
