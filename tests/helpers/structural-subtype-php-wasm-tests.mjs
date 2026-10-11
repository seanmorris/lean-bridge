/**
 * Source and negative controls for the complete wasm32 structural Subtype caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypePhpCaller } from "./structural-subtype-php-fixture.mjs";
import { adaptStructuralSubtypePhpWasm, structuralSubtypePhpWasmCaller, structuralSubtypePhpWasmConfiguration, structuralSubtypePhpWasmExpected, structuralSubtypePhpWasmRequest, checkStructuralSubtypePhpWasmExecutions } from "./structural-subtype-php-wasm-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import "./structural-subtype-php-wasm-evidence-tests.mjs";

test("structural PHP-Wasm preserves every native assertion and both independent author routes", async () => {
	for(const route of ["ordinary", "reviewed"])
	{
		const configuration = structuralSubtypePhpWasmConfiguration(route), common = structuralSubtypeConfiguration(route, ["c"]);
		validateExportConfiguration(configuration);
		assert.deepEqual({ ...configuration, targets: common.targets }, common);
		const native = await structuralSubtypePhpCaller(route);
		for(const mode of ["weak", "strict"])
		{
			const source = await structuralSubtypePhpWasmCaller(route, mode);
			// Compare both complete function bodies, not selected keywords or assertion counts.
			const end = native.indexOf("\nif (realpath(");
			assert.equal(source.slice(source.indexOf("use Brick"), source.indexOf("\n{\n    $api =")), native.slice(native.indexOf("use Brick"), end));
			assert.ok(source.includes(`declare(strict_types=${mode === "strict" ? 1 : 0});`));
			assert.ok(!source.includes("require 'vendor/autoload.php';"));
			assert.ok(source.includes("PHP_INT_SIZE * 8"));
		}
		for(const change of [source => source.replace("declare(strict_types=0);", "declare(strict_types=1);")
			, source => source.replace("require 'vendor/autoload.php';", "require 'elsewhere.php';")
			, source => source.replace("echo json_encode", "echo 1; // json_encode")
			, source => source + "// changed tail\n"])
			assert.throws(() => adaptStructuralSubtypePhpWasm(change(native), "weak"));
	}
	assert.throws(() => structuralSubtypePhpWasmConfiguration("unknown"));
	await assert.rejects(structuralSubtypePhpWasmCaller("ordinary", "unknown"));
	assert.throws(() => structuralSubtypePhpWasmRequest("unknown"));
	for(const arrangement of ["embedded", "composer"])
	{
		const request = JSON.parse(structuralSubtypePhpWasmRequest(arrangement));
		assert.equal(request.module, "LeanStructuralsubtypes");
		assert.deepEqual(request.operations, { probe: "arrays" });
	}
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("structural PHP-Wasm entry files parse in both lexical modes and author routes", {
	skip: !process.env.LEAN_BRIDGE_PHP && !existsSync(php) && "Select LEAN_BRIDGE_PHP for syntax controls"
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-php-wasm-caller-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of ["ordinary", "reviewed"]) for(const mode of ["weak", "strict"])
	{
		const path = `${route}-${mode}.php`;
		await saveLakeFile(root, path, await structuralSubtypePhpWasmCaller(route, mode));
		assert.equal((await runCopied(php, ["-n", "-l", path], root)).stderr, "");
	}
});

test("structural PHP-Wasm refuses omitted contexts, reduced corpus counts and incorrect loading phases", () => {
	const evidence = { component: { library: "component.so" }
		, runtime: { library: "runtime.so" }
		, executions: phpWasmExecutionTuples.map(tuple => {
			const [realm, arrangement, loading, mode] = tuple.split("/");
			return { realm, arrangement, loading, mode
				, observation: { ...structuralSubtypePhpWasmExpected }
				, phases: ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage, libraries: loading === "startup" || stage === "complete" ? ["component.so", "runtime.so"] : [] })) };
		})
	};
	checkStructuralSubtypePhpWasmExecutions(evidence);
	for(let index = 0; index < evidence.executions.length; index++)
	{
		const missing = structuredClone(evidence); missing.executions.splice(index, 1);
		assert.throws(() => checkStructuralSubtypePhpWasmExecutions(missing));
		for(const key of Object.keys(structuralSubtypePhpWasmExpected))
		{
			const altered = structuredClone(evidence); altered.executions[index].observation[key] = 0;
			assert.throws(() => checkStructuralSubtypePhpWasmExecutions(altered));
		}
		const altered = structuredClone(evidence); altered.executions[index].phases.pop();
		assert.throws(() => checkStructuralSubtypePhpWasmExecutions(altered));
	}
	const duplicate = structuredClone(evidence); duplicate.executions[0] = duplicate.executions[1];
	assert.throws(() => checkStructuralSubtypePhpWasmExecutions(duplicate));
});
