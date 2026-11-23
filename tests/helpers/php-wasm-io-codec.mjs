/** @file Run byte-exact value conversions in 32-bit PHP without requiring a compiler. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { generatePhpWasmIOFiles } from "../../src/backends/php/php-wasm-io-files.mjs";

const host = process.env.LEAN_BRIDGE_PHP_WASM_HOST;
test("PHP-Wasm IO codecs agree with independent byte vectors on 32-bit Zend", { skip: !host }, async () => {
	const { PhpNode } = await import(pathToFileURL(join(resolve(host),"PhpNode.mjs")));
	const php = new PhpNode({ version: "8.4", autoTransaction: false });
	let stdout = "", stderr = "";
	php.addEventListener("output", event => { stdout += event.detail.join(""); });
	php.addEventListener("error", event => { stderr += event.detail.join(""); });
	await php.binary;
	// Generate the real Ok/Err value classes for sum vectors. No method is invoked.
	const methods = [{ declaration: "Ledger.sample", publicName: "sample"
		, effect: "BaseIO", parameters: [], args: [], result: ["bool","string"]
		, tagBytes: 1, returnType: "Ok|Err" }];
	const key = "0".repeat(64), model = { namespace: "LeanLedger", methods, phpWasm: true };
	const files = await generatePhpWasmIOFiles(model,{ library: "php8.4-lb_wasm_io_"+key+".so", transport: "LeanBridge\\WasmIO\\C"+key });
	const root = "/vendor/lean-bridge/ledger/", dirs = new Set();
	const bootstrap = "<?php require_once __DIR__.'/dependencies/brick-math/autoload.php'; require_once __DIR__.'/src/Api.php';";
	for(const [key, bytes] of Object.entries({ ...bundledBrickMath(), ...files, "bootstrap.php": bootstrap }))
	{
		const path = root+key; let parent = "";
		for(const dir of path.slice(1).split("/").slice(0,-1))
		{
			parent += "/"+dir;
			if(!dirs.has(parent))
			{ await php.mkdir(parent); dirs.add(parent); }
		}
		await php.writeFile(path,bytes);
	}
	const sample = await readFile("tests/fixtures/php-wasm-sync-io-probe/codec.php","utf8");
	await php.writeFile("/codec.php",sample);
	const code = await php.run("<?php require '/codec.php';");
	assert.equal(code,0,stderr || stdout); assert.equal(stderr,""); assert.equal(stdout,"codec:21:malformed:22:limit:1");
});
