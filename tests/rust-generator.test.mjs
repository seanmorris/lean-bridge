/**
 * Tests the Rust generator behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
	RustBindingGenerationError,
	generateRustBindingPackage,
} from "../src/backends/rust/generate.mjs";
import { auditRustPackage } from "../src/backends/rust/package-audit.mjs";

const run = promisify(execFile);
const clone = value => structuredClone(value);

const writePackage = async (directory, files) => {
	for(const [relativePath, source] of Object.entries(files))
	{
		const destination = join(directory, relativePath);
		await mkdir(join(destination, ".."), { recursive: true });
		await writeFile(destination, source);
	}
};

test("the Rust backend emits owned values, resources, closures, and Results", () => {
  const files = generateRustBindingPackage(alpha.bindingIr);
  assert.deepEqual(files, generateRustBindingPackage(clone(alpha.bindingIr)));
  const source = files["src/lib.rs"];
  const runtime = files["src/__runtime.rs"];

  assert.match(source, /pub struct Payload/);
  assert.match(source, /pub enabled: bool/);
  assert.match(source, /pub count: u32/);
  assert.match(source, /pub label: String/);
  assert.match(source, /pub bytes: Vec<u8>/);
  assert.match(source, /pub values: Vec<u32>/);
  assert.match(source, /pub struct Box/);
  assert.match(source, /pub fn new\(value: u32\) -> Result<Self, Error>/);
  assert.match(source, /pub fn read\(&self\) -> Result<u32, Error>/);
  assert.match(source, /pub fn identity\(&self\) -> Result<&Box, Error>/);
  assert.match(source, /impl Drop for Box/);
  assert.match(source, /pub fn with_callback<F>/);
  assert.match(source, /F: FnMut\(u32\) -> Result<u32, Error>/);
  assert.match(source, /pub struct Transform/);
  assert.match(source, /pub fn call\(&self, value: u32\) -> Result<u32, Error>/);
  assert.doesNotMatch(source, /\b(?:ccall|cwrap|WebAssembly|_bridge_)\b/i);
  assert.doesNotMatch(source, /pub\s+(?:fn|struct|type|trait)\s+(?:invoke|dispatch|handle|token)\b/i);

  assert.match(runtime, /pub trait Runtime/);
  assert.match(runtime, /fn box_new/);
  assert.match(runtime, /fn round_trip/);
  assert.doesNotMatch(runtime, /fn (?:invoke|dispatch)\b/);

  const audit = auditRustPackage(alpha.bindingIr, files);
  assert.equal(audit.capabilityGaps[0].feature, "owned-callable-operator");
  assert.equal(audit.capabilityGaps[0].projection, "call-method");

  const leaked = { ...files };
  leaked["src/lib.rs"] += "\npub fn dispatch() {}\n";
  assert.throws(
    () => auditRustPackage(alpha.bindingIr, leaked),
    error => error.code === "generic-dispatch",
  );
});

test("the generated Rust crate compiles and runs through its native API", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-rust-generator-"));
  try
{
    await writePackage(directory, generateRustBindingPackage(alpha.bindingIr));
    await mkdir(join(directory, "tests"), { recursive: true });
    await writeFile(join(directory, "tests/consumer.rs"), `
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use lean_alpha::__runtime::{install_runtime, Runtime};
use lean_alpha::{
    make_adder, round_trip, with_callback, Box, Error, Payload,
};

#[derive(Default)]
struct FixtureRuntime {
    initializations: AtomicUsize,
    box_disposals: AtomicUsize,
    transform_disposals: AtomicUsize,
}

impl Runtime for FixtureRuntime {
    fn initialize(&self) -> Result<(), Error> {
        self.initializations.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }

    fn box_new(&self, value: u32) -> Result<u64, Error> {
        Ok(u64::from(value) + 1)
    }

    fn box_read(&self, identity: u64) -> Result<u32, Error> {
        Ok((identity - 1) as u32)
    }

    fn box_identity(&self, identity: u64) -> Result<u64, Error> {
        Ok(identity)
    }

    fn round_trip(&self, mut payload: Payload) -> Result<Payload, Error> {
        payload.enabled = !payload.enabled;
        payload.count += 1;
        Ok(payload)
    }

    fn with_callback(
        &self,
        value: u32,
        transform: &mut dyn FnMut(u32) -> Result<u32, Error>,
    ) -> Result<u32, Error> {
        Ok(transform(value + 1)? + 1)
    }

    fn make_adder(&self, base: u32) -> Result<u64, Error> {
        Ok(u64::from(base))
    }

    fn dispose_box(&self, _identity: u64) {
        self.box_disposals.fetch_add(1, Ordering::SeqCst);
    }

    fn call_transform(&self, identity: u64, value: u32) -> Result<u32, Error> {
        Ok(identity as u32 + value)
    }

    fn dispose_transform(&self, _identity: u64) {
        self.transform_disposals.fetch_add(1, Ordering::SeqCst);
    }
}

#[test]
fn ordinary_rust_calls_preserve_values_identity_callbacks_and_drop() {
    let fixture = Arc::new(FixtureRuntime::default());
    install_runtime(fixture.clone()).unwrap();
    install_runtime(fixture.clone()).unwrap();
    assert_eq!(fixture.initializations.load(Ordering::SeqCst), 1);

    {
        let boxed = Box::new(41).unwrap();
        assert_eq!(boxed.read().unwrap(), 41);
        assert!(std::ptr::eq(boxed.identity().unwrap(), &boxed));

        let input = Payload {
            enabled: false,
            count: 8,
            label: "typed".into(),
            bytes: vec![0, 127, 255],
            values: vec![1, 5, 13],
        };
        let expected_label = input.label.clone();
        let output = round_trip(input).unwrap();
        assert!(output.enabled);
        assert_eq!(output.count, 9);
        assert_eq!(output.label, expected_label);
        assert_eq!(output.bytes, vec![0, 127, 255]);
        assert_eq!(output.values, vec![1, 5, 13]);

        assert_eq!(with_callback(40, |value| Ok(value)).unwrap(), 42);
        let add_two = make_adder(2).unwrap();
        assert_eq!(add_two.call(40).unwrap(), 42);
    }

    assert_eq!(fixture.box_disposals.load(Ordering::SeqCst), 1);
    assert_eq!(fixture.transform_disposals.load(Ordering::SeqCst), 1);
}
`);
    const { stdout, stderr } = await run(
      "cargo",
      ["test", "--offline", "--manifest-path", join(directory, "Cargo.toml")],
      { env: { ...process.env, RUSTFLAGS: "-D warnings" } },
    );
    assert.match(`${stdout}\n${stderr}`, /1 passed/);
} finally
{
    await rm(directory, { recursive: true, force: true });
}
});

test("finite generic declarations become concrete Rust functions", () => {
  const ir = clone(alpha.bindingIr);
  const declaration = ir.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  declaration.name = "echo";
  declaration.overloadKey = "echo<T>(T)";
  declaration.typeParameters = [{ id: "T", representation: "copied", constraints: [] }];
  declaration.parameters = [{
    name: "value"
    , type: { kind: "parameter", id: "T" }
    , ownership: "copy"
    , lifetime: null
    , mutability: "immutable"
    , optional: false
    , default: null
  }];
  declaration.result = {
    type: { kind: "parameter", id: "T" }
    , ownership: "copy"
    , lifetime: null
  };
  declaration.source.extensions["lean-wasm.org/specializations"] = [
    { id: "uint32", type: { kind: "primitive", name: "uint32" } }
    , { id: "string", type: { kind: "primitive", name: "string" } }
  ];

  const files = generateRustBindingPackage(ir);
  assert.match(files["src/lib.rs"], /pub fn echo_uint32\(value: u32\) -> Result<u32, Error>/);
  assert.match(files["src/lib.rs"], /pub fn echo_string\(value: String\) -> Result<String, Error>/);
  assert.doesNotMatch(files["src/lib.rs"], /pub fn echo<T>|type_token|specialization:/);
  assert.match(files["src/__runtime.rs"], /fn echo_uint32/);
  assert.match(files["src/__runtime.rs"], /fn echo_string/);
});

test("unsupported target semantics fail before Rust files are emitted", () => {
  const asynchronous = clone(alpha.bindingIr);
  const declaration = asynchronous.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  declaration.resultMode = "promise";
  declaration.effects.push("async");
  assert.throws(
    () => generateRustBindingPackage(asynchronous),
    error => error instanceof RustBindingGenerationError && error.code === "unsupported-result-mode",
  );

  const arbitraryInteger = clone(alpha.bindingIr);
  const field = arbitraryInteger.types.find(type => type.id === "lean:Alpha.Payload").fields[1];
  field.type.name = "nat";
  assert.throws(
    () => generateRustBindingPackage(arbitraryInteger),
    error => error instanceof RustBindingGenerationError && error.code === "unsupported-arbitrary-integer",
  );
});
