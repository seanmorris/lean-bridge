/** @file Exercise generated PHP declarations, including public lazy loading. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { createPhpWasmCopiedDescriptor } from "../../src/backends/php/php-wasm-copied-host.mjs";
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Mount real generated source files and call the user-facing functions from PHP.
 *
 * @param options - Fresh module, runtime and installed PhpNode constructor.
 */
export const exercisePhpWasmIOPublic = async options => {
	const { PhpNode, core, app, t } = options;
	const zend = core.zend, name = basename(zend.library), urls = {};
	const bootstrap = "<?php require_once __DIR__.'/dependencies/brick-math/autoload.php'; require_once __DIR__.'/src/Api.php';";
	for(const [key, data] of Object.entries({ ...bundledBrickMath(), ...zend.files, "bootstrap.php": bootstrap }))
	{
		const path = join(app,"php",key); await mkdir(dirname(path),{recursive: true});
		await writeFile(path,data,{flag: "wx"}); urls[key]=pathToFileURL(path);
	}
	const registration = join(app,"lazy-library.txt"); await writeFile(registration,name,{flag: "wx"});
	const { "src/Api.php": api, "src/Internal/Native.php": native, ...extras } = urls;
	const host = new URL("../../src/backends/php/php-wasm-copied-host.mjs",import.meta.url);
	const runtime = { identity: core.runtimeIdentity, loaderIdentity: sha256(await readFile(host)), library: basename(core.runtimeLibrary), url: pathToFileURL(core.runtimeLibrary) };
	const component = { id: core.api.component.id, identity: zend.zendIdentity, runtimeIdentity: core.runtimeIdentity, namespace: zend.model.namespace, library: name, composer: "lean-bridge/ledger" };
	const descriptor = createPhpWasmCopiedDescriptor(runtime,component,{ library: pathToFileURL(zend.library), registration: pathToFileURL(registration), api, native, php: extras });
	const consumer = await readFile("tests/fixtures/php-wasm-sync-io-probe/consumer.php","utf8");
	const codec = await readFile("tests/fixtures/php-wasm-sync-io-probe/codec.php","utf8");
	for(const loading of ["startup","lazy"])
	{
		const startup = loading === "startup", seen = [];
		const php = new PhpNode({ version: "8.4", autoTransaction: false
			, sharedLibs: startup ? [descriptor] : []
			, dynamicLibs: startup ? [] : [descriptor.lazy]
			, locateFile: file => { if(file === name) seen.push(file); } });
		let stdout = "", stderr = "";
		php.addEventListener("output", e => { stdout += e.detail.join(""); });
		php.addEventListener("error", e => { stderr += e.detail.join(""); });
		await php.binary;
		await php.writeFile("/consumer.php", consumer); await php.writeFile("/codec.php",codec);
		const code = await php.run(`<?php require '${descriptor.autoload}'; try { \\LeanLedger\\add(1); } catch (TypeError $e) {}`);
		assert.equal(code,0,stderr || stdout); assert.equal(seen.length,startup ? 1 : 0);
		const vectors = await php.run("<?php require '/codec.php';");
		assert.equal(vectors,0,stderr || stdout); assert.equal(stderr,""); assert.equal(stdout,"codec:21"); stdout="";
		assert.equal(seen.length,startup ? 1 : 0);
		const result = await php.run("<?php require '/consumer.php';");
		assert.equal(result,0,stderr || stdout); assert.equal(stderr,""); assert.equal(stdout,"php-api:30");
		assert.deepEqual(seen,[name]); t.diagnostic(`${loading}: ${stdout}`);
	}
};
