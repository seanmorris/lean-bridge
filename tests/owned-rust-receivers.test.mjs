/**
 * Compile receiver methods against fresh Lean and reject invalid ownership calls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedRustCallables } from "../src/backends/rust/owned-callables.mjs";
import { generateOwnedRustPackage } from "../src/backends/rust/owned-package.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedRustBorrowNativeSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource
	, ownedRustReceiverProbe, ownedRustPlainReceiverReviewedIr } from "./helpers/owned-rust-receiver-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const capabilities = { transferredInputs: true, anchoredResults: true, receiverExports: true };

test("Rust receivers retain nominal members, explicit mutable consumption and existing source", () => {
	const ir = ownedRustReceiverReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedRustPackage(ir, null, {}, { ...capabilities, receiverExports: false }), /only synchronous function/u);
	const generated = generateOwnedRustPackage(ir, null, {}, capabilities);
	assert.deepEqual(ir, before); assert.equal(generated.c.functions.length, 27);
	assert.equal(generated.contract.schemaVersion, 4); assert.equal(generated.contract.receiverExports.exports.length, 16);
	assert.deepEqual(generated.contract.receiverExports.exports.find(item => item.member === "serial"), {
		bindingId: "lean:Owned.serial", owner: "lean:Owned.Ticket"
		, kind: "property", member: "serial"
	});
	assert.match(generated.apiSource, /pub fn transfer_ticket\(&mut self\)/u);
	assert.match(generated.apiSource, /pub fn choose_ticket\(&self, a1: &Value<Ticket>\)/u);
	for(const name of ["close", "get", "is_closed", "retain", "try_equal", "same_identity"])
	{
		const invalid = structuredClone(ir); invalid.declarations.find(item => item.name === "serial").name = name;
		assert.throws(() => generateOwnedRustPackage(invalid, null, {}, capabilities), /receiver member is reserved/u);
	}
	const previous = ownedAggregateReviewedIr();
	assert.deepEqual(generateOwnedRustPackage(previous, null, {}, { receiverExports: true }).files, generateOwnedRustPackage(previous).files);
	const permuted = structuredClone(ir); permuted.types.reverse();
	const shuffled = generateOwnedRustPackage(permuted, null, {}, capabilities);
	for(const key of ["apiSource", "source", "abiHeader", "contract"]) assert.deepEqual(shuffled[key], generated[key]);
});

test("Rust resource-only receivers need no borrowed-result or callback capability", () => {
	for(const consuming of [false, true])
	{
		const generated = generateOwnedRustPackage(ownedRustPlainReceiverReviewedIr(consuming), null, {}, {
			receiverExports: true, transferredInputs: consuming, hostCallbacks: false
		});
		assert.equal(generated.contract.resultAnchors, undefined);
		assert.equal(generated.contract.receiverExports.exports.length, consuming ? 3 : 2);
		assert.doesNotMatch(generated.apiSource + generated.source, /result_validate|OwnedHost\d+/u);
		assert.match(generated.apiSource, /impl Value<Ticket>/u);
		assert.match(generated.apiSource, /pub fn serial\(&self\)/u);
		assert.equal(generated.c.copies, undefined);
		assert.match(generated.files["README.md"], /Value<T> clones share immutable storage and ownership/u);
		assert.doesNotMatch(generated.files["README.md"], /Callbacks accept|with_recovery\(callback/u);
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`Rust receiver members preserve their original lifetime (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RUST_RECEIVER_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedRustReceiverConfiguration() } : { reviewedIr: ownedRustReceiverReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedRustReceiverSource
		, evidenceName: `rust-receivers-${mode}-inputs.json`
	});
	const input = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true, ...capabilities };
	const native = generateOwnedCPackage(input);
	const generated = generateOwnedRustCallables(native.layout.model.bindingIr, capabilities);
	const implementation = ownedRustBorrowNativeSource(native);
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
		, "-o", "libowned-rust-receivers.so"], compiled.directory, environment);
	const template = await ownedRustReceiverProbe();
	await saveLakeFile(compiled.directory, "Cargo.toml", '[package]\nname="owned-rust-receivers"\nversion="1.0.0"\nedition="2021"\n[dependencies]\nnum-bigint="=0.4.6"\n[profile.dev]\ndebug=0\nincremental=false\n');
	const sources = { "src/lib.rs": generated.apiSource + "\nmod owned_values;\n"
		, "src/owned_values.rs": generated.source + `\n#[cfg(test)] mod tests { use super::*;\n${template}\n#[test] fn receivers() { main(); }\n}` };
	const restore = async () => {
		for(const [path, source] of Object.entries(sources)) await saveLakeFile(compiled.directory, path, source);
	};
	await restore();
	const env = { ...environment, RUSTC: resolve(process.env.LEAN_BRIDGE_RUSTC ?? ".toolchains/rust-1.90.0/bin/rustc")
		, RUSTFLAGS: `-Dwarnings -Lnative=${compiled.directory} -ldylib=owned-rust-receivers -Clink-arg=-Wl,-rpath,${compiled.directory}`
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
		, CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0" };
	const cargo = resolve(process.env.LEAN_BRIDGE_CARGO ?? ".toolchains/rust-1.90.0/bin/cargo");
	const run = args => runCopied(cargo, args, compiled.directory, env)
		.catch(error => { throw new Error(JSON.stringify(error.details), { cause: error }); });
	await run(["generate-lockfile", "--offline"]);
	const observed = await run(["test", "--offline", "--locked", "--lib", "--", "--nocapture", "--test-threads=1"]);
	assert.match(observed.stdout, /1 passed; 0 failed/u);
	const match = observed.stdout.match(/owned-rust-receivers:(\{[^\n]+\})/u); assert.ok(match, observed.stdout);
	const result = JSON.parse(match[1]); assert.ok(result.checks > 300);
	for(const key of ["rustFaults", "nativeFaults", "panicFaults", "before", "after"]) assert.ok(result[key] > 0, key);
	assert.equal(result.live, 0); assert.equal(result.identities, 0);
	const rejected = [];
	for(const [name, source, diagnostic] of [
		["wrong-owner", "fn invalid(value: &Value<Bundle>) { let _ = value.serial(); }", /no method named/u]
		, ["raw-receiver-anchor", "fn invalid(value: &Ticket) { let _ = value.retain_ticket(); }", /no method named/u]
		, ["raw-parameter-anchor", "fn invalid(value: &Value<Ticket>, source: &Ticket) { let _ = value.choose_ticket(source); }", /mismatched types/u]
		, ["immutable-receiver", "fn invalid(value: &Value<Ticket>) { let _ = value.transfer_ticket(); }", /cannot borrow.*mutable/u]
		, ...["Send", "Sync"].map(trait => [`reject-${trait.toLowerCase()}`, `fn require<T: ${trait}>() {} fn invalid() { require::<Value<Ticket>>(); }`, /cannot be (sent|shared) between threads safely/u])
	]) {
		await saveLakeFile(compiled.directory, `src/bin/${name}.rs`, `use owned_rust_receivers::*;\n${source}\nfn main() {}\n`);
		await assert.rejects(runCopied(cargo, ["check", "--offline", "--locked", "--bin", name], compiled.directory, env), error => {
			assert.match(error.details?.stderr ?? "", diagnostic); return true;
		});
		rejected.push(name);
	}
	const index = generated.c.functions.findIndex(item => item.name === "chooseTicket");
	const mutations = [
		{ name: "receiver-used-as-other-argument-anchor", file: "src/lib.rs"
			, before: `owned_values::owned_invoke${index}(self.get()?, a1)`
			, after: `{ let _ = a1; owned_values::owned_invoke${index}(self.get()?, self) }` }
		, { name: "missing-whole-value-validation", file: "src/lib.rs"
			, before: "storage.lease.require()?; Ok(&storage.value)"
			, after: "Ok(&storage.value)" }
		, { name: "callback-receiver-escape", file: "src/lib.rs"
			, before: "impl Drop for BorrowFrame { fn drop(&mut self) { self.active.set(false); } }"
			, after: "impl Drop for BorrowFrame { fn drop(&mut self) { let _ = self.active.get(); } }" }
	];
	for(const mutation of mutations)
	{
		await restore(); assert.equal(sources[mutation.file].split(mutation.before).length, 2, mutation.name);
		await saveLakeFile(compiled.directory, mutation.file, sources[mutation.file].replace(mutation.before, mutation.after));
		await run(["test", "--offline", "--locked", "--lib", "--no-run"]);
		await assert.rejects(runCopied(cargo, ["test", "--offline", "--locked", "--lib", "--", "--nocapture", "--test-threads=1"], compiled.directory, env), error => {
			assert.match(error.details?.stderr ?? "", /owned Rust borrow check failed/u, mutation.name); return true;
		});
	}
	await restore();
	const restored = await run(["test", "--offline", "--locked", "--lib", "--", "--nocapture", "--test-threads=1"]);
	assert.equal(restored.stdout.match(/owned-rust-receivers:(\{[^\n]+\})/u)?.[1], match[1]);
	await saveLakeFile("build/owned-rust-receivers", mode + ".json", canonicalJson({
		mode, input, actualLean: true, installedPackage: false
		, result, rejected, restored: true
		, apiSha256: sha256(generated.apiSource)
		, conversionsSha256: sha256(generated.source)
		, probeSha256: sha256(template), nativeSha256: sha256(implementation)
		, mutations: mutations.map(item => ({ name: item.name, compiled: true
			, semanticRejection: true
			, sourceSha256: sha256(sources[item.file].replace(item.before, item.after)) }))
	}));
	t.diagnostic(JSON.stringify({ mode, ...result }));
});
