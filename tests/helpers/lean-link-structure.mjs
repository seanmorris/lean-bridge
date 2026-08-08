import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const loadWasm = async path => {
  const bytes = await readFile(path);
  return { bytes, module: await WebAssembly.compile(bytes) };
};
const byKind = (entries, kind) => entries.filter(entry => entry.kind === kind);

const readUleb = (bytes, start) => {
  let value = 0;
  let shift = 0;
  let offset = start;

  while (offset < bytes.length) {
    const byte = bytes[offset];
    value |= (byte & 0x7f) << shift;
    offset += 1;
    if ((byte & 0x80) === 0) return { value, offset };
    shift += 7;
    if (shift > 35) throw new Error("oversized Wasm u32 LEB value");
  }

  throw new Error("truncated Wasm u32 LEB value");
};

const sectionVectorCount = (bytes, wantedSection) => {
  let offset = 8;

  while (offset < bytes.length) {
    const section = bytes[offset];
    const size = readUleb(bytes, offset + 1);
    const payloadStart = size.offset;
    const payloadEnd = payloadStart + size.value;
    if (payloadEnd > bytes.length) throw new Error("truncated Wasm section");
    if (section === wantedSection) return readUleb(bytes, payloadStart).value;
    offset = payloadEnd;
  }

  return 0;
};

const definedTableCount = bytes => sectionVectorCount(bytes, 4);
const definedMemoryCount = bytes => sectionVectorCount(bytes, 5);

const inspectSideLinkMap = async (root, profile) => {
  const path = `${root}/${profile}/alpha.link.map`;
  const linkMap = await readFile(path, "utf8");

  assert.doesNotMatch(linkMap, /(?:^|[/\\])libleanrt\.a(?:\W|$)/m);
  assert.doesNotMatch(linkMap, /(?:^|[/\\])libInit\.a(?:\W|$)/m);

  const symbols = linkMap
    .split("\n")
    .slice(1)
    .map(line => line.trim().split(/\s+/).at(-1))
    .filter(Boolean);
  const leanDefinitions = symbols.filter(symbol =>
    /^(?:lean_|_ZN4lean)/.test(symbol),
  );

  assert.deepEqual(
    leanDefinitions,
    [
      "lean_link_alpha_box",
      "lean_link_alpha_read",
      "lean_link_alpha_register",
    ],
    `${path} must contain Alpha declarations but no private Lean runtime domain`,
  );
};

export const inspectLeanLinkProfile = async ({
  root,
  profile,
  mainMemoryMode,
}) => {
  const main = await loadWasm(`${root}/${profile}/main.wasm`);
  const alpha = await loadWasm(`${root}/${profile}/alpha.so.wasm`);
  const mainImports = WebAssembly.Module.imports(main.module);
  const mainExports = WebAssembly.Module.exports(main.module);
  const alphaImports = WebAssembly.Module.imports(alpha.module);
  const alphaExports = WebAssembly.Module.exports(alpha.module);

  const mainMemoryImports = byKind(mainImports, "memory");
  const mainMemoryExports = byKind(mainExports, "memory");
  const mainTableImports = byKind(mainImports, "table");
  const mainTableExports = byKind(mainExports, "table");
  assert.equal(
    mainMemoryImports.length + definedMemoryCount(main.bytes),
    1,
    `${root}/${profile} main must contain exactly one total memory`,
  );
  assert.equal(
    mainTableImports.length + definedTableCount(main.bytes),
    1,
    `${root}/${profile} main must contain exactly one total table`,
  );
  if (mainMemoryMode === "defined") {
    assert.deepEqual(mainMemoryImports, []);
    assert.equal(definedMemoryCount(main.bytes), 1);
    assert.deepEqual(mainMemoryExports, [{ name: "memory", kind: "memory" }]);
  } else {
    assert.deepEqual(mainMemoryImports, [
      { module: "env", name: "memory", kind: "memory" },
    ]);
    assert.equal(definedMemoryCount(main.bytes), 0);
    assert.deepEqual(mainMemoryExports, []);
  }
  assert.deepEqual(mainTableImports, []);
  assert.equal(definedTableCount(main.bytes), 1);
  assert.deepEqual(mainTableExports, [
    { name: "__indirect_function_table", kind: "table" },
  ]);

  assert.deepEqual(byKind(alphaImports, "memory"), [
    { module: "env", name: "memory", kind: "memory" },
  ]);
  assert.deepEqual(byKind(alphaImports, "table"), [
    { module: "env", name: "__indirect_function_table", kind: "table" },
  ]);
  assert.equal(definedMemoryCount(alpha.bytes), 0);
  assert.equal(definedTableCount(alpha.bytes), 0);
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

  await inspectSideLinkMap(root, profile);
};
