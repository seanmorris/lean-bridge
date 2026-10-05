/**
 * Rust borrowed-result roots over compiled Lean and checked original C owners.
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
import { ownedBorrowReviewedIr } from "./helpers/owned-borrow-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedRustBorrowReviewedIr, ownedRustBorrowConfiguration, ownedRustBorrowSource, ownedRustBorrowNativeSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("Rust borrowed results require whole-value roots and preserve unanchored source", () => {
	const ir = ownedRustBorrowReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedRustCallables(ir, { transferredInputs: true }), /explicit output leases/u);
	const generated = generateOwnedRustCallables(ir, { transferredInputs: true, anchoredResults: true });
	assert.deepEqual(ir, before); assert.equal(generated.c.functions.filter(item => item.anchor !== undefined).length, 19);
	assert.match(generated.apiSource, /retain_ticket\(a0: &Value<Ticket>\)/u);
	assert.match(generated.apiSource, /transfer_ticket\(a0: &mut Value<Ticket>\)/u);
	const reversed = structuredClone(ir); reversed.types.reverse();
	const shuffled = generateOwnedRustCallables(reversed, { transferredInputs: true, anchoredResults: true });
	const enabled = generateOwnedRustCallables(ownedAggregateReviewedIr(), { anchoredResults: true });
	const baseline = generateOwnedRustCallables(ownedAggregateReviewedIr());
	for(const key of ["apiSource", "valuesSource", "source"])
	{
		assert.equal(shuffled[key], generated[key]); assert.equal(enabled[key], baseline[key]);
	}
	const borrowOnly = generateOwnedRustCallables(ownedBorrowReviewedIr(), { anchoredResults: true });
	assert.equal(borrowOnly.c.functions.filter(item => item.anchor !== undefined).length, 18);
	assert.ok(borrowOnly.c.functions.every(item => !item.transfers?.length));
});

for(const mode of ["ordinary", "reviewed"]) test(`Rust borrowed results expire with their original owner (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RUST_BORROW_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedRustBorrowConfiguration() } : { reviewedIr: ownedRustBorrowReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedRustBorrowSource
		, evidenceName: `rust-borrows-${mode}-inputs.json`
	});
	const native = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component
		, hostCallbacks: true, transferredInputs: true, anchoredResults: true });
	const generated = generateOwnedRustCallables(native.layout.model.bindingIr, { transferredInputs: true, anchoredResults: true });
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
		, "-o", "libowned-rust-borrows.so"], compiled.directory, environment);
	const template = await readFile("tests/fixtures/structured-types/owned-rust-borrows.rs", "utf8");
	await saveLakeFile(compiled.directory, "Cargo.toml", '[package]\nname="owned-rust-borrows"\nversion="1.0.0"\nedition="2021"\n[dependencies]\nnum-bigint="=0.4.6"\n[profile.dev]\ndebug=0\nincremental=false\n');
	await saveLakeFile(compiled.directory, "src/lib.rs", generated.apiSource + "\nmod owned_values;\n");
	await saveLakeFile(compiled.directory, "src/owned_values.rs", generated.source + `\n#[cfg(test)] mod tests { use super::*;\n${template}\n#[test] fn borrows() { main(); }\n}`);
	const env = { ...environment, RUSTC: resolve(process.env.LEAN_BRIDGE_RUSTC ?? ".toolchains/rust-1.90.0/bin/rustc")
		, RUSTFLAGS: `-Dwarnings -Lnative=${compiled.directory} -ldylib=owned-rust-borrows -Clink-arg=-Wl,-rpath,${compiled.directory}`
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
		, CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0" };
	const cargo = resolve(process.env.LEAN_BRIDGE_CARGO ?? ".toolchains/rust-1.90.0/bin/cargo");
	await runCopied(cargo, ["generate-lockfile", "--offline"], compiled.directory, env);
	const borrowOnly = generateOwnedRustCallables(ownedBorrowReviewedIr(), { anchoredResults: true });
	await saveLakeFile(compiled.directory, "src/lib.rs", borrowOnly.apiSource + "\nmod owned_values;\n");
	await saveLakeFile(compiled.directory, "src/owned_values.rs", borrowOnly.source);
	await runCopied(cargo, ["check", "--offline", "--locked", "--lib"], compiled.directory, env);
	const sources = { "src/lib.rs": generated.apiSource + "\nmod owned_values;\n"
		, "src/owned_values.rs": generated.source + `\n#[cfg(test)] mod tests { use super::*;\n${template}\n#[test] fn borrows() { main(); }\n}` };
	const restore = async () => {
		for(const [path, source] of Object.entries(sources)) await saveLakeFile(compiled.directory, path, source);
	};
	await restore();
	let observed;
	try
	{ observed = await runCopied(cargo, ["test", "--offline", "--locked", "--lib", "--", "--nocapture", "--test-threads=1"], compiled.directory, env); }
	catch(error)
	{ throw new Error(JSON.stringify(error.details), { cause: error }); }
	assert.match(observed.stdout, /1 passed; 0 failed/u);
	const match = observed.stdout.match(/owned-rust-borrows:(\{[^\n]+\})/u); assert.ok(match, observed.stdout);
	const result = JSON.parse(match[1]); assert.ok(result.checks > 300);
	for(const key of ["rustFaults", "nativeFaults", "panicFaults", "before", "after"]) assert.ok(result[key] > 0, key);
	assert.equal(result.live, 0); assert.equal(result.identities, 0);
	const rejected = [];
	for(const [name, source, diagnostic] of [
		["raw-anchor", "fn invalid(value: &Vec<Ticket>) { let _ = echo_array(value); }", /mismatched types/u]
		, ["immutable-transfer", "fn invalid(value: &Value<Ticket>) { let _ = transfer_ticket(value); }", /mutability|mutable/u]
		, ...["Send", "Sync"].map(trait => [`reject-${trait.toLowerCase()}`, `fn require<T: ${trait}>() {} fn invalid() { require::<Value<Ticket>>(); }`, /cannot be (sent|shared) between threads safely/u])
	]) {
		await saveLakeFile(compiled.directory, `src/bin/${name}.rs`, `use owned_rust_borrows::*;\n${source}\nfn main() {}\n`);
		await assert.rejects(runCopied(cargo, ["check", "--offline", "--locked", "--bin", name], compiled.directory, env), error => {
			assert.match(error.details?.stderr ?? "", diagnostic); return true;
		});
		rejected.push(name);
	}
	const ticket = generated.types.find(node => node.hostName === "Ticket");
	const copySignature = node => `pub(crate) fn owned_copy_value${node.index}(source: &${node.hostName}) -> Result<Value<${node.hostName}>, Error> {`;
	const array = generated.types.find(node => node.canonicalHostName === "Vec<Ticket>" && generated.source.includes(copySignature(node)));
	assert.ok(ticket); assert.ok(array);
	const copyArray = copySignature(array);
	const equalTicket = `impl PartialEq for Resource<${ticket.identityTag}> {\n    fn eq(&self, other: &Self) -> bool { self.same_identity(other).unwrap_or(false) }\n}`;
	const mutations = [
		{ name: "missing-whole-value-validation", file: "src/lib.rs"
			, before: "storage.lease.require()?; Ok(&storage.value)"
			, after: "Ok(&storage.value)" }
		, { name: "empty-owner-dropped", file: "src/owned_values.rs"
			, before: copyArray
			, after: copyArray + "\n    if source.is_empty() { return Ok(Value::default()); }" }
		, { name: "callback-wrapper-escape", file: "src/lib.rs"
			, before: "impl Drop for BorrowFrame { fn drop(&mut self) { self.active.set(false); } }"
			, after: "impl Drop for BorrowFrame { fn drop(&mut self) { let _ = self.active.get(); } }" }
		, { name: "raw-pointer-equality", file: "src/lib.rs", before: equalTicket
			, after: `impl PartialEq for Resource<${ticket.identityTag}> {\n    fn eq(&self, other: &Self) -> bool { self.handle == other.handle }\n}` }
	];
	for(const mutation of mutations)
	{
		await restore(); assert.equal(sources[mutation.file].split(mutation.before).length, 2, mutation.name);
		await saveLakeFile(compiled.directory, mutation.file, sources[mutation.file].replace(mutation.before, mutation.after));
		await runCopied(cargo, ["test", "--offline", "--locked", "--lib", "--no-run"], compiled.directory, env);
		await assert.rejects(() => runCopied(cargo, ["test", "--offline", "--locked", "--lib", "--", "--nocapture", "--test-threads=1"], compiled.directory, env), error => {
			assert.match(error.details?.stderr ?? "", /owned Rust borrow check failed/u, mutation.name); return true;
		});
	}
	await restore();
	await saveLakeFile(resolve("build/owned-rust-borrows"), `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, result, rejected
		, borrowOnlyCompiled: true
		, rejectedMutations: mutations.map(item => item.name)
		, input: { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component }
		, apiSha256: sha256(generated.apiSource)
		, conversionsSha256: sha256(generated.source)
		, probeSha256: sha256(template), nativeSha256: sha256(implementation)
	}));
	t.diagnostic(JSON.stringify({ mode, ...result }));
});
