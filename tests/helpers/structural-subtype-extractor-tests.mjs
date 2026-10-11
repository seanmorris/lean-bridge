/**
 * Fresh Lean must own every structural constructor choice, including repeated aliases.
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
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../../src/analyze/elaborated-metadata.mjs";
import { createElaboratedSemanticModel } from "../../src/analyze/semantic-model.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { reviewedSubtypeContracts } from "../../src/analyze/reviewed-subtypes.mjs";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateNativePrimitiveC } from "../../src/backends/c/native-primitives.mjs";
import { brokerHeader } from "../../src/backends/native/runtime-broker.mjs";
import { nativeCallbackHeader } from "../../src/build/native-component.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const enabled = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_EXTRACTOR_TEST === "1"
	|| (process.env.LEAN_BRIDGE_SUBTYPE_PROFILES?.split(",") ?? []).includes("c");
const tree = (kind, ...arguments_) => ({ kind, arguments: arguments_ });
const choice = name => ({ constructor: `StructuralSubtypes.${name}` });
const copied = refinement => ({ ownership: "copy", lifetime: null, ...(refinement ? { refinement } : {}) });
const group = name => tree("array", tree("option", choice(name)));
const positive = choice("checkedPositive"), word = choice("checkedWord");
const selections = {
	scalar: positive
	, arrays: tree("array", positive)
	, lists: tree("list", positive)
	, options: tree("option", positive)
	, product: tree("tuple", positive, word)
	, branch: tree("result", positive, word)
	, byteBranches: tree("array", tree("option", tree("tuple", choice("checkedByte"), positive)))
	, nested: tree("array", tree("list", tree("option", tree("tuple", positive, null))))
	, aliasPair: tree("tuple", group("checkedPositive"), group("normalizePositive"))
};

test("fresh Lean extracts structural Subtypes with exact per-site choices and retains independent refusal gates", { skip: !enabled, timeout: 180_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-structural-subtype-extractor-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true, force: true });
		else t.diagnostic(`Failed source-check artifacts retained at ${directory}`);
	});
	const reports = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_EXTRACTOR_REPORTS;
	if(reports) await mkdir(reports, { recursive: false });
	const source = "tests/fixtures/onboarding/structural-subtypes/StructuralSubtypes.lean";
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2", "bin/lean");
	const extractor = resolve("src/analyze/NativeExports.lean");
	const environment = { ...process.env, LEAN_PATH: directory, PATH: `${dirname(lean)}:${process.env.PATH ?? "/usr/bin:/bin"}` };
	const run = async (args, command = lean) => {
		try
		{ return await promisify(execFile)(command, args, { cwd: directory, env: environment, maxBuffer: 16 * 1024 * 1024 }); }
		catch(error)
		{ error.message += `\n${error.stdout ?? ""}\n${error.stderr ?? ""}`; throw error; }
	};
	await cp(source, join(directory, "StructuralSubtypes.lean"));
	await run(["-o", "StructuralSubtypes.olean", "StructuralSubtypes.lean"]);
	const interfaceIdentity = await identifyLeanInterface(join(directory, "StructuralSubtypes.olean"));
	const moduleIdentity = { name: "StructuralSubtypes"
		, sourcePath: "StructuralSubtypes.lean"
		, sourceSha256: sha256(await readFile(source))
		, interfaceSha256: interfaceIdentity.interfaceSha256 };
	const context = { toolchain: "leanprover/lean4:v4.32.2"
		, leanCompilerSha256: sha256(await readFile(lean))
		, extractorSha256: sha256(await readFile(extractor))
		, modules: [moduleIdentity] };
	let sequence = 0;
	const extract = async (profile, contracts, extra = {}, admitted = false) => {
		const selection = { profile
			, modules: ["StructuralSubtypes"], exportModules: ["StructuralSubtypes"]
			, resources: [], arities: []
			, exports: Object.keys(contracts), contracts, ...extra };
		const request = createMetadataRequest(selection, context);
		const path = join(directory, `request-${sequence++}.json`);
		await writeFile(path, JSON.stringify(request));
		const result = await run(["--run", extractor, "--metadata", path]);
		const report = JSON.parse(result.stdout);
		await writeFile(join(directory, `report-${sequence - 1}.json`), result.stdout);
		if(reports)
		{
			await cp(path, join(reports, `request-${sequence - 1}.json`));
			await writeFile(join(reports, `report-${sequence - 1}.json`), result.stdout, { flag: "wx" });
		}
		await assertJsonSchema("elaborated-export-metadata", report);
		if(admitted)
		{
			validateElaboratedMetadata(report, request);
			assert.deepEqual(report.diagnostics, []);
			const component = { id: "structural-subtypes@1.0.0", name: "structural-subtypes", version: "1.0.0" };
			const semantic = createElaboratedSemanticModel({ metadata: report, request, component, elaborationSha256: sha256(result.stdout) });
			const derived = reviewedSubtypeContracts(semantic.document);
			for(const [name, contract] of Object.entries(derived)) assert.deepEqual(contract, contracts[name]);
			const changed = structuredClone(report);
			changed.modules[0].declarations.find(item => item.identity === "StructuralSubtypes.arrays").projection.parameters[0].type.element.predicate.constructor = "StructuralSubtypes.normalizePositive";
			assert.throws(() => validateElaboratedMetadata(changed, request), /Supported projection violates its configured export contract/);
			if(profile === "native-library-v1")
			{
				const version = await run(["--version"]);
				const leanCommit = /commit ([a-f0-9]{40})/.exec(version.stdout)?.[1];
				assert.ok(leanCommit, version.stdout);
				const olean = await readFile(join(directory, "StructuralSubtypes.olean"));
				const sourceIdentity = { leanVersion: "4.32.2", leanCommit
					, leanCompilerSha256: context.leanCompilerSha256
					, extractorSha256: context.extractorSha256
					, sourceTreeSha256: sha256(canonicalJson([moduleIdentity]))
					, modules: [{ module: "StructuralSubtypes"
						, source: { path: moduleIdentity.sourcePath, bytes: (await readFile(source)).length, sha256: moduleIdentity.sourceSha256 }
						, interface: { bytes: olean.length, sha256: sha256(olean), interfaceSha256: interfaceIdentity.interfaceSha256 } }]
					, request };
				const model = createNativeModel({ metadata: report, sourceIdentity, component }, { refinements: true });
				const generated = generateNativeLeanAdapters(model);
				const call = name => `${generated.module}.f_${model.exports.find(item => item.name === `StructuralSubtypes.${name}`).symbol}`;
				const checks = [
					`example : ${call("arrays")} #[] = some #[] := by native_decide`
					, `example : ${call("arrays")} #[1, 0, 2] = none := by native_decide`
					, `example : ${call("aliasPair")} (#[some 1], #[some 1]) = some (#[some 1], #[some 2]) := by native_decide`
					, `example : ${call("aliasArguments")} #[some 1] #[some 1] = some #[some 1, some 2] := by native_decide`
					, `example : ${call("aliasArguments")} #[some 1] #[some 0] = none := by native_decide`
					, `#guard (match ${call("branch")} (.error "") with | none => true | _ => false)`
					, `#guard (match ${call("branch")} (.ok 2) with | some (.ok value) => value == 2 | _ => false)`
					, `example : ${call("options")} none = some none := by native_decide`
					, `example : ${call("byteBranches")} #[none, some (1, 2)] = some #[none, some (1, 2)] := by native_decide`
					, `example : ${call("byteBranches")} #[some (0, 2)] = none := by native_decide`
					, `example : ${call("nested")} #[[some (1, 184467440737095516170)]] = none := by native_decide`
					, `example : ${call("nested")} #[[some (1, 184467440737095516169)]] = some 1 := by native_decide`
					, `example : ${call("specialized")} [1, 0] = none := by native_decide`
				];
				const adapter = generated.leanSource + "\n" + checks.join("\n") + "\n";
				await writeFile(join(directory, "StructuralAdapters.lean"), adapter);
				if(reports) await writeFile(join(reports, "StructuralAdapters.lean"), adapter, { flag: "wx" });
				await run(["StructuralAdapters.lean"]);
				for(const [path, source] of Object.entries(generateCBindingPackage(model.bindingIr))) await saveLakeFile(directory, path, source);
				await saveLakeFile(directory, "component.h", generated.header);
				await saveLakeFile(directory, "lean_bridge_native_runtime.h", brokerHeader + nativeCallbackHeader);
				const native = generateNativePrimitiveC(model, { initializer: `initialize_${generated.module}` });
				await saveLakeFile(directory, "native.c", native);
				if(reports) await writeFile(join(reports, "native.c"), native, { flag: "wx" });
				await run(["-std=c11", "-Wall", "-Wextra", "-Werror"
					, "-pthread", "-fsyntax-only"
					, "-I", directory, "-I", join(directory, "include")
					, "-I", join(directory, "internal")
					, "-I", join(dirname(dirname(lean)), "include")
					, "native.c"], "/usr/bin/cc");
			}
		}
		return new Map(report.modules.flatMap(module => module.declarations.filter(item => item.selected)
			.map(item => [item.identity.split(".").at(-1), item.projection])));
	};
	const selectionsIn = type => type.kind === "refinement" ? type.predicate
		: type.kind === "alias" ? selectionsIn(type.target)
			: ["array", "list", "option"].includes(type.kind) ? tree(type.kind, selectionsIn(type.element))
				: ["tuple", "result"].includes(type.kind) ? tree(type.kind, ...type.arguments.map(selectionsIn)) : null;
	const predicate = selection => selection === null ? { kind: "fin", bound: "184467440737095516170" }
		: Object.hasOwn(selection, "constructor") ? { kind: "subtype", constructor: selection.constructor }
			: tree(selection.kind, ...selection.arguments.map(predicate));
	for(const profile of ["native-library-v1", "component-scalars-v1"])
	{
		const contracts = Object.fromEntries(Object.entries(selections).map(([name, selection]) => [
			`StructuralSubtypes.${name}`
			, { parameters: [copied(selection)], result: copied(name === "nested" ? null : selection) }
		]));
		contracts["StructuralSubtypes.aliasArguments"] = { parameters: [copied(group("checkedPositive")), copied(group("normalizePositive"))], result: copied(group("checkedPositive")) };
		contracts["StructuralSubtypes.plainFin"] = { parameters: [copied(null)], result: copied(null) };
		contracts["StructuralSubtypes.specialized"] = { parameters: [copied(tree("list", positive))], result: copied(tree("list", positive)) };
		const specialized = { specializations: [{ name: "StructuralSubtypes.specialized", declaration: "StructuralSubtypes.generic", types: ["StructuralSubtypes.Positive"] }] };
		await extract(profile, contracts, specialized, true);
		const refusedNames = ["field", "callback", "callbackAlias", "callbackReply"];
		for(const name of refusedNames) contracts[`StructuralSubtypes.${name}`] = {
			parameters: [name === "field" ? copied(positive)
				: { ownership: "borrow", lifetime: { scope: "call", anchor: null }, refinement: positive }]
		};
		let deep = positive, wide = positive;
		for(let depth = 0; depth < 33; depth++) deep = tree("array", deep);
		for(let depth = 0; depth < 12; depth++) wide = tree("tuple", wide, wide);
		const invalid = {
			wrongInput: tree("array", choice("checkedWord"))
			, wrongResult: tree("array", choice("wrongPredicate"))
			, unsafeChoice: tree("array", choice("unsafePositive"))
			, wrongShape: tree("option", positive), emptyChoice: tree("array", null)
			, extraChoice: tree("array", { ...positive, invented: true })
			, missingChoice: null
			, tooDeep: deep, tooWide: wide
		};
		for(const [name, selection] of Object.entries(invalid)) contracts[`StructuralSubtypes.${name}`] = {
			parameters: [copied(selection)], result: copied(tree("array", positive))
		};
		const projections = await extract(profile, contracts, specialized);
		for(const [name, selection] of Object.entries(selections))
		{
			const projection = projections.get(name);
			assert.equal(projection.status, "supported", `${profile}/${name}: ${projection.expression}`);
			assert.deepEqual(selectionsIn(projection.parameters[0].type), predicate(selection));
			if(name !== "nested") assert.deepEqual(selectionsIn(projection.result), predicate(selection));
		}
		const aliases = projections.get("aliasArguments");
		assert.equal(aliases.status, "supported", aliases.expression);
		assert.deepEqual(aliases.parameters.map(item => selectionsIn(item.type)), [predicate(group("checkedPositive")), predicate(group("normalizePositive"))]);
		assert.equal(projections.get("plainFin").status, "supported");
		assert.equal(projections.get("specialized").status, "supported", projections.get("specialized").expression);
		for(const name of refusedNames)
		{
			const projection = projections.get(name);
			assert.equal(projection.status, "unsupported");
			assert.match(projection.expression, /Subtype refinements require a top-level or structural-container/);
		}
		for(const name of Object.keys(invalid)) assert.equal(projections.get(name).status, "unsupported", name);
		assert.match(projections.get("wrongInput").expression, /input must equal/);
		assert.match(projections.get("wrongResult").expression, /exact subtype/);
		assert.match(projections.get("unsafeChoice").expression, /unsafe/);
		assert.match(projections.get("missingChoice").expression, /configured checked constructor/);
		for(const name of ["tooDeep", "tooWide"]) assert.match(projections.get(name).expression, /depth or node limit/);
	}
	complete = true;
});
