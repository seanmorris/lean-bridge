/**
 * Fresh Lean admission, independent review reconciliation and executable nineteen-base checks.
 * Installed language packages and wasm32 execution have separate acceptance gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../../src/analyze/elaborated-metadata.mjs";
import { reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { checkComponentSubtypeSource } from "./component-nominal-subtype-source.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";
import { nominalPrimitiveSubtypeFixture, nominalPrimitiveSubtypeModule, nominalPrimitiveSubtypeReview, nominalPrimitiveSubtypeConfiguration } from "./nominal-primitive-subtype-fixture.mjs";
import { checkNominalPrimitiveNativeSource } from "./nominal-primitive-subtype-native-source.mjs";
import { nominalPrimitiveSubtypeAssertions } from "./nominal-primitive-subtype-assertions.mjs";
import { nominalPrimitiveRefusalModule, nominalPrimitiveSubtypeRefusals } from "./nominal-primitive-subtype-refusals.mjs";

const enabled = process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_TEST === "1";
const reviewInput = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
};

test("fresh Lean nominal primitives preserve nineteen bases and reject false constructor authority", { skip: !enabled, timeout: 600_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-source-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Failed primitive source artifacts retained at ${directory}`);
	});
	const reports = process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_REPORTS;
	if(reports) await mkdir(reports, { recursive: false });
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2", "bin/lean");
	const extractor = resolve("src/analyze/NativeExports.lean");
	const environment = { ...process.env, LEAN_PATH: directory
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
		, PATH: `${dirname(lean)}:${process.env.PATH ?? "/usr/bin:/bin"}` };
	const commands = [], observations = [];
	const run = async args => {
		const resources = await waitNominalSubtypeDotnetResources(directory, { notify: message => t.diagnostic(message.replace("C# phase", "primitive source check")) });
		const started = new Date().toISOString();
		let result, failure;
		try
		{
			result = await promisify(execFile)(lean, args, { cwd: directory, env: environment, maxBuffer: 32 * 1024 ** 2, signal: t.signal });
		}
		catch(error)
		{
			failure = error; result = { stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
		}
		const command = { command: lean, arguments: args, cwd: directory
			, started, finished: new Date().toISOString(), resources
			, code: failure?.code ?? 0, signal: failure?.signal ?? null, ...result };
		commands.push(command);
		if(reports) await writeFile(join(reports, `command-${String(commands.length).padStart(2, "0")}.json`), canonicalJson(command), { flag: "wx" });
		if(failure)
		{ failure.message += `\n${result.stdout}\n${result.stderr}`; throw failure; }
		return result;
	};
	const version = await run(["--version"]), leanCommit = /commit ([a-f0-9]{40})/u.exec(version.stdout)?.[1];
	assert.ok(leanCommit, version.stdout);
	const compileModule = async (name, source) => {
		await writeFile(join(directory, `${name}.lean`), source, { flag: "wx" });
		const compiled = await run(["-o", `${name}.olean`, "-c", `${name}.c`, `${name}.lean`]);
		assert.equal(compiled.stdout, ""); assert.equal(compiled.stderr, "");
		const identity = await identifyLeanInterface(join(directory, `${name}.olean`));
		if(reports) await writeFile(join(reports, `${name}.lean`), source, { flag: "wx" });
		return { name, sourcePath: `${name}.lean`, sourceSha256: sha256(source)
			, interfaceSha256: identity.interfaceSha256 };
	};
	const module = await compileModule(nominalPrimitiveSubtypeModule, await readFile(join(nominalPrimitiveSubtypeFixture, `${nominalPrimitiveSubtypeModule}.lean`), "utf8"));
	const context = { toolchain: "leanprover/lean4:v4.32.2"
		, leanCompilerSha256: sha256(await readFile(lean))
		, extractorSha256: sha256(await readFile(extractor)), modules: [module] };
	const extract = async (profile, route, selected, review, context) => {
		const selection = { profile
			, modules: context.modules.map(module => module.name).sort()
			, exportModules: context.modules.map(module => module.name).sort()
			, resources: [], arities: []
			, ...(review ? reviewedSourceSelection(review) : selected) };
		const request = createMetadataRequest(selection, { ...context, ...(review ? { reviewedBindingIrSha256: sha256(canonicalJson(review)) } : {}) });
		const path = join(directory, `${route}-request.json`);
		await writeFile(path, canonicalJson(request), { flag: "wx" });
		const output = await run(["--run", extractor, "--metadata", path]);
		assert.equal(output.stderr, "");
		const report = JSON.parse(output.stdout); await assertJsonSchema("elaborated-export-metadata", report);
		validateElaboratedMetadata(report, request);
		if(reports)
		{
			await cp(path, join(reports, `${route}-request.json`), { errorOnExist: true, force: false });
			await writeFile(join(reports, `${route}-metadata.json`), output.stdout, { flag: "wx" });
			if(review) await writeFile(join(reports, `${route}-review.json`), canonicalJson(review), { flag: "wx" });
		}
		const declarations = report.modules.flatMap(module => module.declarations.filter(item => item.selected));
		assert.deepEqual(declarations.map(item => item.identity).sort(), selection.exports.toSorted());
		return { report, request, declarations, metadataSha256: sha256(output.stdout) };
	};
	for(const profile of ["native-library-v1", "component-scalars-v1"]) for(const resultOnly of [false, true])
	{
		const expected = nominalPrimitiveSubtypeReview(resultOnly), config = nominalPrimitiveSubtypeConfiguration("ordinary", ["c"], resultOnly);
		const selected = { exports: config.exports, ...(config.contracts ? { contracts: config.contracts } : {}) };
		let ordinary;
		for(const authorRoute of ["ordinary", "reviewed"])
		{
			const route = `${profile}-${authorRoute}-${resultOnly ? "result-only" : "full"}`;
			const review = authorRoute === "reviewed" ? reviewInput(expected) : undefined;
			const current = await extract(profile, route, selected, review, context);
			assert.equal(current.declarations.length, resultOnly ? 6 : 14);
			for(const item of current.declarations) assert.equal(item.projection.status, "supported", canonicalJson(item));
			const projections = Object.fromEntries(current.declarations.map(item => [item.identity, item.projection]));
			if(authorRoute === "ordinary") ordinary = projections;
			else assert.deepEqual(projections, ordinary);
			const options = { ...current, context, directory, reports, route, run, review, expected, resultOnly, leanCommit };
			let adapter;
			if(profile === "native-library-v1") adapter = await checkNominalPrimitiveNativeSource(options);
			else
			{
				const checked = await checkComponentSubtypeSource({ ...options, assertions: call => nominalPrimitiveSubtypeAssertions({ call, component: true, resultOnly }).map(item => item.source) });
				adapter = { ...checked, leanRuntimeChecks: checked.leanAssertions, execution: "host-Lean-evaluator" };
			}
			assert.equal(adapter.leanRuntimeChecks, resultOnly ? 46 : 129);
			observations.push({ route, selected: current.declarations.length, metadataSha256: current.metadataSha256, adapter });
			t.diagnostic(`${route}: ${adapter.leanRuntimeChecks} executable Lean checks passed`);
		}
	}
	const refusals = nominalPrimitiveSubtypeRefusals();
	const rejectedModule = await compileModule(nominalPrimitiveRefusalModule, refusals.source);
	const rejectedContext = { ...context, modules: [...context.modules, rejectedModule].sort((a, b) => a.name.localeCompare(b.name)) };
	for(const profile of ["native-library-v1", "component-scalars-v1"]) for(const authorRoute of ["ordinary", "reviewed"])
	{
		const route = `${profile}-${authorRoute}-refusals`;
		const review = authorRoute === "reviewed" ? reviewInput(refusals.review) : undefined;
		const current = await extract(profile, route, { exports: Object.keys(refusals.contracts), contracts: refusals.contracts }, review, rejectedContext);
		assert.equal(current.declarations.length, 38);
		for(const item of current.declarations)
		{
			const control = refusals.controls.find(control => control.identity === item.identity); assert.ok(control);
			assert.equal(item.projection.status, "unsupported", item.identity);
			assert.match(item.projection.expression, control.kind === "input" ? /input must equal/u : /exact subtype/u, item.identity);
		}
		observations.push({ route, rejected: current.declarations.length, metadataSha256: current.metadataSha256, controls: refusals.controls });
		t.diagnostic(`${route}: all 38 constructor-authority controls rejected`);
	}
	assert.equal(observations.length, 12);
	assert.equal(observations.reduce((sum, row) => sum + (row.adapter?.leanRuntimeChecks ?? 0), 0), 700);
	assert.equal(observations.reduce((sum, row) => sum + (row.rejected ?? 0), 0), 152);
	assert.equal(sha256(await readFile(lean)), context.leanCompilerSha256);
	assert.equal(sha256(await readFile(extractor)), context.extractorSha256);
	assert.equal(sha256(await readFile(join(nominalPrimitiveSubtypeFixture, `${nominalPrimitiveSubtypeModule}.lean`))), module.sourceSha256);
	if(reports) await writeFile(join(reports, "report.json"), canonicalJson({ schemaVersion: 1, context, observations, commands, installedAcceptance: false }), { flag: "wx" });
	complete = true;
});
