/** @file Link a private, single-entry Zend extension from the freshly compiled IO component. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { compilePhpWasmSyncSurface } from "../backends/php/io-surface.mjs";
import { phpWasmIOZendRecipe } from "./php-wasm-io-replay.mjs";
import { phpWasmHeaderPaths } from "../release/php-wasm-compiler-inputs.mjs";
import { validatePhpWasmCopiedBinary } from "./php-wasm-copied-artifacts.mjs";

const capture = async root => {
	const files = {};
	for(const key of await phpWasmHeaderPaths(root))
	{
		const b = await readFile(join(root, key)); files[key] = { bytes: b.length, sha256: sha256(b) };
	}
	if(!["main/php_config.h", "main/php.h", "Zend/zend.h", "TSRM/TSRM.h"].every(k => files[k]))
		throw new Error("PHP-Wasm IO needs configured Zend headers");
	return sha256(canonicalJson(files));
};

/**
 * Use checked target headers and reconstruct the public model from Lean
 * evidence. Export only the Zend loader symbol; never publish the wire ABI.
 *
 * @param options - Fresh build state and PHP header directory owned by the enclosing build.
 */
export const linkPhpWasmIOExtension = async options => {
	const { app, core, compiler, flags, phpSource, name, version } = options;
	const bindingIrSha256 = hashBindingIr(core.api), phpHeadersSha256 = await capture(phpSource);
	const model = compilePhpWasmSyncSurface({ name, version, api: core.api, evidence: core.evidence, bindingIrSha256 });
	if(model.wire.source !== core.wire.source) throw new Error("Reconstructed PHP-Wasm IO wire differs from the compiled component");
	const { zendIdentity, gen, files } = await phpWasmIOZendRecipe({ model, componentIdentity: core.componentIdentity, phpHeadersSha256, bindingIrSha256 });
	const objects = [...core.objects];
	const inc = ["", "main", "Zend", "TSRM", "ext"].flatMap(d => ["-I", join(phpSource, d)]);
	await writeFile(join(app, "php-io-port.h"), gen.port.header, { flag: "wx" });
	for(const [file, src] of [["io-port", gen.port.source], ["io-zend", gen.source]])
	{
		const source = join(app, file + ".c"), object = join(app, file + ".o");
		await writeFile(source, src, { flag: "wx" });
		await compiler.run(compiler.emcc, [...flags, ...inc, "-c", source, "-o", object]); objects.push(object);
	}
	const library = join(app, gen.library);
	await compiler.run(compiler.emcc, ["-O2", "-g0", "-fPIC", "-sSIDE_MODULE=2", "-sEXPORTED_FUNCTIONS=['_get_module']", "-Wl,--no-entry", ...objects, core.runtimeLibrary, "-o", library]);
	const bytes = await readFile(library); await validatePhpWasmCopiedBinary(bytes, true);
	if(await capture(phpSource) !== phpHeadersSha256) throw new Error("PHP-Wasm IO Zend headers changed during compilation");
	const receipt = { schemaVersion: 1
		, profile: "php-wasm-sync-io-v1"
		, name, version, componentIdentity: core.componentIdentity
		, runtimeIdentity: core.runtimeIdentity, phpHeadersSha256, bindingIrSha256
		, zendIdentity, library: gen.library, librarySha256: sha256(bytes) };
	return { model, library, files, transport: gen.transport, sha256: receipt.librarySha256, zendIdentity, bindingIrSha256, phpHeadersSha256, receipt };
};
