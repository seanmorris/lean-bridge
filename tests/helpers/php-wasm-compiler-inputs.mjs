/**
 * Inert, structurally valid inputs for bundle tests. Never claims Lean execution.
 *
 * @file
 */
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { phpWasmCopiedPins as pins, phpWasmCopiedCompilerFiles } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { phpWasmPhpLicenses } from "../../src/release/php-wasm-compiler-inputs.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Supply a nonexecuting side module, placeholder headers and license fixtures.
 *
 * @param root - Test-owned scratch root.
 */
export const createPhpWasmCompilerInputFixture = async root => {
	const runtimeRoot = join(root, "runtime"), phpSource = join(root, "php"), projectRoot = join(root, "engine");
	const files = {}, inputFiles = {}, identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
	for(const name of ["lean.h", "lean_gmp.h", "lean_libuv.h", "config.h", "version.h"])
	{
		const bytes = "/* inert header fixture */\n";
		await saveLakeFile(runtimeRoot, `include/lean/${name}`, bytes);
		files[`include/lean/${name}`] = inputFiles[`cmake/include/lean/${name}`] = identity(bytes);
	}
	const broker = "/* inert broker fixture */\n";
	await saveLakeFile(runtimeRoot, "include/lean_bridge_native_runtime.h", broker);
	files["include/lean_bridge_native_runtime.h"] = identity(broker);
	for(const path of ["source/.lean-wasm-patched", "cmake/lib/lean/libInit.a", "cmake/lib/lean/libleanrt.a"]) inputFiles[path] = identity("fixture");
	const compiler = { version: `emcc fixture ${pins.emscriptenVersion} (${pins.emscriptenCommit})`, emsdkCommit: pins.emsdkCommit, files: Object.fromEntries(phpWasmCopiedCompilerFiles.map(path => [path, identity("fixture")])) };
	const inputs = { files: inputFiles, brokerSha256: sha256(broker), libuvSha256: sha256("fixture") };
	const profile = "php-wasm-copied-v1", key = sha256(canonicalJson({ profile, pins, compiler, inputs })).slice(0, 20);
	const library = `lib/liblean_bridge_php_wasm_copied_${key}.so`;
	const name = value => [Buffer.byteLength(value), ...Buffer.from(value)];
	const imports = [2, ...name("env"), ...name("memory"), 2, 0, 1, ...name("env"), ...name("__indirect_function_table"), 1, 0x70, 0, 0];
	const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0, 2, imports.length, ...imports]);
	await saveLakeFile(runtimeRoot, library, wasm); files[library] = identity(wasm);
	await saveLakeFile(runtimeRoot, "runtime.json", canonicalJson({ schemaVersion: 1, profile, pointerBits: 32, pins, compiler, inputs, library, files }));
	for(const path of ["config.h", "main/php.h", "Zend/zend.h", "TSRM/TSRM.h", "ext/fixture.h"]) await saveLakeFile(phpSource, path, "/* inert PHP header */\n");
	await saveLakeFile(phpSource, "main/php_config.h", "#define SIZEOF_LONG 4\n#define SIZEOF_SIZE_T 4\n");
	await saveLakeFile(phpSource, "main/php_version.h", "#define PHP_VERSION_ID 80401\n");
	await saveLakeFile(phpSource, ".lean-bridge-configured", `${pins.phpCommit}:${pins.phpWasmCommit}:${pins.emscriptenCommit}\n`);
	for(const path of phpWasmPhpLicenses) await saveLakeFile(phpSource, path, `Fixture notice: ${path}\n`);
	await saveLakeFile(projectRoot, "LICENSE", "Fixture Lean Bridge notice\n");
	await saveLakeFile(projectRoot, "notices/php-wasm.txt", "Fixture PHP-Wasm notice\n");
	for(const path of ["NOTICE.txt", "lean.txt", "lean-bundled.txt", "emscripten.txt", "llvm.txt", "musl.txt", "libuv.txt"]) await saveLakeFile(projectRoot, `notices/runtime/${path}`, `Fixture runtime notice: ${path}\n`);
	return { runtimeRoot, phpSource, projectRoot };
};
