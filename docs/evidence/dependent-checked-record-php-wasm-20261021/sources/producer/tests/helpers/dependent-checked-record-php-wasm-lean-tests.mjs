/**
 * Fresh Lean compiler controls for the four closed dependent checked-record
 * PHP-Wasm routes. These are source/compiler checks, not installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildElaboratedComponent } from "../../src/build/elaborated-component.mjs";
import { createCompiledPhpWasmModel } from "../../src/build/php-wasm-graph-model.mjs";
import { generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { generateNativePrimitiveC } from "../../src/backends/c/native-primitives.mjs";
import {
	dependentCheckedRecordRoutes, dependentCheckedRecordFixture
} from "./dependent-checked-record-browser-fixture.mjs";
import { dependentCheckedRecordPhpLeanModule } from "./dependent-checked-record-php-fixture.mjs";
import {
	checkDependentCheckedRecordPhpWasmModel
	, dependentCheckedRecordPhpWasmSelection
} from "./dependent-checked-record-php-wasm-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const flag = process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_WASM_LEAN_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag));

for(const route of dependentCheckedRecordRoutes)
	test(`fresh Lean PHP-Wasm dependent checked-record ${route}`, {
		skip: flag !== "1", timeout: 600_000
	}, async t => {
		const records = resolve(
			process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PHP_WASM_LEAN_OUTPUT
				?? "build/dependent-checked-record-php-wasm-lean", route
		);
		await assert.rejects(access(records), { code: "ENOENT" });
		await mkdir(records, { recursive: true });
		const directory = await mkdtemp(join(
			tmpdir(), "lean-bridge-dependent-php-wasm-lean-"
		));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(directory, { recursive: true });
			else t.diagnostic(`Retained dependent compiler probe: ${directory}`);
		});
		const selection = dependentCheckedRecordPhpWasmSelection(route);
		const projectRoot = join(directory, "project");
		const outputRoot = join(directory, "release");
		await cp(dependentCheckedRecordFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json"
			, canonicalJson(selection.configuration));
		if(selection.reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json"
			, canonicalJson(selection.expected));
		let observed;
		const stopped = new Error(
			"Dependent PHP-Wasm adapters compiled; stop before C compilation"
		);
		const compileComponent = async ({ model, adapters, generatedC }) => {
			observed = { model, adapters, c: await readFile(generatedC, "utf8") };
			throw stopped;
		};
		const options = {
			projectRoot, outputRoot
			, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX
				?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
			, targets: ["php-wasm"], profile: "php-wasm-copied-v1"
			, receiptName: "php-wasm-component.json"
			, createModel: createCompiledPhpWasmModel
			, createAdapters: generateNativeLeanAdapters, compileComponent
		};
		await assert.rejects(buildElaboratedComponent(options), error => {
			if(error !== stopped)
			{
				error.message += ": " + JSON.stringify(error.details);
				throw error;
			}
			return true;
		});
		await assert.rejects(access(outputRoot), { code: "ENOENT" });
		assert.ok(observed);
		checkDependentCheckedRecordPhpWasmModel(observed.model, route);
		assert.ok(observed.c.includes('#include "component.h"'));
		const provider = generateNativePrimitiveC(observed.model, {
			initializer: `initialize_${observed.adapters.module}`
		});
		for(const item of observed.model.exports)
			item.refinements.parameters.forEach((refinement, index) => {
				if(refinement?.kind !== "checked-record") return;
				assert.ok(provider.includes(`${item.symbol}_refinement_${index}(`));
				assert.ok(provider.includes(`was rejected by ${refinement.constructor}`));
				assert.ok(observed.adapters.leanSource.includes(
					`@[export ${item.symbol}_refinement_${index}]`
				));
			});
		await saveLakeFile(records, "model.json", canonicalJson(observed.model));
		await saveLakeFile(records, "adapters.lean", observed.adapters.leanSource);
		await saveLakeFile(records, "generated.c", observed.c);
		await saveLakeFile(records, "provider.c", provider);
		t.diagnostic(JSON.stringify({
			sourceCompilationOnly: true, route
			, module: dependentCheckedRecordPhpLeanModule
			, pointerBits: observed.model.pointerBits
			, exports: observed.model.exports.length
			, generatedCSha256: sha256(observed.c), installedAcceptance: false
		}));
		complete = true;
	});
