#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { buildCargoPackage } from "../src/release/cargo-package.mjs";
import { buildCPackage, buildCppPackage } from "../src/release/c-family-package.mjs";
import { buildPyPiPackage } from "../src/release/pypi-package.mjs";

const execute = promisify(execFile);
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
if (!options.get("--bundle")) throw new Error("Usage: test-native-consumers.mjs --bundle PATH");
const bundle = resolve(options.get("--bundle"));
const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-native-consumers-"));
const run = (command, args, settings = {}) => execute(command, args, { maxBuffer: 16 * 1024 * 1024, ...settings });

const cRelease = await buildCPackage({ bundleRoot: bundle, outputRoot: join(scratch, "c-release") });
const cRoot = join(scratch, "c-release/lean-bridge-alpha-0.0.0-c");
const cConsumer = join(scratch, "c-consumer");
await mkdir(cConsumer);
await writeFile(join(cConsumer, "main.c"), `#include "lean_alpha.h"
#include <assert.h>
int main(void) {
  lean_alpha_error error = {0}; lean_alpha_box *box = 0; uint32_t value = 0;
  assert(lean_alpha_box_create(42, &box, &error) == LEAN_ALPHA_STATUS_OK);
  assert(lean_alpha_box_read(box, &value, &error) == LEAN_ALPHA_STATUS_OK && value == 42);
  lean_alpha_box_dispose(&box); return 0;
}
`);
await writeFile(join(cConsumer, "CMakeLists.txt"), `cmake_minimum_required(VERSION 3.20)
project(lean_alpha_c_consumer C)
find_package(LeanBridgeAlpha 0.0.0 EXACT CONFIG REQUIRED PATHS "${cRoot}/lib/cmake/LeanBridgeAlpha" NO_DEFAULT_PATH)
add_executable(consumer main.c)
target_link_libraries(consumer PRIVATE LeanBridge::Alpha)
`);
await run("cmake", ["-S", cConsumer, "-B", join(cConsumer, "build")]);
await run("cmake", ["--build", join(cConsumer, "build")]);
await run(join(cConsumer, "build/consumer"), []);

const cppRelease = await buildCppPackage({ bundleRoot: bundle, outputRoot: join(scratch, "cpp-release") });
const cppRoot = join(scratch, "cpp-release/lean-bridge-alpha-0.0.0-cpp");
const cppConsumer = join(scratch, "cpp-consumer");
await mkdir(cppConsumer);
await writeFile(join(cppConsumer, "main.cpp"), `#include "lean_alpha.hpp"
#include <cassert>
int main() {
  lean_bridge::alpha::Box box(42); assert(box.read() == 42); assert(&box.identity() == &box);
  auto add_two = lean_bridge::alpha::make_adder(2); assert(add_two(40) == 42);
  assert(lean_bridge::alpha::with_callback(40, [](auto value) { return value + 2; }) == 44);
}
`);
await writeFile(join(cppConsumer, "CMakeLists.txt"), `cmake_minimum_required(VERSION 3.20)
project(lean_alpha_cpp_consumer CXX)
set(CMAKE_CXX_STANDARD 20)
find_package(LeanBridgeAlpha 0.0.0 EXACT CONFIG REQUIRED PATHS "${cppRoot}/lib/cmake/LeanBridgeAlpha" NO_DEFAULT_PATH)
add_executable(consumer main.cpp)
target_link_libraries(consumer PRIVATE LeanBridge::Alpha)
`);
await run("cmake", ["-S", cppConsumer, "-B", join(cppConsumer, "build")]);
await run("cmake", ["--build", join(cppConsumer, "build")]);
await run(join(cppConsumer, "build/consumer"), []);

const pythonRelease = await buildPyPiPackage({ bundleRoot: bundle, outputRoot: join(scratch, "python-release") });
const pythonRoot = join(scratch, "python-consumer");
await run("python3", ["-m", "pip", "install", "--no-index", "--no-deps", "--target", pythonRoot, pythonRelease.wheel]);
await run("python3", ["-B", "-c", `from lean_alpha import Box, Payload, make_adder, round_trip, with_callback
with Box(42) as box:
    assert box.read() == 42 and box.identity() is box
assert round_trip(Payload(True, 41, "Lean λ", bytes([0, 255]), (0, 2**32 - 1))).count == 42
assert with_callback(40, lambda value: value + 2) == 44
with make_adder(2) as add_two:
    assert add_two(40) == 42
`], { env: { ...process.env, PYTHONPATH: pythonRoot } });

const cargoRelease = await buildCargoPackage({ bundleRoot: bundle, outputRoot: join(scratch, "cargo-release") });
const rustRoot = join(scratch, "rust-consumer");
await mkdir(join(rustRoot, "src"), { recursive: true });
await mkdir(join(rustRoot, "vendor"), { recursive: true });
await run("tar", ["-xzf", cargoRelease.archive, "-C", join(rustRoot, "vendor")]);
await writeFile(join(rustRoot, "Cargo.toml"), `[package]
name = "lean-alpha-consumer"
version = "0.0.0"
edition = "2021"

[dependencies]
lean_bridge_alpha = { path = "vendor/lean_bridge_alpha-0.0.0" }
`);
await writeFile(join(rustRoot, "src/main.rs"), `use lean_bridge_alpha::{make_adder, round_trip, with_callback, Box, Payload};
fn main() -> Result<(), std::boxed::Box<dyn std::error::Error>> {
    let box_value = Box::new(42)?; assert_eq!(box_value.read()?, 42); assert!(std::ptr::eq(box_value.identity()?, &box_value));
    let payload = round_trip(Payload { enabled: true, count: 41, label: "Lean λ".into(), bytes: vec![0, 255], values: vec![0, u32::MAX] })?;
    assert_eq!(payload.count, 42); assert_eq!(with_callback(40, |value| Ok(value + 2))?, 44);
    let add_two = make_adder(2)?; assert_eq!(add_two.call(40)?, 42); Ok(())
}
`);
await run("cargo", ["run", "--offline", "--quiet"], { cwd: rustRoot });

process.stdout.write(`${JSON.stringify({
  result: "passed",
  consumers: ["c", "cpp", "python", "rust"],
  packages: [cRelease.archive, cppRelease.archive, pythonRelease.wheel, cargoRelease.archive].map(path => path.split("/").at(-1)),
  cleanRoots: (await readdir(scratch)).sort(),
  realLeanExecution: true,
}, null, 2)}\n`);
