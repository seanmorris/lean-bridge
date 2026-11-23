/** @file Build the read-only test observer; never include it in a release. */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { processBuildRunner } from "../../src/build/process-runner.mjs";

/**
 * Compile a Zend extension against the same broker as the installed packages.
 *
 * @param options - Prepared runtime and headers, Emscripten SDK and private test output.
 */
export const buildPhpWasmBrokerSnapshot = async options => {
	const { runtimeRoot, runtimeLibrary, phpSource, emsdkRoot, output } = options;
	const includes = ["", "Zend", "main", "TSRM", "ext"].map(dir=>resolve(phpSource,dir));
	includes.push(resolve(runtimeRoot,"include"));
	const source = fileURLToPath(new URL("../fixtures/php-wasm-sync-io-probe/snapshot.c",import.meta.url));
	const args = ["-O2","-shared","-fPIC","-sSIDE_MODULE=2"
		, "-sEXPORTED_FUNCTIONS=['_get_module']"
		, ...includes.flatMap(path=>["-I",path]),source
		, join(resolve(runtimeRoot),runtimeLibrary),"-o",resolve(output)];
	const command = resolve(emsdkRoot,"upstream/emscripten/emcc");
	const env = { ...process.env, EM_CONFIG: resolve(emsdkRoot,".emscripten"), EMSDK: resolve(emsdkRoot) };
	await processBuildRunner.capture({command,args,cwd: dirname(resolve(output)),env});
};
