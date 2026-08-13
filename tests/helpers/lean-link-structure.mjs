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

	while(offset < bytes.length)
	{
		const byte = bytes[offset];
		value |= (byte & 0x7f) << shift;
		offset += 1;
		if((byte & 0x80) === 0) return { value, offset };
		shift += 7;
		if(shift > 35) throw new Error("oversized Wasm u32 LEB value");
	}

	throw new Error("truncated Wasm u32 LEB value");
};

const sectionVectorCount = (bytes, wantedSection) => {
	let offset = 8;

	while(offset < bytes.length)
	{
		const section = bytes[offset];
		const size = readUleb(bytes, offset + 1);
		const payloadStart = size.offset;
		const payloadEnd = payloadStart + size.value;
		if(payloadEnd > bytes.length) throw new Error("truncated Wasm section");
		if(section === wantedSection) return readUleb(bytes, payloadStart).value;
		offset = payloadEnd;
	}

	return 0;
};

const definedTableCount = bytes => sectionVectorCount(bytes, 4);
const definedMemoryCount = bytes => sectionVectorCount(bytes, 5);

const SIDE_LIBRARIES = Object.freeze([
	Object.freeze({
		name: "alpha"
		, definitions: Object.freeze([
			"lean_link_alpha_box"
			, "lean_link_alpha_read"
			, "lean_link_alpha_payload"
			, "lean_link_alpha_round_trip"
			, "lean_link_alpha_with_callback"
			, "lean_link_alpha_make_adder"
			, "lean_link_alpha_payload_enabled"
			, "lean_link_alpha_payload_count"
			, "lean_link_alpha_payload_label"
			, "lean_link_alpha_payload_bytes"
			, "lean_link_alpha_payload_values"
			, "lean_link_alpha_register"
		])
	})
	, Object.freeze({
		name: "beta"
		, definitions: Object.freeze([
			"lean_link_beta_identity"
			, "lean_link_beta_read"
			, "lean_link_beta_register"
		])
	})
	, Object.freeze({
		name: "gamma"
		, definitions: Object.freeze([
			"lean_link_gamma_identity"
			, "lean_link_gamma_read"
			, "lean_link_gamma_register"
		])
	})
]);

const plainLinkSymbols = linkMap =>
	linkMap
    .split("\n")
    .slice(1)
    .map(line => line.trim().split(/\s+/).at(-1))
    .filter(Boolean);

const inspectSideLinkMap = async (root, profile, library) => {
	const path = `${root}/${profile}/${library.name}.link.map`;
	const linkMap = await readFile(path, "utf8");

	assert.doesNotMatch(linkMap, /(?:^|[/\\])libleanrt\.a(?:\W|$)/m);
	assert.doesNotMatch(linkMap, /(?:^|[/\\])libInit\.a(?:\W|$)/m);

	const leanDefinitions = plainLinkSymbols(linkMap).filter(symbol =>
		/^(?:lean_|_ZN4lean)/.test(symbol),
	);

	assert.deepEqual(
		leanDefinitions,
		library.definitions,
		`${path} must contain only its declared Lean library domain`,
	);
};

const inspectMainMemoryAndTable = ({
	artifact
	, imports
	, exports
	, mainMemoryMode
	, label
}) => {
	const memoryImports = byKind(imports, "memory");
	const memoryExports = byKind(exports, "memory");
	const tableImports = byKind(imports, "table");
	const tableExports = byKind(exports, "table");
	assert.equal(
		memoryImports.length + definedMemoryCount(artifact.bytes),
		1,
		`${label} must contain exactly one total memory`,
	);
	assert.equal(
		tableImports.length + definedTableCount(artifact.bytes),
		1,
		`${label} must contain exactly one total table`,
	);
	if(mainMemoryMode === "defined")
	{
		assert.deepEqual(memoryImports, []);
		assert.equal(definedMemoryCount(artifact.bytes), 1);
		assert.deepEqual(memoryExports, [{ name: "memory", kind: "memory" }]);
	} else
	{
		assert.deepEqual(memoryImports, [
			{ module: "env", name: "memory", kind: "memory" }
		]);
		assert.equal(definedMemoryCount(artifact.bytes), 0);
		assert.deepEqual(memoryExports, []);
	}
	assert.deepEqual(tableImports, []);
	assert.equal(definedTableCount(artifact.bytes), 1);
	assert.deepEqual(tableExports, [
		{ name: "__indirect_function_table", kind: "table" }
	]);
};

const assertNoLeanRuntimeImports = (imports, label) => {
	const unresolved = byKind(imports, "function")
    .map(entry => entry.name)
    .filter(name =>
			/^(?:lean_|initialize_|runtime_initialize_|meta_initialize_)/.test(name),
    );
	assert.deepEqual(
		unresolved,
		[],
		`${label} must resolve the complete Lean runtime and Init closure`,
	);
};

/**
 * Inspects lean link profile and returns the structured evidence required by the structural acceptance tests.
 *
 * @param root0 - Named inputs and dependency overrides used to inspect lean link profile.
 * @param root0.root - Filesystem root that bounds all paths used by the operation.
 * @param root0.profile - Named runtime, graph, transport, or measurement profile selecting the closed behavior to execute.
 * @param root0.mainMemoryMode - Expected main-module memory mode used to verify link-profile structure.
 */
export const inspectLeanLinkProfile = async ({
	root
	, profile
	, mainMemoryMode
}) => {
	const main = await loadWasm(`${root}/${profile}/main.wasm`);
	const mainImports = WebAssembly.Module.imports(main.module);
	const mainExports = WebAssembly.Module.exports(main.module);
	const label = `${root}/${profile} main`;
	inspectMainMemoryAndTable({
		artifact: main
		, imports: mainImports
		, exports: mainExports
		, mainMemoryMode
		, label
	});
	assertNoLeanRuntimeImports(mainImports, label);

	const mainFunctionExports = new Set(
		byKind(mainExports, "function").map(entry => entry.name),
	);
	for(const library of SIDE_LIBRARIES)
	{
		const side = await loadWasm(
			`${root}/${profile}/${library.name}.so.wasm`,
		);
		const sideImports = WebAssembly.Module.imports(side.module);
		const sideExports = WebAssembly.Module.exports(side.module);

		assert.deepEqual(byKind(sideImports, "memory"), [
			{ module: "env", name: "memory", kind: "memory" }
		]);
		assert.deepEqual(byKind(sideImports, "table"), [
			{ module: "env", name: "__indirect_function_table", kind: "table" }
		]);
		assert.equal(definedMemoryCount(side.bytes), 0);
		assert.equal(definedTableCount(side.bytes), 0);
		assert.deepEqual(byKind(sideExports, "memory"), []);
		assert.deepEqual(byKind(sideExports, "table"), []);

		const functionImports = byKind(sideImports, "function")
      .filter(entry => entry.module === "env")
      .map(entry => entry.name);
		for(const symbol of functionImports)
		{
			assert.ok(
				mainFunctionExports.has(symbol),
				`${root}/${profile} main must export ${symbol} for ${library.name}`,
			);
		}

		await inspectSideLinkMap(root, profile, library);
	}

	for(const runtimeSymbol of [
		"lean_notify_assert"
		, "lean_inc_heartbeat"
		, "lean_internal_panic_out_of_memory"
		, "lean_dec_ref_cold"
	]) {
		assert.equal(
			mainFunctionExports.has(runtimeSymbol),
			true,
			`${root}/${profile} main must own ${runtimeSymbol}`,
		);
	}

	for(const lifecycleSymbol of [
		"bridge_lean_runtime_init"
		, "bridge_lean_runtime_status"
		, "bridge_lean_runtime_init_runs"
		, "bridge_lean_library_init_runs"
		, "bridge_lean_runtime_shutdown"
	]) {
		assert.equal(
			mainFunctionExports.has(lifecycleSymbol),
			true,
			`${root}/${profile} main must export ${lifecycleSymbol}`,
		);
	}
};

/**
 * Inspects final static profile and returns the structured evidence required by the structural acceptance tests.
 *
 * @param root0 - Named inputs and dependency overrides used to inspect final static profile.
 * @param root0.root - Filesystem root that bounds all paths used by the operation.
 * @param root0.mainMemoryMode - Expected main-module memory mode used to verify link-profile structure.
 */
export const inspectFinalStaticProfile = async ({ root, mainMemoryMode }) => {
	const path = `${root}/final-static/main.wasm`;
	const main = await loadWasm(path);
	const imports = WebAssembly.Module.imports(main.module);
	const exports = WebAssembly.Module.exports(main.module);
	inspectMainMemoryAndTable({
		artifact: main
		, imports
		, exports
		, mainMemoryMode
		, label: path
	});
	assertNoLeanRuntimeImports(imports, path);

	const linkMap = await readFile(`${root}/final-static/main.link.map`, "utf8");
	const symbols = plainLinkSymbols(linkMap);
	for(const symbol of [
		"initialize_Init"
		, "lean_dec_ref_cold"
		, "lean_notify_assert"
		, "lean_internal_panic_out_of_memory"
		, ...SIDE_LIBRARIES.flatMap(library => library.definitions)
	]) {
		assert.equal(
			symbols.filter(candidate => candidate === symbol).length,
			1,
			`${path} must define ${symbol} exactly once`,
		);
	}
};
