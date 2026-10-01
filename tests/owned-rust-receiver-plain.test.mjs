/**
 * Resource-only Rust receivers work with each optional ownership feature absent.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedRustCallables } from "../src/backends/rust/owned-callables.mjs";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedReceiverConfiguration, ownedReceiverSource } from "./helpers/owned-receiver-fixture.mjs";
import { ownedRustPlainReceiverReviewedIr, ownedRustPlainReceiverProbe } from "./helpers/owned-rust-receiver-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

for(const consuming of [false, true]) for(const mode of ["ordinary", "reviewed"])
	test(`Rust ${mode} resource-only receivers${consuming ? " consume without anchors" : " need no optional capabilities"}`, {
		skip: process.env.LEAN_BRIDGE_OWNED_RUST_RECEIVER_TEST !== "1"
		, timeout: 600000
	}, async t => {
		const names = ["newTicket", "serial", "retainTicket", ...consuming ? ["transferTicket"] : []];
		const configuration = await ownedReceiverConfiguration();
		configuration.exports = names.map(name => "Owned." + name); configuration.arities = {};
		const transfer = configuration.contracts["Owned.transferTicket"];
		configuration.contracts = { "Owned.serial": { receiver: "property" }
			, "Owned.retainTicket": { receiver: "method" }
			, ...consuming ? { "Owned.transferTicket": transfer } : {} };
		const name = `${mode}-${consuming ? "consuming" : "plain"}`;
		const compiled = await compileOwnedAggregateFixture(t, {
			...mode === "ordinary" ? { configuration } : { reviewedIr: ownedRustPlainReceiverReviewedIr(consuming) }
			, sourceSuffix: ownedReceiverSource
			, evidenceName: `rust-receivers-${name}-inputs.json`
		});
		const input = { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component, receiverExports: true
			, transferredInputs: consuming };
		const model = createCompiledNativeModel(input, { ownedGraphs: true, ownedReceiverExports: true, ownedInputTransfers: consuming });
		const native = generateOwnedCPackage(input);
		const generated = generateOwnedRustCallables(model.bindingIr, { receiverExports: true, transferredInputs: consuming, hostCallbacks: false });
		assert.equal(model.ownedGraph.resultAnchors, undefined); assert.equal(model.ownedGraph.hostCallbacks, undefined);
		if(!consuming) assert.equal(model.ownedGraph.inputTransfers, undefined);
		for(const [path, source] of Object.entries(native.files))
			await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), source + (path.startsWith("src/") ? `
size_t receiver_identity_count(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
` : ""));
		const environment = { PATH: "/usr/bin:/bin" };
		await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
			, "-Wextra", "-Werror", "-fPIC", "-shared"
			, "-I", join(compiled.directory, "runtime/include")
			, "public-api.c", "Owned.o", "Carriers.o", "Witness.o"
			, "-L", join(compiled.directory, "runtime/lib")
			, "-llean_bridge_native", "-lleanshared", "-lgmp"
			, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
			, "-o", "libplain-rust.so"], compiled.directory, environment);
		const probe = ownedRustPlainReceiverProbe(consuming);
		await saveLakeFile(compiled.directory, "Cargo.toml", '[package]\nname="owned-rust-plain-receivers"\nversion="1.0.0"\nedition="2021"\n[dependencies]\nnum-bigint="=0.4.6"\n[profile.dev]\ndebug=0\nincremental=false\n');
		await saveLakeFile(compiled.directory, "src/lib.rs", generated.apiSource + "\nmod owned_values;\n");
		await saveLakeFile(compiled.directory, "src/owned_values.rs", generated.source + `\n#[cfg(test)] mod tests { use super::*;\n${probe}\n#[test] fn receivers() { plain_receivers(); }\n}`);
		const env = { ...environment, RUSTC: resolve(process.env.LEAN_BRIDGE_RUSTC ?? ".toolchains/rust-1.90.0/bin/rustc")
			, RUSTFLAGS: `-Dwarnings -Lnative=${compiled.directory} -ldylib=plain-rust -Clink-arg=-Wl,-rpath,${compiled.directory}`
			, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
			, CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0" };
		const cargo = resolve(process.env.LEAN_BRIDGE_CARGO ?? ".toolchains/rust-1.90.0/bin/cargo");
		const run = args => runCopied(cargo, args, compiled.directory, env)
			.catch(error => { throw new Error(JSON.stringify(error.details), { cause: error }); });
		await run(["generate-lockfile", "--offline"]);
		const executed = await run(["test", "--offline", "--locked", "--lib", "--", "--nocapture", "--test-threads=1"]);
		assert.match(executed.stdout, /1 passed; 0 failed/u);
		const match = executed.stdout.match(/owned-rust-plain-receivers:(\{[^\n]+\})/u); assert.ok(match, executed.stdout);
		const result = JSON.parse(match[1]); assert.deepEqual(result, { checks: consuming ? 9 : 8, identities: 0 });
		await saveLakeFile("build/owned-rust-receivers", name + ".json", canonicalJson({
			mode, consuming, input, model, result, sourceSha256: sha256(native.source)
			, apiSha256: sha256(generated.apiSource)
			, conversionsSha256: sha256(generated.source)
			, probeSha256: sha256(probe)
		}));
		t.diagnostic(JSON.stringify({ mode, consuming, ...result }));
	});
