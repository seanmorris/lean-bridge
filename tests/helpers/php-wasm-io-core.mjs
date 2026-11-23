/** @file Exercise the private compiled IO core inside the pinned PHP-Wasm VM. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { compilePhpWasmIOCore } from "../../src/build/php-wasm-io-core.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { exercisePhpWasmIOPublic } from "./php-wasm-io-public.mjs";

const environment = process.env, runtimeRoot = environment.LEAN_BRIDGE_PHP_WASM_IO_RUNTIME;
test("PHP-Wasm IO core rejects unsupported effects and scheduling before compiling", async () => {
	const base = { synchronousIO: true, nativeEffects: [], hostImportsSourceSha256: null };
	for(const change of [{ nativeEffects: undefined }
		, { nativeEffects: ["filesystem"] }
		, { taskExports: ["Ledger.task"] }
		, { asyncIterators: [{}] }
		, { leanResources: ["Ticket"] }
		, { hostImportsSourceSha256: "0".repeat(64) }])
		await assert.rejects(compilePhpWasmIOCore({ projectContract: { ...base, ...change } }), /in-memory effects/);
});

test("PHP-Wasm IO core runs state and distinct typed failures in installed PHP 8.4", { skip: !runtimeRoot, timeout: 600_000 }, async t => {
	const project = resolve("tests/fixtures/php-wasm-sync-io"), emsdkRoot = resolve(environment.LEAN_BRIDGE_PHP_WASM_EMSDK);
	const hostRoot = resolve(environment.LEAN_BRIDGE_PHP_WASM_HOST);
	assert.equal(JSON.parse(await readFile(join(hostRoot, "package.json"))).version, "0.1.0");
	const { PhpNode } = await import(pathToFileURL(join(hostRoot, "PhpNode.mjs")));
	const app = await mkdtemp(join(environment.LEAN_BRIDGE_PHP_WASM_IO_WORK ?? tmpdir(), "php-wasm-io-core-"));
	if(!environment.LEAN_BRIDGE_PHP_WASM_IO_WORK) t.after(() => rm(app, { recursive: true, force: true }));
	const { configurationRecord: record, inputs, project: facts, sourceTreeSha256 } = await inspectLeanProject(project);
	const config = record.configuration, source = await readFile(join(project, "Ledger.lean"), "utf8");
	assert.equal(sha256(source), inputs.find(f => f.path === "Ledger.lean").sha256);
	const projectContract = { ...config, synchronousIO: true
		, component: elaboratedComponent(facts)
		, sourceTreeSha256
		, configurationSha256: record.sha256
		, hostImportsSourceSha256: null };
	const runner = { capture: async options => {
		try
		{ return await processBuildRunner.capture(options); }
		catch(error)
		{ t.diagnostic(error.details?.stderr ?? error.message); throw error; }
	} };
	const core = await compilePhpWasmIOCore({ app
		, runtimeRoot, emsdkRoot, projectContract
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, zend: environment.LEAN_BRIDGE_PHP_WASM_IO_HEADERS && { ...config.targets["php-wasm"].composer, phpSource: environment.LEAN_BRIDGE_PHP_WASM_IO_HEADERS }
		, sources: [{ module: "Ledger", source }], runner });
	const macros = core.wire.methods.map(m => {
		const name = m.declaration.split(".").pop().toUpperCase();
		return `int ${m.symbol}(const uint64_t *, uint64_t *, uint8_t *);\n#define ${name} ${m.symbol}`;
	});
	await writeFile(join(app, "test-methods.h"), `#include <stdint.h>\nvoid ${core.wire.clear}(uint64_t *);\n#define CLEAR ${core.wire.clear}\n${macros.join("\n")}\n`);
	const name = "ledger-io-probe.so", library = join(app, name);
	await runner.capture({ command: join(emsdkRoot, "upstream/emscripten/emcc")
		, args: ["-O2"
			, "-fPIC", "-fvisibility=hidden", "-sSIDE_MODULE=2", "-Wl,--no-entry"
			, "-I", app, "-I", join(runtimeRoot, "include")
			, resolve("tests/fixtures/php-wasm-sync-io-probe/check.c")
			, ...core.objects
			, core.runtimeLibrary
			, "-o"
			, library]
		, cwd: app
		, env: { ...environment, EM_CONFIG: join(emsdkRoot, ".emscripten"), EMSDK: emsdkRoot } });
	const libs = [core.runtimeLibrary, library].map(path => ({ name: path.split("/").pop(), url: pathToFileURL(path).href, ini: false }));
	const php = new PhpNode({ version: "8.4", autoTransaction: false, sharedLibs: libs, dynamicLibraries: [name] });
	let stdout = "", stderr = "";
	php.addEventListener("output", e => { stdout += e.detail.join(""); });
	php.addEventListener("error", e => { stderr += e.detail.join(""); });
	await php.binary;
	assert.equal(await php.run('<?php echo PHP_VERSION, ":", PHP_INT_SIZE, ":", file_get_contents("/ledger-check.txt");'), 0);
	assert.equal(stderr, ""); assert.equal(stdout, "8.4.1:4:ok 27");
	t.diagnostic(`${stdout} (runtime ${core.runtimeIdentity}, component ${core.componentIdentity})`);
	if(core.zend)
	{
		const { model, library, transport } = core.zend;
		const methods = Object.fromEntries(model.methods.map((m, i) => [m.declaration, { ...m, entry: "\\"+transport+"\\call"+i }]));
		assert.equal(methods["Ledger.add"].returnType, "\\Brick\\Math\\BigInteger");
		assert.equal(methods["Ledger.signed"].returnType, "int");
		const zend = new PhpNode({ version: "8.4", autoTransaction: false, sharedLibs: [libs[0], { name: library.split("/").pop(), url: pathToFileURL(library).href, ini: true }] });
		let result = "", errors = "";
		zend.addEventListener("output", e => { result += e.detail.join(""); });
		zend.addEventListener("error", e => { errors += e.detail.join(""); });
		await zend.binary;
		const call = d => methods["Ledger."+d].entry;
		assert.equal(await zend.run(`<?php
$word = pack("V2", 15, 0);
if (${call("add")}($word) !== "\\0\\0".$word) throw new Exception("stateful IO");
if (${call("add")}(pack("V2", 1, 1))[0] !== chr(5)) throw new Exception("narrowing");
if (${call("readTotal")}() !== "\\0\\0".$word) throw new Exception("state changed");
foreach ([0,1] as $fail) {
    if (${call("choose")}(pack("V2",$fail,0),pack("V2",1,0),"a\\0b") !== chr($fail ? 3 : 0)."\\1a\\0b") throw new Exception("EIO vs Except");
}
try { ${call("add")}(15); throw new Exception("accepted number as bytes"); } catch (TypeError $e) {}
echo PHP_VERSION, ":", PHP_INT_SIZE, ":zend";
`), 0, errors);
		assert.equal(errors, ""); assert.equal(result, "8.4.1:4:zend");
		t.diagnostic(`${result} (extension ${core.zend.sha256}, headers ${core.zend.phpHeadersSha256})`);
		await exercisePhpWasmIOPublic({ PhpNode, core, app, t });
	}
	const forbidden = await mkdtemp(join(app, "effect-policy-"));
	const fileIO = source.replace("def add (amount : USize) : IO USize := do", 'def add (amount : USize) : IO USize := do\n  IO.FS.writeFile "unwanted" "effect"');
	await assert.rejects(compilePhpWasmIOCore({ app: forbidden
		, runtimeRoot, emsdkRoot, projectContract
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, sources: [{ module: "Ledger", source: fileIO }]
		, runner }), /requires nativeEffects "filesystem"/u);
	assert.ok(!(await readdir(forbidden)).some(f => f.endsWith(".o") || f.endsWith(".so") || f === "unwanted"));
});
