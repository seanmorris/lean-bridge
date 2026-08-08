import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const compile = async path => WebAssembly.compile(await readFile(path));

const byKind = (entries, kind) => entries.filter(entry => entry.kind === kind);

const inspectProfile = async profile => {
  const main = await compile(`build/lean-link-spike/${profile}/main.wasm`);
  const alpha = await compile(`build/lean-link-spike/${profile}/alpha.so.wasm`);
  const mainImports = WebAssembly.Module.imports(main);
  const mainExports = WebAssembly.Module.exports(main);
  const alphaImports = WebAssembly.Module.imports(alpha);
  const alphaExports = WebAssembly.Module.exports(alpha);

  const mainMemoryImports = byKind(mainImports, "memory");
  const mainTableExports = byKind(mainExports, "table");
  assert.deepEqual(mainMemoryImports, [{ module: "env", name: "memory", kind: "memory" }]);
  assert.deepEqual(mainTableExports, [{ name: "__indirect_function_table", kind: "table" }]);

  assert.deepEqual(byKind(alphaImports, "memory"), [
    { module: "env", name: "memory", kind: "memory" },
  ]);
  assert.deepEqual(byKind(alphaImports, "table"), [
    { module: "env", name: "__indirect_function_table", kind: "table" },
  ]);
  assert.deepEqual(byKind(alphaExports, "memory"), []);
  assert.deepEqual(byKind(alphaExports, "table"), []);

  const mainFunctionExports = new Set(
    byKind(mainExports, "function").map(entry => entry.name),
  );
  const alphaFunctionImports = byKind(alphaImports, "function")
    .filter(entry => entry.module === "env")
    .map(entry => entry.name);

  for (const symbol of alphaFunctionImports) {
    assert.ok(mainFunctionExports.has(symbol), `${profile} main must export ${symbol}`);
  }

  for (const runtimeSymbol of [
    "lean_notify_assert",
    "lean_inc_heartbeat",
    "lean_internal_panic_out_of_memory",
    "lean_dec_ref_cold",
  ]) {
    assert.equal(
      mainFunctionExports.has(runtimeSymbol),
      true,
      `${profile} main must own ${runtimeSymbol}`,
    );
  }
};

test("startup Lean side module imports the main memory, table, and runtime symbols", async () => {
  await inspectProfile("startup");
});

test("lazy Lean side module imports the main memory, table, and runtime symbols", async () => {
  await inspectProfile("lazy");
});
