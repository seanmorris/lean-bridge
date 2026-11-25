/** @file Run byte-exact value conversions in 32-bit PHP without requiring a compiler. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { generatePhpWasmIOFiles } from "../../src/backends/php/php-wasm-io-files.mjs";

const host = process.env.LEAN_BRIDGE_PHP_WASM_HOST;
const runVector = async (methods, fixture, expected, privateTransport=false) => {
	const { PhpNode } = await import(pathToFileURL(join(resolve(host),"PhpNode.mjs")));
	const php = new PhpNode({ version: "8.4", autoTransaction: false });
	let stdout = "", stderr = "";
	php.addEventListener("output", event => { stdout += event.detail.join(""); });
	php.addEventListener("error", event => { stderr += event.detail.join(""); });
	await php.binary;
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
	const sample = await readFile("tests/fixtures/php-wasm-sync-io-probe/"+fixture,"utf8");
	await php.writeFile("/codec.php",privateTransport ? sample.replace("__TRANSPORT__","LeanBridge\\WasmIO\\C"+key) : sample);
	const code = await php.run("<?php require '/codec.php';");
	assert.equal(code,0,stderr || stdout); assert.equal(stderr,""); assert.equal(stdout,expected);
};
// Generate the real Ok/Err value classes for sum vectors. No method is invoked.
test("PHP-Wasm IO codecs agree with independent byte vectors on 32-bit Zend", {skip: !host}, () => runVector(
	[{declaration: "Ledger.sample",publicName: "sample",effect: "BaseIO",parameters: [],args: [],result: ["bool","string"],tagBytes: 1,returnType: "Ok|Err"}],
	"codec.php","codec:21:malformed:22:limit:1"));
test("PHP-Wasm cursor decoder retires malformed open and pull frames but not declared failures", {skip: !host}, () => runVector(
	[{declaration: "Lab.checked",stepDeclaration: "Lab.step"
		, publicName: "checked",effect: "EIO",delivery: "iterator"
		, parameters: []
		, args: []
		, result: "unit"
		, error: "string"
		, terminal: "string"
		, tagBytes: 1
		, returnType: "null"
		, failure: "CheckedError"
		, terminalFailure: "CheckedStepError"}],"cursor-frames.php","frames:7;retired:5;closed:5",true));
