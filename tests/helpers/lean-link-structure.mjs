import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const compile = async path => WebAssembly.compile(await readFile(path));
const byKind = (entries, kind) => entries.filter(entry => entry.kind === kind);

export const inspectLeanLinkProfile = async ({
  root,
  profile,
  mainMemoryMode,
}) => {
  const main = await compile(`${root}/${profile}/main.wasm`);
  const alpha = await compile(`${root}/${profile}/alpha.so.wasm`);
  const mainImports = WebAssembly.Module.imports(main);
  const mainExports = WebAssembly.Module.exports(main);
  const alphaImports = WebAssembly.Module.imports(alpha);
  const alphaExports = WebAssembly.Module.exports(alpha);

  const mainMemoryImports = byKind(mainImports, "memory");
  const mainMemoryExports = byKind(mainExports, "memory");
  const mainTableExports = byKind(mainExports, "table");
  if (mainMemoryMode === "defined") {
    assert.deepEqual(mainMemoryImports, []);
    assert.deepEqual(mainMemoryExports, [{ name: "memory", kind: "memory" }]);
  } else {
    assert.deepEqual(mainMemoryImports, [
      { module: "env", name: "memory", kind: "memory" },
    ]);
    assert.deepEqual(mainMemoryExports, []);
  }
  assert.deepEqual(mainTableExports, [
    { name: "__indirect_function_table", kind: "table" },
  ]);

  assert.deepEqual(byKind(alphaImports, "memory"), [
    { module: "env", name: "memory", kind: "memory" },
  ]);
  assert.deepEqual(byKind(alphaImports, "table"), [
    { module: "env", name: "__indirect_function_table", kind: "table" },
  ]);
  assert.deepEqual(byKind(alphaExports, "memory"), []);
  assert.deepEqual(byKind(alphaExports, "table"), []);

  const unresolvedLeanInitializers = byKind(mainImports, "function")
    .map(entry => entry.name)
    .filter(name => /^(?:lean_|initialize_|runtime_initialize_|meta_initialize_)/.test(name));
  assert.deepEqual(
    unresolvedLeanInitializers,
    [],
    `${root}/${profile} main must resolve the complete Lean runtime and Init closure`,
  );

  const mainFunctionExports = new Set(
    byKind(mainExports, "function").map(entry => entry.name),
  );
  const alphaFunctionImports = byKind(alphaImports, "function")
    .filter(entry => entry.module === "env")
    .map(entry => entry.name);

  for (const symbol of alphaFunctionImports) {
    assert.ok(
      mainFunctionExports.has(symbol),
      `${root}/${profile} main must export ${symbol}`,
    );
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
      `${root}/${profile} main must own ${runtimeSymbol}`,
    );
  }

  for (const lifecycleSymbol of [
    "bridge_lean_runtime_init",
    "bridge_lean_runtime_status",
    "bridge_lean_runtime_init_runs",
    "bridge_lean_runtime_shutdown",
  ]) {
    assert.equal(
      mainFunctionExports.has(lifecycleSymbol),
      true,
      `${root}/${profile} main must export ${lifecycleSymbol}`,
    );
  }
};
