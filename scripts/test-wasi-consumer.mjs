#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { buildWasiPackage } from "../src/release/wasi-package.mjs";

const execute = promisify(execFile);
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
if (!options.get("--bundle")) throw new Error("Usage: test-wasi-consumer.mjs --bundle PATH");
const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-wasi-consumer-"));
const release = await buildWasiPackage({ bundleRoot: resolve(options.get("--bundle")), outputRoot: join(scratch, "release") });
const consumer = join(scratch, "consumer");
await mkdir(consumer);
await execute("tar", ["-xzf", release.archive, "-C", consumer]);
const root = join(consumer, "lean-bridge-alpha-wasi-0.0.0");
const host = join(root, "bin/lean-alpha-wasi-host");
const component = join(root, "component/lean-alpha.component.wasm");
const testLoader = process.env.LEAN_BRIDGE_TEST_GLIBC_LOADER;
const invocation = testLoader
  ? await execute(testLoader, [
      "--library-path",
      `${join(root, "lib")}:${process.env.LEAN_BRIDGE_TEST_GLIBC_LIBRARY_PATH}`,
      host,
      component,
    ])
  : await execute(host, []);
if (invocation.stdout.trim() !== "42") throw new Error(`Component Model consumer returned ${invocation.stdout.trim()}`);
await execute("wasm-tools", ["validate", "--features", "component-model", component]);
process.stdout.write(`${JSON.stringify({ result: "passed", package: release.archive.split("/").at(-1), componentResult: 42, realLeanExecution: true }, null, 2)}\n`);
