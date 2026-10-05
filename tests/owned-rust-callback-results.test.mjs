/**
 * Rust callback-result contracts and independent typed owner APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateOwnedRustPackage } from "../src/backends/rust/owned-package.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustCallbackResultReviewedIr as ownedCallbackResultReviewedIr
	, ownedRustCallbackResultCombinedReviewedIr as ownedCallbackResultCombinedReviewedIr } from "./helpers/owned-rust-callback-result-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const variants = [
	{ name: "no-host", hostCallbacks: false, combined: false }
	, { name: "host", hostCallbacks: true, combined: false }
	, { name: "combined", hostCallbacks: true, combined: true }
];
const options = ({ hostCallbacks, combined }) => ({
	hostCallbacks, callbackResultAnchors: true, transferredInputs: combined
	, anchoredResults: combined, receiverExports: combined
});
const generate = variant => generateOwnedRustPackage(
	(variant.combined ? ownedCallbackResultCombinedReviewedIr : ownedCallbackResultReviewedIr)()
	, null, { name: "owned_rust_callback_results" }, options(variant)
);

test("Rust callback-result owners stay independent of host and export capabilities", () => {
	for(const variant of variants)
	{
		const ir = (variant.combined ? ownedCallbackResultCombinedReviewedIr : ownedCallbackResultReviewedIr)();
		const before = structuredClone(ir), flags = options(variant);
		assert.throws(() => generateOwnedRustPackage(ir, null, {}, { ...flags, callbackResultAnchors: false }), /explicit output leases/u);
		const generated = generate(variant); assert.deepEqual(ir, before);
		assert.equal(generated.contract.schemaVersion, 5);
		assert.equal(JSON.parse(generated.files["binding-manifest.json"]).backend, "owned-rust-v5");
		assert.equal(generated.contract.callbackResultAnchors.signatures.length, 4);
		assert.equal(generated.contract.callbackResultAnchors.parameterNumbering, "callback-local");
		for(const callback of generated.c.callbacks.filter(item => item.anchor !== undefined))
			assert.equal(generated.contract.callbackResultAnchors.signatures.find(item => item.id === callback.id).parameter, callback.anchor - 1);
		for(const key of ["resultAnchors", "receiverExports", "inputTransfers"])
			assert.equal(Boolean(generated.contract[key]), variant.combined, key);
		if(!variant.hostCallbacks) assert.doesNotMatch(generated.apiSource, /pub trait OwnedCallback\d/u);
	}
	const base = ownedAggregateReviewedIr();
	assert.deepEqual(generateOwnedRustPackage(base, null, {}, { callbackResultAnchors: true }).files, generateOwnedRustPackage(base).files);
});

test("Rust callback-result APIs compile raw and whole-owner replies without host admission leaks", {
	skip: process.env.LEAN_BRIDGE_OWNED_RUST_CALLBACK_RESULT_TEST !== "1"
	, timeout: 300000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-rust-callback-result-types-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = { PATH: "/usr/bin:/bin"
		, RUSTC: resolve(process.env.LEAN_BRIDGE_RUSTC ?? ".toolchains/rust-1.90.0/bin/rustc")
		, RUSTFLAGS: "-Dwarnings"
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
		, CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0"
	};
	const cargo = resolve(process.env.LEAN_BRIDGE_CARGO ?? ".toolchains/rust-1.90.0/bin/cargo");
	for(const variant of variants)
	{
		const directory = join(root, variant.name), generated = generate(variant);
		for(const [path, source] of Object.entries(generated.files)) await saveLakeFile(directory, path, source);
		const source = `use owned_rust_callback_results::*;
#[allow(dead_code)]
fn owners(root: Value<Bundle>) -> Result<(), Error> {
    let closure = make_record(root.get()?)?;
    let child: Value<Bundle> = closure.get()?.call(false, &root)?;
    let retained = child.retain()?;
    let copied = copy_value(child.get()?)?;
    let _ = (retained, copied);
    Ok(())
}
${variant.hostCallbacks ? `#[allow(dead_code)]
fn replies(root: Value<Bundle>) -> Result<(), Error> {
    let closure = make_record_callback(root.get()?)?;
    let _: Value<Bundle> = callback_record(root.get()?, &closure)?;
    let _: Value<Bundle> = callback_record(root.get()?, closure.get()?)?;
    let _: Value<Bundle> = callback_record(root.get()?, closure.get()?.clone())?;
    let _: Value<Bundle> = callback_record(root.get()?, closure)?;
    let _: Value<Bundle> = callback_record(root.get()?, |value: Bundle| Ok(value))?;
    let _: Value<Bundle> = callback_record(root.get()?, |_: Bundle| Ok(root.clone()))?;
    let _: Value<Bundle> = callback_record(root.get()?, with_recovery(|value: Bundle| Ok(value), root.get()?.clone()))?;
    let _: Value<Bundle> = callback_record(root.get()?, with_recovery(|_: Bundle| Ok(root.clone()), root.clone()))?;
    Ok(())
}
` : ""}${variant.combined ? `#[allow(dead_code)]
fn combined(mut root: Value<Bundle>) -> Result<(), Error> {
    let closure = root.make_record()?;
    let child = closure.get()?.call(false, &root)?;
    let nested = child.borrow_record()?;
    let retained = nested.retain()?;
    let moved = root.move_record(|value: Bundle| Ok(value))?;
    let _ = (retained, moved);
    Ok(())
}
` : ""}fn main() {}
`;
		await saveLakeFile(directory, "src/bin/consumer.rs", source);
		try
		{ await runCopied(cargo, ["check", "--offline", "--all-targets"], directory, environment); }
		catch(error)
		{ throw new Error(`${variant.name}: ${error.message}`, { cause: error }); }
		t.diagnostic(variant.name + ": checked whole-value anchors and typed replies");
		for(const [name, invalid] of [
			["raw-anchor", "fn wrong(root: &Value<Bundle>) -> Result<(), Error> { let closure = make_record(root.get()?)?; let _ = closure.get()?.call(false, root.get()?); Ok(()) }"]
			, ["wrong-owner", "fn wrong(root: &Value<Bundle>, ticket: &Value<Ticket>) -> Result<(), Error> { let closure = make_record(root.get()?)?; let _ = closure.get()?.call(false, ticket); Ok(()) }"]
			, ...["Send", "Sync"].map(trait => [`reject-${trait.toLowerCase()}`, `fn require<T: ${trait}>() {} fn wrong() { require::<Value<Bundle>>(); }`])
			, ...variant.hostCallbacks ? [
				["wrong-reply", "fn wrong(root: &Value<Bundle>, ticket: Value<Ticket>) -> Result<(), Error> { let _ = callback_record(root.get()?, |_: Bundle| Ok(ticket.clone())); Ok(()) }"]
				, ["custom-reply", "#[derive(Clone)] struct Custom(Bundle); impl OwnedCallbackReply<Bundle> for Custom { fn owned_reply(&self) -> Result<&Bundle, Error> { Ok(&self.0) } }"]
			] : [
				["host-disabled", "fn wrong(root: &Value<Bundle>) -> Result<(), Error> { let _ = callback_record(root.get()?, |value: Bundle| Ok::<_, Error>(value)); Ok(()) }"]
			]
		]) {
			await saveLakeFile(directory, `src/bin/${name}.rs`, `use owned_rust_callback_results::*;\n#[allow(dead_code)]\n${invalid}\nfn main() {}\n`);
			await assert.rejects(runCopied(cargo, ["check", "--offline", "--bin", name], directory, environment), error => {
				assert.match(error.details.stderr, /error\[(?:E0308|E0277)\]/u); return true;
			}, name);
		}
	}
});
