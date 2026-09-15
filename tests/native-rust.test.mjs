/**
 * Installed ordinary Cargo crates exercise copied values and shared native loading.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { compileRustPackageModel, generateRustBindingPackage, renderRustPackageLayout } from "../src/backends/rust/generate.mjs";
import { compileCopiedRustModel, validateOrdinaryCargoSettings } from "../src/backends/rust/copied-model.mjs";
import { packageOrdinaryCargo } from "../src/release/native-cargo.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_RUST_TEST === "1";
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const cargo = process.env.LEAN_BRIDGE_CARGO ?? "cargo";
const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PERLS: '["/must/not/invoke/perl"]', RUSTC: process.env.LEAN_BRIDGE_RUSTC ?? "rustc" };
const run = (command, args, cwd, env = environment) => processBuildRunner.capture({ command, args, cwd, env });
const synthetic = () => createNativeModel({ ...nativeMetadataFixture(), component: { id: "example@1.0.0", name: "example", version: "1.0.0" } }).bindingIr;
const scalars = [
	["unit", "Unit", "()"], ["bool", "Bool", "true"]
	, ["u8", "UInt8", "u8::MAX"], ["u16", "UInt16", "u16::MAX"]
	, ["u32", "UInt32", "u32::MAX"], ["u64", "UInt64", "u64::MAX"]
	, ["i8", "Int8", "i8::MIN"], ["i16", "Int16", "i16::MIN"]
	, ["i32", "Int32", "i32::MIN"], ["i64", "Int64", "i64::MIN"]
	, ["nat", "Nat", "(api::BigUint::from(1u8) << 4096usize) + api::BigUint::from(1u8)"]
	, ["integer", "Int", "-(api::BigInt::from(1u8) << 4096usize)"]
	, ["f32", "Float32", "-0.0f32"], ["f64", "Float", "-0.0f64"]
	, ["text", "String", '"a\\0λ🌿".to_string()']
	, ["bytes", "ByteArray", "vec![0u8, 255, 128]"]
];
const ordered = name => name === "Cedar" ? scalars : [...scalars].reverse();
const borrowed = label => ["nat", "integer", "text", "bytes"].includes(label) ? "&" : "";
const leaf = () => `api::Leaf { ${scalars.map(([label, , value]) => `v_${label}: ${value}`).join(", ")} }`;
const sourceProject = async (root, name) => {
	await saveLakeFile(root, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(root, "lakefile.toml", `name = "${name.toLowerCase()}"\n[[lean_lib]]\nname = "${name}"\n`);
	await saveLakeFile(root, `${name}.lean`, `namespace ${name}
structure Leaf where
${ordered(name).map(([label, type]) => `  v_${label} : ${type}`).join("\n")}
structure Packet where
  title : String
  leaf : Leaf
  rows : Array (Array Leaf)
structure Word where
  bits : ${name === "Cedar" ? "UInt32" : "UInt64"}
structure Empty where
${scalars.map(([label, type]) => `def echo_${label} (value : ${type}) := value\ndef array_${label} (value : Array ${type}) := value`).join("\n")}
def echo_record (value : Packet) := value
def choose (left right : Packet) (pick : Bool) := if pick then left else right
def echo_rows (value : Array (Array Leaf)) := value
def echo_word (value : Word) := value
def echo_empty (value : Empty) := value
def array_empty (value : Array Empty) := value
def matrix (value : Array UInt32) := #[value, value]
def grow (value : String) := #[value, value]
def replicate (count : UInt32) : Array UInt8 := Array.replicate count.toNat 7
def answer : UInt32 := 42
theorem echo_rows_spec (value : Array (Array Leaf)) : echo_rows value = value := rfl
end ${name}
`);
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [name], exports: [...scalars.flatMap(([label]) => [`${name}.echo_${label}`, `${name}.array_${label}`]), ...["echo_record", "choose", "echo_rows", "echo_word", "echo_empty", "array_empty", "matrix", "grow", "replicate", "answer"].map(label => `${name}.${label}`)], targets: { cargo: { name: `${name.toLowerCase()}-api`, version: "2.0.0-rc.1" } } }));
};

test("ordinary Rust generates deterministic typed APIs with private FFI", () => {
	const ir = synthetic(), files = generateRustBindingPackage(ir);
	assert.deepEqual(files, generateRustBindingPackage(structuredClone(ir)));
	assert.deepEqual(files, renderRustPackageLayout(compileRustPackageModel(ir)));
	assert.match(files["src/lib.rs"], /pub fn increment\(arg0: u32\) -> Result<u32, Error>/);
	assert.doesNotMatch(files["src/lib.rs"], /unsafe|extern|c_void|Alpha/);
	assert.match(files["src/__runtime.rs"], /example_increment/);
	const shadow = synthetic(); shadow.declarations[0].parameters[0].name = "scope";
	assert.match(generateRustBindingPackage(shadow)["src/__runtime.rs"], /fn call0\(arg0: u32\)/);
});

test("ordinary Rust rejects reserved names and invalid Cargo coordinates", () => {
	for(const name of ["match", "crate", "dispatch"])
	{
		const ir = synthetic(); ir.declarations[0].name = name;
		assert.throws(() => compileCopiedRustModel(ir));
	}
	for(const settings of [{ name: "../escape" }, { name: "UPPER" }, { name: "type" }, { version: "1.0" }, { version: "01.0.0" }, { version: "1.0.0-rc.01" }, { version: ">=1.0.0" }]) assert.throws(() => validateOrdinaryCargoSettings(settings));
	validateOrdinaryCargoSettings({ name: "cedar-api", version: "2.0.0-rc.1" });
	for(const name of ["NativeError", "Scope", "OnceLock", "u32", "T0", "BigInt"])
	{
		const ir = synthetic();
		ir.types.push({ ...structuredClone(alpha.bindingIr.types.find(type => type.kind === "record")), id: "example:reserved", name, fields: [], assurance: [] });
		ir.declarations[0].parameters[0].type = { kind: "named", id: "example:reserved" };
		assert.throws(() => compileCopiedRustModel(ir), error => error.code === "unsupported-rust-signature" && error.details.source.path === "Sample.lean");
	}
	const effectful = synthetic(); effectful.declarations[0].effects = ["nondeterministic"];
	assert.throws(() => compileCopiedRustModel(effectful), /pure/);
});

const consumerSource = name => `use ${name.toLowerCase()}_api as api;
fn main() -> Result<(), api::Error> {
${scalars.map(([label, , value]) => `    { let value = ${value}; assert_eq!(api::echo_${label}(${borrowed(label)}value)?, value);
      assert_eq!(api::array_${label}(&[value.clone(), value.clone()])?, vec![value.clone(), value]);
      assert!(api::array_${label}(&[])?.is_empty()); }`).join("\n")}
    let leaf = ${leaf()};
    let mut packet = api::Packet { title: "packet\\0λ".into(), leaf: leaf.clone(), rows: vec![vec![leaf.clone()], vec![]] };
    let result = api::echo_record(&packet)?; assert_eq!(result, packet);
    packet.rows[0].clear(); assert_eq!(result.rows[0].len(), 1);
    assert_eq!(api::choose(&result, &packet, true)?, result);
    assert_eq!(api::choose(&result, &packet, false)?, packet);
    assert_eq!(api::echo_rows(&[vec![leaf.clone()], vec![]])?, vec![vec![leaf], vec![]]);
    assert_eq!(api::echo_word(&api::Word { bits: u${name === "Cedar" ? 32 : 64}::MAX })?.bits, u${name === "Cedar" ? 32 : 64}::MAX);
    assert_eq!(api::echo_empty(&api::Empty {})?, api::Empty {});
    assert_eq!(api::array_empty(&[api::Empty {}])?, vec![api::Empty {}]);
    assert_eq!(api::matrix(&[1, 2, 3])?, vec![vec![1, 2, 3], vec![1, 2, 3]]);
    assert_eq!(api::replicate(256)?, vec![7; 256]);
    assert_eq!(api::answer()?, 42); assert!(!api::echo_bool(false)?);
    assert_eq!(api::echo_nat(&api::BigUint::from(0u8))?, api::BigUint::from(0u8));
    assert_eq!(api::echo_integer(&api::BigInt::from(0u8))?, api::BigInt::from(0u8));
    assert_eq!(api::echo_integer(&(api::BigInt::from(1u8) << 200usize))?, api::BigInt::from(1u8) << 200usize);
    assert_eq!(api::echo_text("")?, ""); assert!(api::echo_bytes(&[])?.is_empty());
${[32, 64].map(bits => `    assert!(api::echo_f${bits}(f${bits}::NAN)?.is_nan());
    assert_eq!(api::echo_f${bits}(f${bits}::INFINITY)?, f${bits}::INFINITY);
    assert_eq!(api::echo_f${bits}(f${bits}::NEG_INFINITY)?, f${bits}::NEG_INFINITY);
    assert!(api::echo_f${bits}(-0.0)?.is_sign_negative());`).join("\n")}
    assert!(matches!(api::echo_text(&"x".repeat(16 * 1024 * 1024 + 1)), Err(api::Error::Limit)));
    assert!(matches!(api::array_unit(&vec![(); 2_100_000]), Err(api::Error::Limit)));
    for _ in 0..3 {
        assert!(matches!(api::grow(&"x".repeat(6 * 1024 * 1024)), Err(api::Error::Native { .. })));
        assert!(matches!(api::replicate(2_100_000), Err(api::Error::Native { .. })));
        assert!(matches!(api::replicate(1_750_000), Err(api::Error::Limit)));
        assert_eq!(api::answer()?, 42);
    }
    std::thread::scope(|scope| { for _ in 0..4 { scope.spawn(|| { for _ in 0..25 { assert_eq!(api::echo_u64(u64::MAX).unwrap(), u64::MAX); } }); } });
    println!("Installed ${name}: copied values, limits and concurrency passed");
    Ok(())
}
`;

const faults = `
#[cfg(test)] mod acceptance {
    use super::*;
    use crate as api;
    #[test] fn every_conversion_checkpoint_releases_owners_and_outputs() {
        let leaf = ${leaf()};
        let packet = api::Packet { title: "fault".into(), leaf: leaf.clone(), rows: vec![vec![leaf], vec![]] };
        for panic in [false, true] {
            let mut completed = false;
            for target in 1..1000 {
                FAULT.with(|state| state.set((target, 0, panic)));
                let before = CLEARS.with(|state| state.get());
                let result = std::panic::catch_unwind(|| api::echo_record(&packet));
                FAULT.with(|state| state.set((0, 0, false)));
                assert_eq!(LIVE.with(|state| state.get()), 0);
                assert_eq!(CLEARS.with(|state| state.get()), before + 1);
                match result {
                    Ok(Ok(value)) => { assert_eq!(value, packet); completed = true; break; }
                    Ok(Err(Error::Allocation)) => assert!(!panic),
                    Err(_) => assert!(panic),
                    other => panic!("unexpected fault result: {other:?}"),
                }
            }
            assert!(completed);
        }
    }
}
`;

test("ordinary Cargo crates reproduce and execute offline after binary relocation", { skip: !enabled, timeout: 1_200_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-rust-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const vendor = join(working, "vendor"); await mkdir(vendor);
	const clean = { PATH: "/usr/bin:/bin", CC: "/missing/cc", LEAN_BRIDGE_LEAN_PREFIX: "/missing/lean" };
	const cargoEnv = { ...environment, LEAN_BRIDGE_LEAN_PREFIX: "/missing/lean", CARGO_TARGET_DIR: join(working, "cargo-target") };
	for(const name of ["Cedar", "Hazel"])
	{
		const source = join(working, name), relocated = `${source}-relocated`;
		await sourceProject(source, name); await cp(source, relocated, { recursive: true });
		const before = await lakeInputState(source), builds = [];
		for(const [index, projectRoot] of [source, relocated].entries())
			builds.push(await buildCanonicalProject({ projectRoot, outputRoot: join(working, `${name}-build${index}`), targets: ["cargo", "c"], environment }));
		assert.deepEqual(await lakeInputState(source), before);
		assert.deepEqual(builds[0].packages, builds[1].packages);
		t.diagnostic(canonicalJson({ project: name, archives: builds[0].packages.map(({ archive, sha256 }) => ({ path: archive, sha256 })) }).trim());
		await rename(source, `${source}-hidden`); await rename(relocated, `${relocated}-hidden`);
		const archive = builds[0].packages.find(pkg => pkg.archive.endsWith(".crate"));
		await run("tar", ["-xzf", join(builds[0].output, "archives", archive.archive), "-C", vendor], working);
		const crate = join(vendor, `${name.toLowerCase()}-api-2.0.0-rc.1`), consumer = join(working, `consumer-${name}`);
		await saveLakeFile(consumer, "Cargo.toml", `[package]\nname = "consumer-${name.toLowerCase()}"\nversion = "0.0.0"\nedition = "2021"\n[dependencies]\n${name.toLowerCase()}-api = { path = "${crate}" }\n`);
		await saveLakeFile(consumer, "src/main.rs", consumerSource(name));
		await run(cargo, ["build", "--offline"], consumer, cargoEnv);
		const executable = join(working, `${name}-consumer`);
		await rename(join(cargoEnv.CARGO_TARGET_DIR, "debug", `consumer-${name.toLowerCase()}`), executable);
		await rename(crate, `${crate}-hidden`);
		assert.match((await run(executable, [], working, clean)).stdout, /limits and concurrency passed/);
		await rename(`${crate}-hidden`, crate);
		if(name === "Cedar")
		{
			await assert.rejects(() => run(executable, [], working, { ...clean, LD_PRELOAD: join(crate, "native/linux-x64/libleanshared.so") }), error => /unverified Lean runtime is already loaded/.test(error.details?.stderr));
			const docs = join(working, "documentation");
			await cp(new URL("./fixtures/documentation/consumers/rust/ordinary", import.meta.url), docs, { recursive: true });
			await mkdir(join(docs, "vendor"));
			await run("tar", ["-xzf", join(builds[0].output, "archives", archive.archive), "-C", join(docs, "vendor")], working);
			assert.match((await run(cargo, ["run", "--offline", "--quiet"], docs, cargoEnv)).stdout, /42; exact integers and copied arrays/);
			await rm(docs, { recursive: true, force: true });
			for(const invalid of ["echo_bool(1)", "echo_unit(0)", "echo_u8(256)", "echo_nat(&-1)", "echo_word(&api::Empty {})"])
			{
				await saveLakeFile(consumer, "src/main.rs", `use cedar_api as api; fn main() { let _ = api::${invalid}; }\n`);
				await assert.rejects(() => run(cargo, ["check", "--offline"], consumer, cargoEnv), error => /mismatched types|out of range/.test(error.details?.stderr));
			}
			await saveLakeFile(consumer, "src/main.rs", consumerSource(name));
		}
		await saveLakeFile(crate, "src/__runtime.rs", (await readFile(join(crate, "src/__runtime.rs"), "utf8")) + faults);
		await run(cargo, ["test", "--lib", "--offline"], crate, cargoEnv);
		// Restore the exact installed source after testing private failure checkpoints.
		await cp(join(builds[0].output, "native/rust/src/__runtime.rs"), join(crate, "src/__runtime.rs"));
		const lib = join(crate, `native/linux-x64/lib${name.toLowerCase()}.so`), bytes = await readFile(lib);
		bytes[bytes.length - 1] ^= 1; await saveLakeFile(dirname(lib), `lib${name.toLowerCase()}.so`, bytes);
		await run(cargo, ["build", "--offline"], consumer, cargoEnv);
		await assert.rejects(() => run(join(cargoEnv.CARGO_TARGET_DIR, "debug", `consumer-${name.toLowerCase()}`), [], working, clean), error => /differs from compiled evidence/.test(error.details?.stderr));
		bytes[bytes.length - 1] ^= 1; await saveLakeFile(dirname(lib), `lib${name.toLowerCase()}.so`, bytes);
		const projection = join(builds[0].output, "native/rust/src/lib.rs");
		await saveLakeFile(dirname(projection), "lib.rs", `${await readFile(projection, "utf8")}\n// drift\n`);
		await assert.rejects(() => packageOrdinaryCargo({ working: join(working, "bad-release"), rustRoot: join(builds[0].output, "native/rust"), nativeRoot: join(builds[0].output, "native/component"), runtimeRoot: join(builds[0].output, "native/runtime"), adapterRoot: join(builds[0].output, "native/c-binding"), leanPrefix, settings: { name: `${name.toLowerCase()}-api`, version: "2.0.0-rc.1" }, glibcMinimumVersion: "2.38" }), /drift/);
		await rm(builds[1].output, { recursive: true, force: true });
		await rm(builds[0].output, { recursive: true, force: true });
	}
	const composition = join(working, "composition");
	await saveLakeFile(composition, "Cargo.toml", `[package]\nname = "composition"\nversion = "0.0.0"\nedition = "2021"\n[dependencies]\ncedar-api = { path = "${vendor}/cedar-api-2.0.0-rc.1" }\nhazel-api = { path = "${vendor}/hazel-api-2.0.0-rc.1" }\n`);
	await saveLakeFile(composition, "src/main.rs", `unsafe extern "C" { fn dlsym(handle: *mut std::ffi::c_void, name: *const std::ffi::c_char) -> *mut std::ffi::c_void; fn fork() -> i32; fn waitpid(pid: i32, status: *mut i32, flags: i32) -> i32; fn _exit(code: i32) -> !; }
fn main() {
    let barrier = std::sync::Barrier::new(2);
    std::thread::scope(|s| { s.spawn(|| { barrier.wait(); assert_eq!(cedar_api::answer().unwrap(), 42); }); s.spawn(|| { barrier.wait(); assert_eq!(hazel_api::answer().unwrap(), 42); }); });
    assert_eq!(cedar_api::echo_word(&cedar_api::Word { bits: u32::MAX }).unwrap().bits, u32::MAX);
    assert_eq!(hazel_api::echo_word(&hazel_api::Word { bits: u64::MAX }).unwrap().bits, u64::MAX);
    unsafe {
        let raw = dlsym(std::ptr::null_mut(), c"lean_bridge_native_snapshot_read".as_ptr()); assert!(!raw.is_null());
        let snapshot: unsafe extern "C" fn(*mut u32) = std::mem::transmute(raw); let mut data = [0u32; 10]; snapshot(data.as_mut_ptr());
        assert_eq!(&data[2..5], &[1, 2, 2]);
        let pid = fork(); assert!(pid >= 0); if pid == 0 { _exit(if cedar_api::answer().is_err() && hazel_api::answer().is_err() { 0 } else { 1 }); }
        let mut status = -1; assert_eq!(waitpid(pid, &mut status, 0), pid); assert_eq!(status, 0);
    }
    println!("Two installed crates share one Lean runtime");
}
`);
	await run(cargo, ["build", "--offline"], composition, cargoEnv);
	const moved = join(working, "moved-composition"); await rename(join(cargoEnv.CARGO_TARGET_DIR, "debug/composition"), moved);
	await rename(vendor, `${vendor}-hidden`);
	const registryBefore = (await readdir(tmpdir())).filter(name => /^lean-bridge-rust-(?:v1|assets)-/.test(name)).sort();
	for(let attempt = 0; attempt < 3; attempt++) assert.match((await run(moved, [], working, clean)).stdout, /share one Lean runtime/);
	assert.deepEqual((await readdir(tmpdir())).filter(name => /^lean-bridge-rust-(?:v1|assets)-/.test(name)).sort(), registryBefore);
});

test("ordinary Rust compiler failure leaves no partial release", { skip: !enabled, timeout: 180_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-rust-failure-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const source = join(working, "source"); await sourceProject(source, "Failure");
	await assert.rejects(() => buildCanonicalProject({ projectRoot: source, outputRoot: join(working, "release"), targets: ["c", "cargo"], environment: { ...environment, LEAN_BRIDGE_CARGO: "/missing/cargo" } }));
	assert.deepEqual(await readdir(working), ["source"]);
});
