/**
 * Source-only controls for inherited checked-record PHP-Wasm packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { copiedPhpPublicSource, renderCopiedPhpPackage } from "../../src/backends/php/copied-values.mjs";
import { generateCopiedPhpZendAdapter } from "../../src/backends/php/copied-zend.mjs";
import {
	inheritedCheckedRecordNpmSelection
} from "./inherited-checked-record-npm-fixture.mjs";
import {
	inheritedCheckedRecordPhpCaller
	, inheritedCheckedRecordPhpCounts
} from "./inherited-checked-record-php-fixture.mjs";
import {
	adaptInheritedCheckedRecordPhpWasm
	, checkInheritedCheckedRecordPhpWasmExecutions
	, checkInheritedCheckedRecordPhpWasmModel
	, inheritedCheckedRecordPhpWasmCaller
	, inheritedCheckedRecordPhpWasmConfiguration
	, inheritedCheckedRecordPhpWasmConsumerFixture
	, inheritedCheckedRecordPhpWasmExpected
	, inheritedCheckedRecordPhpWasmModes
	, inheritedCheckedRecordPhpWasmRequest
	, inheritedCheckedRecordPhpWasmReview
	, inheritedCheckedRecordPhpWasmRoutes
	, inheritedCheckedRecordPhpWasmSelection
	, inheritedCheckedRecordPhpWasmSettings
} from "./inherited-checked-record-php-wasm-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("inherited checked-record PHP-Wasm selections require explicit installed work", () => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PHP_WASM_";
	const enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(inheritedCheckedRecordPhpWasmSelection({}), {
		enabled: false
		, routes: ["ordinary", "reviewed"]
		, modes: ["full", "result-only"]
		, maxLoad: 8
	});
	assert.equal(inheritedCheckedRecordPhpWasmSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => inheritedCheckedRecordPhpWasmSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", valid + ",", valid + "," + valid, true, null])
			assert.throws(() => inheritedCheckedRecordPhpWasmSelection({
				...enabled, [prefix + name]: raw
			}));
		for(const flag of [undefined, "0"])
			assert.throws(() => inheritedCheckedRecordPhpWasmSelection({
				[prefix + "TEST"]: flag, [prefix + name]: valid
			}));
		assert.deepEqual(inheritedCheckedRecordPhpWasmSelection({
			...enabled, [prefix + name]: valid
		})[name.toLowerCase()], [valid]);
	}
	for(const load of [8, 12, 16, 20])
		assert.equal(inheritedCheckedRecordPhpWasmSelection({
			...enabled, [prefix + "MAX_LOAD"]: String(load)
		}).maxLoad, load);
	for(const raw of ["", "7", "24", "eight", true, null])
		assert.throws(() => inheritedCheckedRecordPhpWasmSelection({
			...enabled, [prefix + "MAX_LOAD"]: raw
		}));
	for(const name of ["OUTPUT", "MAX_LOAD"])
		assert.throws(() => inheritedCheckedRecordPhpWasmSelection({
			[prefix + name]: "explicit"
		}));
});

test("inherited checked-record PHP-Wasm preserves both author contracts and proof-free results", () => {
	for(const route of inheritedCheckedRecordPhpWasmRoutes)
	for(const mode of inheritedCheckedRecordPhpWasmModes)
	{
		const original = inheritedCheckedRecordNpmSelection(`${route}-${mode}`);
		const configuration = inheritedCheckedRecordPhpWasmConfiguration(route, mode);
		validateExportConfiguration(configuration);
		assert.deepEqual(configuration, {
			...original.configuration
			, targets: { "php-wasm": inheritedCheckedRecordPhpWasmSettings }
		});
		const review = inheritedCheckedRecordPhpWasmReview(mode);
		validateBindingIr(review);
		assert.deepEqual(review, original.expected);
		assert.equal(review.declarations.length, mode === "full" ? 8 : 2);
		assert.deepEqual(review.types.find(type => type.name === "Ticket")
			.fields.map(field => field.name), ["toSpan", "word"]);
		assert.deepEqual(review.types.find(type => type.name === "Stamped")
			.fields.map(field => field.name), ["toTicket", "mark"]);
		assert.deepEqual(inheritedCheckedRecordPhpWasmExpected(mode), {
			...inheritedCheckedRecordPhpCounts[mode], word_bits: 32, php: "8.4.1"
		});
		if(mode === "full")
			assert.ok(review.types.some(type => type.name === "TicketAlias"));
		else assert.ok(!review.types.some(type => type.name === "TicketAlias"));
	}
	for(const invalid of [undefined, "", "unknown", false])
	{
		assert.throws(() => inheritedCheckedRecordPhpWasmConfiguration(invalid, "full"));
		assert.throws(() => inheritedCheckedRecordPhpWasmConfiguration("ordinary", invalid));
		assert.throws(() => inheritedCheckedRecordPhpWasmReview(invalid));
		assert.throws(() => inheritedCheckedRecordPhpWasmExpected(invalid));
	}
});

test("inherited checked-record PHP-Wasm caller changes only loading, strictness and host observations", async () => {
	for(const route of inheritedCheckedRecordPhpWasmRoutes)
	for(const mode of inheritedCheckedRecordPhpWasmModes)
	for(const strictness of ["weak", "strict"])
	{
		const original = await inheritedCheckedRecordPhpCaller(route, mode);
		const source = await inheritedCheckedRecordPhpWasmCaller(route, mode, strictness);
		assert.equal(source, adaptInheritedCheckedRecordPhpWasm(original, strictness));
		assert.ok(source.includes(`declare(strict_types=${strictness === "strict" ? 1 : 0});`));
		assert.equal(source.includes("require 'vendor/autoload.php'"), false);
		assert.equal(source.includes("$_SERVER['SCRIPT_FILENAME']"), false);
		assert.equal((source.match(/'word_bits' => PHP_INT_SIZE \* 8/gu) ?? []).length, 1);
		assert.ok(source.includes(`const INHERITED_CHECKED_RECORD_RESULT_ONLY = ${mode === "result-only" ? "true" : "false"};`));
		assert.ok(source.includes(`const INHERITED_PARAMETER_PREFIX = '${route === "reviewed" ? "value" : "arg"}';`));
		const body = original.slice(original.indexOf("\n", original.indexOf("declare("))
			, original.indexOf("if (realpath("));
		assert.ok(source.includes(body));
	}
	const original = await inheritedCheckedRecordPhpCaller("ordinary", "full");
	for(const changed of [
		original + "unknown", original + original
		, original.replace("declare(strict_types=0);", "declare(strict_types=1);")
		, original.replace("    require 'vendor/autoload.php';\n", "")
	]) assert.throws(() => adaptInheritedCheckedRecordPhpWasm(changed, "weak"));
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("inherited checked-record PHP-Wasm callers parse in weak and strict modes", {
	skip: !existsSync(php) && "Select LEAN_BRIDGE_PHP for syntax checks"
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-inherited-php-wasm-caller-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of inheritedCheckedRecordPhpWasmRoutes)
	for(const mode of inheritedCheckedRecordPhpWasmModes)
	for(const strictness of ["weak", "strict"])
	{
		const file = `${route}-${mode}-${strictness}.php`;
		await saveLakeFile(root, file
			, await inheritedCheckedRecordPhpWasmCaller(route, mode, strictness));
		const run = await runCopied(php, ["-n", "-l", join(root, file)], root);
		assert.equal(run.stderr, "");
		assert.ok(run.stdout.startsWith("No syntax errors detected in "));
	}
});

test("inherited checked-record PHP-Wasm lazy probes name selected exports", () => {
	for(const mode of inheritedCheckedRecordPhpWasmModes)
	for(const arrangement of ["embedded", "composer"])
	{
		const request = JSON.parse(
			inheritedCheckedRecordPhpWasmRequest(mode, arrangement)
		);
		assert.deepEqual(request, {
			module: "LeanInheritedcheckedrecords"
			, operations: { probe: mode === "full" ? "first" : "produce" }
			, autoload: arrangement === "composer" ? "vendor/autoload.php"
				: "vendor/lean-bridge-inheritedcheckedrecords/wasm/bootstrap.php"
		});
		assert.ok(inheritedCheckedRecordPhpWasmReview(mode).declarations.some(item =>
			item.id === `lean:InheritedCheckedRecords.${mode === "full" ? "first" : "produce"}`));
	}
	for(const invalid of [undefined, "", "bundled", true])
	{
		assert.throws(() => inheritedCheckedRecordPhpWasmRequest("full", invalid));
		assert.throws(() => inheritedCheckedRecordPhpWasmRequest(invalid, "embedded"));
	}
	const sources = { weak: "weak", strict: "strict" };
	const fixture = inheritedCheckedRecordPhpWasmConsumerFixture("full", sources);
	assert.equal(fixture.source("weak"), "weak");
	assert.equal(fixture.source("strict"), "strict");
	assert.deepEqual(fixture.settings, inheritedCheckedRecordPhpWasmSettings);
	assert.equal(JSON.parse(fixture.request("embedded")).operations.probe, "first");
	for(const invalid of [undefined, "", "reviewed", false])
		assert.throws(() => inheritedCheckedRecordPhpWasmConsumerFixture(invalid, sources));
	assert.throws(() => fixture.source("other"));
});

test("inherited checked-record PHP-Wasm models reject width, alias and refinement drift", t => {
	const project = tree => {
		if(tree === null || ["fin", "subtype"].includes(tree.kind)) return tree;
		const named = fields => ({
			fields: fields.map(field => field.name)
			, arguments: fields.map(field => project(field.refinement))
		});
		if(tree.kind === "checked-record") return {
			kind: tree.kind, definition: tree.name, constructor: tree.constructor
			, ...named(tree.fields)
		};
		if(tree.kind === "record") return {
			kind: tree.kind, definition: tree.name, ...named(tree.fields)
		};
		if(tree.kind === "variant") return {
			kind: tree.kind, definition: tree.name
			, cases: tree.cases.map(branch => ({ name: branch.name, ...named(branch.fields) }))
		};
		return { kind: tree.kind, arguments: tree.arguments.map(project) };
	};
	const exported = declaration => {
		const trees = declaration.source.extensions["lean-lang.org/refinements"];
		return {
			name: declaration.id.slice(5)
			, refinements: {
				parameters: trees.parameters.map(project), result: project(trees.result)
			}
		};
	};
	let controls = 0;
	for(const route of inheritedCheckedRecordPhpWasmRoutes)
	for(const mode of inheritedCheckedRecordPhpWasmModes)
	{
		const review = inheritedCheckedRecordPhpWasmReview(mode);
		const model = {
			profile: "php-wasm-copied-v1", pointerBits: 32, byteOrder: "little"
			, schemaVersion: route === "reviewed" ? 3 : 2, bindingIr: review
			, exports: review.declarations.map(exported)
		};
		checkInheritedCheckedRecordPhpWasmModel(model, route, mode);
		const produced = item => item.exports.find(exp =>
			exp.name.endsWith(".produceStamped")).refinements.result;
		const changes = [
			item => { item.profile = "native-library-v1"; }
			, item => { item.pointerBits = 64; }
			, item => { item.byteOrder = "big"; }
			, item => { item.schemaVersion = route === "reviewed" ? 2 : 3; }
			, item => { item.exports.pop(); }
			, item => { item.exports.push(item.exports[0]); }
			, item => { item.exports[0].name = "InheritedCheckedRecords.unknown"; }
			, item => { produced(item).arguments[1].bound = "9"; }
			, item => { produced(item).constructor = "InheritedCheckedRecords.mkStamped"; }
		];
		if(mode === "full") changes.push(item => {
			item.exports.find(exp => exp.name.endsWith(".aliased"))
				.refinements.parameters[0].arguments[0].constructor
				= "InheritedCheckedRecords.mkSpan";
		});
		for(const mutate of changes)
		{
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => checkInheritedCheckedRecordPhpWasmModel(
				changed, route, mode
			));
			controls++;
		}
	}
	assert.equal(controls, 38);
	t.diagnostic(`${controls} native-width, alias and refinement substitutions refused`);
});

test("inherited checked-record PHP-Wasm observations require every host context and phase", t => {
	let controls = 0;
	for(const mode of inheritedCheckedRecordPhpWasmModes)
	{
		const libraries = ["component.so", "runtime.so"];
		const evidence = {
			component: { pointerBits: 32, library: libraries[0] }
			, runtime: { pointerBits: 32, library: libraries[1] }
			, executions: phpWasmExecutionTuples.map(tuple => {
				const [realm, arrangement, loading, strictness] = tuple.split("/");
				return {
					realm, arrangement, loading, mode: strictness
					, observation: inheritedCheckedRecordPhpWasmExpected(mode)
					, phases: ["ready", "autoload", "invalid", "complete"].map(stage => ({
						stage
						, libraries: loading === "startup" || stage === "complete"
							? [...libraries] : []
					}))
				};
			})
		};
		checkInheritedCheckedRecordPhpWasmExecutions(evidence, mode);
		for(const index of evidence.executions.keys()) for(const mutate of [
			item => { item.executions.splice(index, 1); }
			, item => { item.executions.push(item.executions[index]); }
			, item => { item.executions[index].realm = "firefox"; }
			, item => { item.executions[index].phases.pop(); }
			, item => { item.executions[index].observation.recoveries++; }
			, item => { item.executions[index].observation.word_bits = 64; }
		]){
			const changed = structuredClone(evidence); mutate(changed);
			assert.throws(() => checkInheritedCheckedRecordPhpWasmExecutions(
				changed, mode
			));
			controls++;
		}
		for(const key of ["component", "runtime"])
		{
			const changed = structuredClone(evidence); changed[key].pointerBits = 64;
			assert.throws(() => checkInheritedCheckedRecordPhpWasmExecutions(
				changed, mode
			));
			controls++;
		}
		const same = structuredClone(evidence);
		same.runtime.library = same.component.library;
		assert.throws(() => checkInheritedCheckedRecordPhpWasmExecutions(same, mode));
		controls++;
	}
	assert.equal(controls, 150);
	t.diagnostic(`${controls} missing, duplicated, changed-width or changed-phase observations refused`);
});

test("inherited PHP-Wasm escapes the echo keyword like graph packages and keeps reserved names closed", async () => {
	const options = { integerBits: 32, structuredCallables: true, lists: true, variants: true };
	const declaration = "lean:InheritedCheckedRecords.echo", symbol = "LeanInheritedcheckedrecords\\echo_";
	for(const mode of inheritedCheckedRecordPhpWasmModes)
	{
		const ir = inheritedCheckedRecordPhpWasmReview(mode), model = compileCopiedPhpModel(ir, options);
		const full = mode === "full";
		assert.deepEqual(model.surface.functions.map(fn => [fn.field, fn.publicName]).filter(([field]) => field === "echo")
			, full ? [["echo", "echo_"]] : []);
		assert.ok(model.surface.functions.every(fn => fn.publicName === fn.field || fn.field === "echo"));
		const source = copiedPhpPublicSource(model);
		assert.equal(source.includes("function echo_("), full); assert.doesNotMatch(source, /function echo\(/u);
		const manifest = JSON.parse(renderCopiedPhpPackage(model)["binding-manifest.json"]);
		assert.equal(manifest.exports.includes(symbol), full);
		assert.ok(!manifest.exports.includes("LeanInheritedcheckedrecords\\echo"));
		const zend = JSON.parse(generateCopiedPhpZendAdapter(ir, { integerBits: 32 })["copied-zend-manifest.json"]);
		assert.deepEqual(zend.exports.filter(item => item.declaration === declaration).map(item => item.function)
			, full ? [symbol] : []);
	}
	// The independent caller reaches the escaped symbol exactly as the recursive caller does.
	const caller = await readFile("tests/fixtures/inherited-checked-record-consumers/php-native.php", "utf8");
	assert.equal(caller.split("($name === 'echo' ? 'echo_' : $name)").length, 2);
	// Only keywords are escaped; other reserved or colliding names still fail closed.
	const rename = name => {
		const ir = structuredClone(inheritedCheckedRecordPhpWasmReview("full"));
		const item = ir.declarations.find(value => value.id.endsWith(".first"));
		item.id = item.id.replace(/first$/u, name); item.name = name; return ir;
	};
	for(const name of ["internal", "bigint"])
		assert.throws(() => compileCopiedPhpModel(rename(name), options), new RegExp(`PHP function name is reserved or duplicated: ${name}$`, "u"), name);
	assert.throws(() => compileCopiedPhpModel(rename("echo_"), options), /collides/u);
	assert.deepEqual(compileCopiedPhpModel(rename("print"), options).surface.functions.map(fn => fn.publicName).slice(0, 1), ["print_"]);
});
