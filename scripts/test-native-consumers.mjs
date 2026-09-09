#!/usr/bin/env node
/**
 * Tests the native consumers workflow.
 *
 * @file
 */


import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { buildCargoPackage } from "../src/release/cargo-package.mjs";
import { buildCPackage, buildCppPackage } from "../src/release/c-family-package.mjs";
import { buildPyPiPackage } from "../src/release/pypi-package.mjs";
import {
	STEADY_STATE_BOX_VALUE,
	STEADY_STATE_MEASURED_ITERATIONS,
	STEADY_STATE_OPERATION,
	STEADY_STATE_WARMUP_ITERATIONS,
	writeConsumerPerformance,
} from "../src/adoption/consumer-performance.mjs";

const execute = promisify(execFile);
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
if(!options.get("--bundle")) throw new Error("Usage: test-native-consumers.mjs --bundle PATH");
const bundle = resolve(options.get("--bundle"));
const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-native-consumers-"));
const fixtureRoot = fileURLToPath(new URL("../tests/fixtures/documentation/consumers/", import.meta.url));
const reportRoot = resolve("build/documentation-native-acceptance");
const documentation = {};
let lastCommand;
const run = async (command, args, settings = {}) => {
	lastCommand = { command, args, cwd: settings.cwd ?? process.cwd() };
	return execute(command, args, { maxBuffer: 16 * 1024 * 1024, ...settings });
};
const expectedOutput = "Box: 42; payload: 42; callback: 44; closure: 42";
const checkDocumentation = (consumer, result) => {
	if(result.stdout.trim() !== expectedOutput) throw new Error(`${consumer} documentation output did not match: ${result.stdout}`);
	documentation[consumer] = { result: "passed", stdout: result.stdout.trim() };
};
const cFamilyDocumentation = async (consumer, archive, packageName) => {
	const root = join(scratch, `${consumer}-documentation`);
	await cp(join(fixtureRoot, consumer), root, { recursive: true });
	await mkdir(join(root, "vendor"));
	await run("tar", ["-xzf", archive, "-C", join(root, "vendor")]);
	const packageRoot = join(root, "vendor", packageName);
	await run("cmake", ["-S", root, "-B", join(root, "build"), "-DCMAKE_BUILD_TYPE=Release", `-DCMAKE_PREFIX_PATH=${packageRoot}`]);
	await run("cmake", ["--build", join(root, "build")]);
	checkDocumentation(consumer, await run(join(root, "build/consumer"), []));
	return packageRoot;
};

try
{

	const cRelease = await buildCPackage({ bundleRoot: bundle, outputRoot: join(scratch, "c-release") });
	const cRoot = await cFamilyDocumentation("c", cRelease.archive, "lean-bridge-alpha-0.0.0-c");
	const cConsumer = join(scratch, "c-consumer");
	await mkdir(cConsumer);
	await writeFile(join(cConsumer, "main.c"), `#define _POSIX_C_SOURCE 200809L
#include "lean_alpha.h"
#include <stdint.h>
#include <stdio.h>
#include <time.h>
#define REQUIRE(condition) do { if (!(condition)) return 1; } while (0)
static unsigned long long now_ns(void) {
  struct timespec value; clock_gettime(CLOCK_MONOTONIC, &value);
  return ((unsigned long long)value.tv_sec * 1000000000ull) + (unsigned long long)value.tv_nsec;
}
int main(void) {
  lean_alpha_error error = {0}; lean_alpha_box *box = 0; uint32_t value = 0;
  REQUIRE(lean_alpha_box_create(${STEADY_STATE_BOX_VALUE}, &box, &error) == LEAN_ALPHA_STATUS_OK);
  REQUIRE(lean_alpha_box_read(box, &value, &error) == LEAN_ALPHA_STATUS_OK && value == ${STEADY_STATE_BOX_VALUE});
  const unsigned int iterations = ${STEADY_STATE_MEASURED_ITERATIONS};
  for (unsigned int index = 0; index < ${STEADY_STATE_WARMUP_ITERATIONS}; ++index) REQUIRE(lean_alpha_box_read(box, &value, &error) == LEAN_ALPHA_STATUS_OK);
  unsigned long long checksum = 0; unsigned long long started = now_ns();
  for (unsigned int index = 0; index < iterations; ++index) { REQUIRE(lean_alpha_box_read(box, &value, &error) == LEAN_ALPHA_STATUS_OK); checksum += value; }
  unsigned long long duration = now_ns() - started;
  lean_alpha_box_dispose(&box);
  printf("{\\\"iterations\\\":%u,\\\"durationNanoseconds\\\":%llu,\\\"checksum\\\":%llu}\\n", iterations, duration, checksum);
  return 0;
}
`);
	await writeFile(join(cConsumer, "CMakeLists.txt"), `cmake_minimum_required(VERSION 3.20)
project(lean_alpha_c_consumer C)
find_package(LeanBridgeAlpha 0.0.0 EXACT CONFIG REQUIRED PATHS "${cRoot}/lib/cmake/LeanBridgeAlpha" NO_DEFAULT_PATH)
add_executable(consumer main.c)
target_link_libraries(consumer PRIVATE LeanBridge::Alpha)
`);
	await run("cmake", ["-S", cConsumer, "-B", join(cConsumer, "build"), "-DCMAKE_BUILD_TYPE=Release"]);
	await run("cmake", ["--build", join(cConsumer, "build")]);
	const cPerformance = JSON.parse((await run(join(cConsumer, "build/consumer"), [])).stdout);
	if(cPerformance.checksum !== STEADY_STATE_BOX_VALUE * cPerformance.iterations) throw new Error("C performance checksum failed");
	await writeConsumerPerformance({
		consumer: "c"
		, operation: STEADY_STATE_OPERATION
		, timingMode: "steady-state"
		, scope: "steady-state generated C API call from a Release consumer"
		, iterations: cPerformance.iterations
		, durationNanoseconds: cPerformance.durationNanoseconds
	});

	const cppRelease = await buildCppPackage({ bundleRoot: bundle, outputRoot: join(scratch, "cpp-release") });
	const cppRoot = await cFamilyDocumentation("cpp", cppRelease.archive, "lean-bridge-alpha-0.0.0-cpp");
	const cppConsumer = join(scratch, "cpp-consumer");
	await mkdir(cppConsumer);
	await writeFile(join(cppConsumer, "main.cpp"), `#include "lean_alpha.hpp"
#include <chrono>
#include <cstdint>
#include <iostream>
int main() {
  lean_bridge::alpha::Box box(${STEADY_STATE_BOX_VALUE}); if (box.read() != ${STEADY_STATE_BOX_VALUE} || &box.identity() != &box) return 1;
  auto add_two = lean_bridge::alpha::make_adder(2); if (add_two(40) != 42) return 1;
  if (lean_bridge::alpha::with_callback(40, [](auto value) { return value + 2; }) != 44) return 1;
  constexpr std::uint32_t iterations = ${STEADY_STATE_MEASURED_ITERATIONS};
  for (std::uint32_t index = 0; index < ${STEADY_STATE_WARMUP_ITERATIONS}; ++index) (void)box.read();
  std::uint64_t checksum = 0; const auto started = std::chrono::steady_clock::now();
  for (std::uint32_t index = 0; index < iterations; ++index) checksum += box.read();
  const auto duration = std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::steady_clock::now() - started).count();
  std::cout << "{\\\"iterations\\\":" << iterations << ",\\\"durationNanoseconds\\\":" << duration << ",\\\"checksum\\\":" << checksum << "}\\n";
}
`);
	await writeFile(join(cppConsumer, "CMakeLists.txt"), `cmake_minimum_required(VERSION 3.20)
project(lean_alpha_cpp_consumer CXX)
set(CMAKE_CXX_STANDARD 20)
find_package(LeanBridgeAlpha 0.0.0 EXACT CONFIG REQUIRED PATHS "${cppRoot}/lib/cmake/LeanBridgeAlpha" NO_DEFAULT_PATH)
add_executable(consumer main.cpp)
target_link_libraries(consumer PRIVATE LeanBridge::Alpha)
`);
	await run("cmake", ["-S", cppConsumer, "-B", join(cppConsumer, "build"), "-DCMAKE_BUILD_TYPE=Release"]);
	await run("cmake", ["--build", join(cppConsumer, "build")]);
	const cppPerformance = JSON.parse((await run(join(cppConsumer, "build/consumer"), [])).stdout);
	if(cppPerformance.checksum !== STEADY_STATE_BOX_VALUE * cppPerformance.iterations) throw new Error("C++ performance checksum failed");
	await writeConsumerPerformance({
		consumer: "cpp"
		, operation: STEADY_STATE_OPERATION
		, timingMode: "steady-state"
		, scope: "steady-state generated C++ API call from a Release consumer"
		, iterations: cppPerformance.iterations
		, durationNanoseconds: cppPerformance.durationNanoseconds
	});

	const pythonRelease = await buildPyPiPackage({ bundleRoot: bundle, outputRoot: join(scratch, "python-release") });
	const pythonRoot = join(scratch, "python-consumer");
	await cp(join(fixtureRoot, "python"), pythonRoot, { recursive: true });
	await run("python3", ["-m", "venv", join(pythonRoot, ".venv")]);
	const python = join(pythonRoot, ".venv/bin/python");
	await run(process.execPath, [pythonRelease.preflight, "--wheel", pythonRelease.wheel, "--python", python]);
	await run(python, ["-m", "pip", "install", "--no-index", "--no-deps", pythonRelease.wheel]);
	checkDocumentation("python", await run(python, ["-B", "main.py"], { cwd: pythonRoot }));
	const pythonPerformance = JSON.parse((await run(python, [
		"-B"
		, "-c"
		, `import json
from time import perf_counter_ns
from lean_alpha import Box, Payload, make_adder, round_trip, with_callback
with Box(${STEADY_STATE_BOX_VALUE}) as box:
    assert box.read() == ${STEADY_STATE_BOX_VALUE} and box.identity() is box
    iterations = ${STEADY_STATE_MEASURED_ITERATIONS}
    for _ in range(${STEADY_STATE_WARMUP_ITERATIONS}): box.read()
    started = perf_counter_ns()
    checksum = 0
    for _ in range(iterations): checksum += box.read()
    duration = perf_counter_ns() - started
assert round_trip(Payload(True, 41, "Lean λ", bytes([0, 255]), (0, 2**32 - 1))).count == 42
assert with_callback(40, lambda value: value + 2) == 44
with make_adder(2) as add_two:
    assert add_two(40) == 42
print(json.dumps({"iterations": iterations, "durationNanoseconds": duration, "checksum": checksum}))
`], { cwd: pythonRoot })).stdout);
	if(pythonPerformance.checksum !== STEADY_STATE_BOX_VALUE * pythonPerformance.iterations) throw new Error("Python performance checksum failed");
	await writeConsumerPerformance({
		consumer: "python"
		, operation: STEADY_STATE_OPERATION
		, timingMode: "steady-state"
		, scope: "steady-state generated Python API call"
		, iterations: pythonPerformance.iterations
		, durationNanoseconds: pythonPerformance.durationNanoseconds
	});

	const cargoRelease = await buildCargoPackage({ bundleRoot: bundle, outputRoot: join(scratch, "cargo-release") });
	const rustDocumentationRoot = join(scratch, "rust-documentation");
	await cp(join(fixtureRoot, "rust"), rustDocumentationRoot, { recursive: true });
	await mkdir(join(rustDocumentationRoot, "vendor"));
	await run("tar", ["-xzf", cargoRelease.archive, "-C", join(rustDocumentationRoot, "vendor")]);
	checkDocumentation("rust", await run("cargo", ["run", "--release", "--offline", "--quiet"], { cwd: rustDocumentationRoot }));
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
use std::time::Instant;
fn main() -> Result<(), std::boxed::Box<dyn std::error::Error>> {
    let box_value = Box::new(${STEADY_STATE_BOX_VALUE})?; assert_eq!(box_value.read()?, ${STEADY_STATE_BOX_VALUE}); assert!(std::ptr::eq(box_value.identity()?, &box_value));
    let payload = round_trip(Payload { enabled: true, count: 41, label: "Lean λ".into(), bytes: vec![0, 255], values: vec![0, u32::MAX] })?;
    assert_eq!(payload.count, 42); assert_eq!(with_callback(40, |value| Ok(value + 2))?, 44);
    let add_two = make_adder(2)?; assert_eq!(add_two.call(40)?, 42);
    let iterations: u32 = ${STEADY_STATE_MEASURED_ITERATIONS};
    for _ in 0..${STEADY_STATE_WARMUP_ITERATIONS} { let _ = box_value.read()?; }
    let mut checksum: u64 = 0; let started = Instant::now();
    for _ in 0..iterations { checksum += u64::from(box_value.read()?); }
    let duration = started.elapsed().as_nanos();
    println!("{{\\\"iterations\\\":{},\\\"durationNanoseconds\\\":{},\\\"checksum\\\":{}}}", iterations, duration, checksum);
    Ok(())
}
`);
	const rustPerformance = JSON.parse((await run("cargo", ["run", "--release", "--offline", "--quiet"], { cwd: rustRoot })).stdout);
	if(rustPerformance.checksum !== STEADY_STATE_BOX_VALUE * rustPerformance.iterations) throw new Error("Rust performance checksum failed");
	await writeConsumerPerformance({
		consumer: "rust"
		, operation: STEADY_STATE_OPERATION
		, timingMode: "steady-state"
		, scope: "steady-state generated Rust API call from a release-profile consumer"
		, iterations: rustPerformance.iterations
		, durationNanoseconds: rustPerformance.durationNanoseconds
	});

	const report = {
		result: "passed"
		, consumers: ["c", "cpp", "python", "rust"]
		, packages: [cRelease.archive, cppRelease.archive, pythonRelease.wheel, cargoRelease.archive].map(path => path.split("/").at(-1))
		, cleanRoots: (await readdir(scratch)).sort()
		, realLeanExecution: true
		, documentation
	};
	await mkdir(reportRoot, { recursive: true });
	await writeFile(join(reportRoot, "acceptance.json"), `${JSON.stringify(report, null, 2)}\n`);
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
catch(error)
{
	await mkdir(reportRoot, { recursive: true });
	await writeFile(join(reportRoot, "acceptance.json"), `${JSON.stringify({
		result: "failed"
		, documentation
		, lastCommand
		, message: error.message
		, stdout: error.stdout ?? ""
		, stderr: error.stderr ?? ""
	}, null, 2)}\n`);
	throw error;
}
finally
{
	await rm(scratch, { recursive: true, force: true });
}
