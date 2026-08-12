#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { generateWitPackage } from "../src/backends/wit/generate.mjs";

const execute = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = value => createHash("sha256").update(value).digest("hex");
const nixStoreMarker = Buffer.from("/nix/store/");
const adapterWat = `(component
  (type $operation (func (param "value" u32) (result u32)))
  (import "lean-read-box" (func $host (type $operation)))
  (core func $lowered (canon lower (func $host)))
  (core module $adapter
    (import "host" "lean-read-box" (func $host (param i32) (result i32)))
    (func (export "read-box") (param i32) (result i32)
      local.get 0
      call $host)
  )
  (core instance $host-instance
    (export "lean-read-box" (func $lowered)))
  (core instance $adapter-instance
    (instantiate $adapter (with "host" (instance $host-instance))))
  (alias core export $adapter-instance "read-box" (core func $wrapped))
  (func $public (type $operation) (canon lift (core func $wrapped)))
  (export "read-box" (func $public))
)
`;
const adapterWit = `package poc:lean-alpha-adapter@0.0.0;

world lean-alpha-adapter {
  import lean-read-box: func(value: u32) -> u32;
  export read-box: func(value: u32) -> u32;
}
`;

const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
for (const name of ["--native", "--wasmtime", "--output"]) if (!options.get(name)) throw new Error(`missing ${name}`);

const output = resolve(options.get("--output"));
const native = resolve(options.get("--native"));
const wasmtime = resolve(options.get("--wasmtime"));
await mkdir(output, { recursive: true });
if ((await readdir(output)).length !== 0) throw new Error(`WASI artifact output is not empty: ${output}`);
for (const directory of ["bin", "component", "lib", "metadata", "wit"]) await mkdir(join(output, directory), { recursive: true });

const ir = JSON.parse(await readFile(join(projectRoot, "poc/lean-link-spike/bindings/alpha.binding-ir.json"), "utf8"));
const projected = generateWitPackage(ir);
await Promise.all([
  writeFile(join(output, "component/lean-alpha.component.wat"), adapterWat),
  writeFile(join(output, "wit/lean-alpha-adapter.wit"), adapterWit),
  writeFile(join(output, "wit/lean-alpha.wit"), projected.wit),
  writeFile(join(output, "metadata/wit-binding-manifest.json"), `${JSON.stringify(projected.manifest, null, 2)}\n`),
]);
await execute("wasm-tools", ["parse", join(output, "component/lean-alpha.component.wat"), "-o", join(output, "component/lean-alpha.component.wasm")]);
await execute("wasm-tools", ["validate", "--features", "component-model", join(output, "component/lean-alpha.component.wasm")]);

await execute("clang", [
  "-O2", "-g0",
  `-ffile-prefix-map=${projectRoot}=/workspace`,
  "-I", join(native, "include"),
  "-I", join(wasmtime, "include"),
  join(projectRoot, "src/wasi/native-component-host.c"),
  "-L", join(native, "lib"), "-Wl,--no-as-needed", "-llean_alpha_component",
  "-L", join(wasmtime, "lib"), "-lwasmtime",
  "-Wl,--as-needed", "-Wl,--build-id=none", "-Wl,-rpath,$ORIGIN/../lib",
  "-o", join(output, "bin/lean-alpha-wasi-host"),
]);
await execute("patchelf", ["--set-rpath", "$ORIGIN/../lib", join(output, "bin/lean-alpha-wasi-host")]);
await execute("patchelf", ["--set-interpreter", "/lib64/ld-linux-x86-64.so.2", join(output, "bin/lean-alpha-wasi-host")]);
await Promise.all([
  copyFile(join(native, "lib/liblean_bridge_native.so"), join(output, "lib/liblean_bridge_native.so")),
  copyFile(join(native, "lib/liblean_alpha_component.so"), join(output, "lib/liblean_alpha_component.so")),
  copyFile(join(wasmtime, "lib/libwasmtime.so"), join(output, "lib/libwasmtime.so")),
]);
for (const path of [
  "bin/lean-alpha-wasi-host",
  "lib/liblean_bridge_native.so",
  "lib/liblean_alpha_component.so",
  "lib/libwasmtime.so",
]) {
  if ((await readFile(join(output, path))).includes(nixStoreMarker)) {
    throw new Error(`WASI package ELF contains a Nix store reference: ${path}`);
  }
}
await Promise.all([
  chmod(join(output, "bin/lean-alpha-wasi-host"), 0o755),
  chmod(join(output, "lib/liblean_bridge_native.so"), 0o755),
  chmod(join(output, "lib/liblean_alpha_component.so"), 0o755),
  chmod(join(output, "lib/libwasmtime.so"), 0o755),
]);

const files = [];
const visit = async directory => {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) await visit(absolute);
    if (entry.isFile()) {
      const bytes = await readFile(absolute);
      const facts = await stat(absolute);
      files.push({ path: relative(output, absolute), bytes: bytes.length, sha256: sha256(bytes), executable: (facts.mode & 0o111) !== 0 });
    }
  }
};
await visit(output);
await writeFile(join(output, "wasi-artifacts.json"), `${JSON.stringify({
  schemaVersion: 1,
  component: ir.component.id,
  bindingIrSha256: projected.manifest.bindingIrSha256,
  adapter: "component/lean-alpha.component.wasm",
  host: "bin/lean-alpha-wasi-host",
  engine: { name: "wasmtime", version: "42.0.1" },
  files,
}, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output, files: files.length + 1 }, null, 2)}\n`);
