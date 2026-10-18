/**
 * Execute generated component mirror carriers against independently authored Lean declarations.
 * This checks source conversion, not metadata admission or installed consumer packages.
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
import { sha256 } from "../../src/capsule/node.mjs";
import { componentRecursiveLeanSource } from "../../src/build/component-recursive-lean.mjs";
import { componentNominalFinGuards } from "../../src/build/component-fin-guards.mjs";
import {
	componentRefinementMirrorsFixture
	, mutualCheckedComponentRefinementMirrorsFixture
	, mutualComponentRefinementMirrorsFixture
	, recursiveComponentRefinementMirrorsFixture
} from "./component-refinement-mirrors-fixture.mjs";

const enabled = process.env.LEAN_BRIDGE_COMPONENT_REFINEMENT_MIRRORS_TEST === "1";
test("fresh Lean checks nominal component carriers, per-use normalization and result-only projection", { skip: !enabled, timeout: 240_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-component-refinement-mirrors-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true, force: true });
		else t.diagnostic(`Failed component mirror artifacts retained at ${directory}`);
	});
	const reports = process.env.LEAN_BRIDGE_COMPONENT_REFINEMENT_MIRRORS_REPORTS;
	if(reports) await mkdir(reports, { recursive: false });
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2", "bin/lean");
	const run = async args => {
		try
		{
			const result = await promisify(execFile)(lean, args, { cwd: directory
				, signal: t.signal
				, maxBuffer: 16 * 1024 * 1024
				, env: { ...process.env, LEAN_PATH: directory, PATH: `${dirname(lean)}:${process.env.PATH ?? "/usr/bin:/bin"}` } });
			assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
			return result;
		}
		catch(error)
		{ error.message += `\n${error.stdout ?? ""}\n${error.stderr ?? ""}`; throw error; }
	};
	const fixtures = ["tests/fixtures/nominal-subtype-conversion/NominalConversion.lean"
		, "tests/fixtures/component-refinement-mirrors/ComponentMirrors.lean"];
	for(const file of fixtures)
	{
		const name = file.split("/").at(-1);
		await cp(file, join(directory, name));
		await run(["-o", name.replace(/\.lean$/u, ".olean"), name]);
		if(reports) await cp(file, join(reports, name));
	}
	const observations = [];
	const cycle = "guard-tree-cycle", recursiveGuard = { kind: "recursive", definition: "GuardTree", cycle };
	const guardTree = { kind: "variant", definition: "GuardTree", cycle
	, cases: [
		{ name: "leaf", arguments: [{ kind: "fin", bound: "5" }] }
		, { name: "array", arguments: [{ kind: "array", arguments: [recursiveGuard] }] }
		, { name: "list", arguments: [{ kind: "list", arguments: [recursiveGuard] }] }
		, { name: "nested", arguments: [{ kind: "array", arguments: [{ kind: "list", arguments: [recursiveGuard] }] }] }
		, { name: "arrayOption", arguments: [{ kind: "array", arguments: [{ kind: "option", arguments: [recursiveGuard] }] }] }
		, { name: "paired", arguments: [{ kind: "tuple", arguments: [null, recursiveGuard] }] }
		, { name: "result", arguments: [{ kind: "result", arguments: [recursiveGuard, recursiveGuard] }] }
	] };
	const guardType = { kind: "variant"
		, lean: "GuardTree"
		, cases: guardTree.cases.map(branch => ({ name: branch.name
			, fields: branch.arguments.map((_, index) => ({ name: `value${index}` })) })) };
	const rightTree = { kind: "variant", definition: "GuardRight"
	, cases: [
		{ name: "stop", arguments: [{ kind: "fin", bound: "3" }] }
		, { name: "more", arguments: [{ kind: "recursive", definition: "GuardLeft", cycle: "guard-mutual-cycle" }] }
	] };
	const leftTree = { kind: "record"
		, definition: "GuardLeft"
		, cycle: "guard-mutual-cycle"
		, arguments: [{ kind: "array", arguments: [rightTree] }] };
	const guardLines = componentNominalFinGuards([guardType], new Map([["lean:GuardTree", guardTree]])
		, new Map([[cycle, guardTree]]));
	const mutualGuardLines = componentNominalFinGuards([
		{ kind: "record", lean: "GuardLeft", fields: [{ name: "next" }] }
		, { kind: "variant", lean: "GuardRight"
		, cases: [
			{ name: "stop", fields: [{ name: "digit" }] }
			, { name: "more", fields: [{ name: "left" }] }
		] }
	], new Map([["lean:GuardLeft", leftTree], ["lean:GuardRight", rightTree]])
	, new Map([["guard-mutual-cycle", leftTree]]), [["GuardLeft", "GuardRight"]]);
	const guardSource = ["import ComponentMirrors"
		, "namespace Carriers"
		, "namespace LbErased"
		, "inductive GuardTree where"
		, "  | leaf (value : Nat)"
		, "  | array (value : Array GuardTree)"
		, "  | list (value : List GuardTree)"
		, "  | nested (value : Array (List GuardTree))"
		, "  | arrayOption (value : Array (Option GuardTree))"
		, "  | paired (value : Nat × GuardTree)"
		, "  | result (value : Except GuardTree GuardTree)"
		, "mutual"
		, "structure GuardLeft where"
		, "  next : Array GuardRight"
		, "inductive GuardRight where"
		, "  | stop (digit : Nat)"
		, "  | more (left : GuardLeft)"
		, "end"
		, "end LbErased"
		, ""
		, ...guardLines, ...mutualGuardLines
		, "example : LbErased.GuardTree.validFin (.array #[.leaf 4]) = true := by native_decide"
		, "example : LbErased.GuardTree.validFin (.nested #[[.leaf 5]]) = false := by native_decide"
		, "example : LbErased.GuardLeft.validFin ⟨#[.stop 2]⟩ = true := by native_decide"
		, "example : LbErased.GuardLeft.validFin ⟨#[.more ⟨#[.stop 3]⟩]⟩ = false := by native_decide"
		, "end Carriers", ""].join("\n");
	assert.match(guardSource, /\.attach\.all \(fun ⟨_bridgeFinValue0, _bridgeFinMember0⟩/u);
	assert.match(guardSource, /termination_by sizeOf value[\s\S]*Array\.sizeOf_lt_of_mem _bridgeFinMember0[\s\S]*try omega/u);
	assert.doesNotMatch(guardSource, /\b(?:sorry|axiom|unsafe|partial|unsafeCast|defaultValue)\b/u);
	await writeFile(join(directory, "GeneratedFinGuard.lean"), guardSource);
	const guardResult = await run(["-c", "GeneratedFinGuard.c", "GeneratedFinGuard.lean"]);
	observations.push({ route: "recursive-fin-guards"
		, checks: 4
		, sourceSha256: sha256(guardSource)
		, cSha256: sha256(await readFile(join(directory, "GeneratedFinGuard.c")))
		, stdout: guardResult.stdout, stderr: guardResult.stderr });
	for(const route of ["forward", "reverse", "result-only"])
	{
		const fixture = componentRefinementMirrorsFixture();
		if(route === "reverse")
		{ fixture.exports.reverse(); fixture.abi.exports.reverse(); }
		if(route === "result-only")
		{
			fixture.exports = fixture.exports.filter(item => item.sourceDeclaration.includes(".produce"));
			fixture.abi.exports = fixture.abi.exports.filter(item => fixture.exports.some(site => site.bindingId === item.bindingId));
			// Only exported layouts and their known parents are part of this source probe.
			fixture.abi.types = fixture.abi.types.filter(type => !["Digit", "DigitAlias", "WithDigit"].some(name => type.id === `lean:NominalConversion.${name}`));
			fixture.nominalRefinements = fixture.nominalRefinements.filter(entry => fixture.abi.types.some(type => type.id === entry.id));
		}
		const render = type => {
			assert.equal(type.kind, "primitive"); assert.equal(type.name, "nat");
			return "_root_.Nat";
		};
		const lines = componentRecursiveLeanSource(fixture.abi, fixture.exports, render, fixture.nominalRefinements);
		const call = name => `Carriers.export_${name}`;
		const checks = route === "result-only" ? [] : [
			`example : ${call("first")} #[⟨40, 2⟩] = #[41] := by decide`
			, `example : ${call("second")} #[⟨40, 2⟩] = #[42] := by decide`
			, `example : ${call("combine")} #[⟨40, 2⟩] #[⟨40, 2⟩] = #[4142] := by decide`
			, `example : ${call("nested")} #[⟨⟨40, 2⟩, ⟨40, 2⟩⟩] = #[4142] := by decide`
			, `example : ${call("first")} #[⟨100, 2⟩] = #[] := by decide`
			, `example : ${call("first")} #[⟨40, 3⟩] = #[] := by decide`
			, `example : ${call("second")} #[⟨90, 2⟩] = #[] := by decide`
			, `example : ${call("combine")} #[⟨40, 2⟩] #[⟨90, 2⟩] = #[] := by decide`
			, `example : ${call("first")} #[] = #[] := by decide`
			, `example : ${call("first")} #[⟨40, 2⟩, ⟨40, 2⟩] = #[] := by decide`
			, `example : ${call("eventFirst")} #[.empty] = #[0] := by decide`
			, `example : ${call("eventFirst")} #[.box ⟨40, 2⟩] = #[41] := by decide`
			, `example : ${call("eventSecond")} #[.box ⟨40, 2⟩] = #[42] := by decide`
			, `example : ${call("eventFirst")} #[.choices #[none, some (.ok 95)]] = #[96] := by native_decide`
			, `example : ${call("eventFirst")} #[.choices #[some (.error 95)]] = #[] := by native_decide`
			, `example : ${call("eventSecond")} #[.choices #[some (.error 95)]] = #[96] := by native_decide`
			, `example : ((${call("echo")} #[⟨40, 2⟩]).map fun value => value.payload) = #[41] := by native_decide`
			, `example : ((${call("echoAliases")} #[#[⟨40, 2⟩, ⟨80, 1⟩]]).map fun values => values.map fun value => value.payload) = #[#[41, 81]] := by native_decide`
			, `example : (${call("echoAliases")} #[#[⟨40, 3⟩]]).size = 0 := by native_decide`
			, `example : ${call("withDigit")} #[⟨40, ⟨2⟩⟩] = #[4102] := by decide`
			, `example : ${call("withDigit")} #[⟨40, ⟨3⟩⟩] = #[] := by decide`
			, `example : ((${call("echoDigit")} #[⟨2⟩]).map fun value => value.value) = #[2] := by native_decide`
			, `example : (${call("echoDigit")} #[⟨3⟩]).size = 0 := by decide`
			, `example : Carriers.export_first_refinement_0 #[⟨40, 2⟩] = 1 := by decide`
			, `example : Carriers.export_first_refinement_0 #[⟨100, 2⟩] = 0 := by decide`
			, `example : Carriers.export_first_refinement_0 #[⟨40, 3⟩] = 0 := by decide`
			, `example : Carriers.export_first_fin_guard_0 #[⟨100, 2⟩] = 1 := by decide`
			, `example : Carriers.export_first_fin_guard_0 #[⟨40, 3⟩] = 0 := by decide`
			, `example : Carriers.export_first_fin_guard_0 #[] = 0 := by decide`
			, `example : Carriers.export_first_fin_guard_0 #[⟨40, 2⟩, ⟨40, 2⟩] = 0 := by decide`
			, `example : Carriers.export_nested_fin_guard_0 #[⟨⟨100, 2⟩, ⟨90, 2⟩⟩] = 1 := by decide`
			, `example : Carriers.export_nested_fin_guard_0 #[⟨⟨40, 2⟩, ⟨40, 3⟩⟩] = 0 := by decide`
			, `example : Carriers.export_eventFirst_fin_guard_0 #[.empty] = 1 := by decide`
			, `example : Carriers.export_eventFirst_fin_guard_0 #[.box ⟨100, 2⟩] = 1 := by decide`
			, `example : Carriers.export_eventFirst_fin_guard_0 #[.box ⟨40, 3⟩] = 0 := by decide`
			, `example : Carriers.export_echoAliases_fin_guard_0 #[#[⟨100, 2⟩]] = 1 := by native_decide`
			, `example : Carriers.export_echoAliases_fin_guard_0 #[#[⟨40, 3⟩]] = 0 := by native_decide`
		];
		checks.push(`example : ((${call("produce")} #[120]).map fun value => value.payload) = #[121] := by native_decide`
			, `example : ((${call("produceEvent")} #[120]).map fun event => match event with | .box value => value.payload | _ => 0) = #[121] := by native_decide`
			, `example : (${call("produce")} #[]).size = 0 := by decide`);
		const source = ["import ComponentMirrors", "namespace Carriers", ...lines, "end Carriers", ...checks, ""].join("\n");
		assert.doesNotMatch(source, /\b(?:sorry|axiom|unsafe|partial|unsafeCast|defaultValue)\b/u);
		await writeFile(join(directory, "Generated.lean"), source);
		const result = await run(["-c", "Generated.c", "Generated.lean"]);
		observations.push({ route, checks: checks.length
			, sourceSha256: sha256(source)
			, cSha256: sha256(await readFile(join(directory, "Generated.c")))
			, stdout: result.stdout, stderr: result.stderr });
		if(reports) await writeFile(join(reports, `${route}.lean`), source, { flag: "wx" });
	}
	const recursive = recursiveComponentRefinementMirrorsFixture();
	const recursiveLines = componentRecursiveLeanSource(recursive.abi, recursive.exports, type => {
		assert.equal(type.kind, "primitive"); assert.equal(type.name, "nat");
		return "_root_.Nat";
	}, recursive.nominalRefinements);
	const recursiveChecks = [
		"def recursiveErasedTotal : Carriers.LbErased.RecursiveMirrors.Chain → Nat"
		, "  | .empty => 0"
		, "  | .node value _ tail => value + recursiveErasedTotal tail"
		, "example : Carriers.export_recursiveFirst #[.node 40 2 (.node 80 1 .empty)] = #[122] := by native_decide"
		, "example : Carriers.export_recursiveSecond #[.node 40 2 (.node 80 1 .empty)] = #[124] := by native_decide"
		, "example : Carriers.export_recursiveFirst #[.node 40 2 (.node 100 1 .empty)] = #[] := by native_decide"
		, "example : Carriers.export_recursiveSecond #[.node 40 2 (.node 90 1 .empty)] = #[] := by native_decide"
		, "example : Carriers.export_recursiveFirst #[.node 40 2 (.node 80 3 .empty)] = #[] := by native_decide"
		, "example : (Carriers.export_recursiveEcho #[.node 40 2 (.node 80 1 .empty)]).map recursiveErasedTotal = #[122] := by native_decide"
	];
	const recursiveSource = ["import ComponentMirrors", "namespace Carriers", ...recursiveLines, "end Carriers", ...recursiveChecks, ""].join("\n");
	assert.doesNotMatch(recursiveSource, /\b(?:sorry|axiom|unsafe|partial|unsafeCast|defaultValue)\b/u);
	assert.equal((recursiveSource.match(/def LbErased\.RecursiveMirrors\.Chain\.via_/gu) ?? []).length, 2);
	assert.equal((recursiveSource.match(/def LbErased\.RecursiveMirrors\.Chain\.erase /gu) ?? []).length, 1);
	await writeFile(join(directory, "GeneratedRecursive.lean"), recursiveSource);
	const recursiveResult = await run(["-c", "GeneratedRecursive.c", "GeneratedRecursive.lean"]);
	observations.push({ route: "recursive", checks: 6
		, sourceSha256: sha256(recursiveSource)
		, cSha256: sha256(await readFile(join(directory, "GeneratedRecursive.c")))
		, stdout: recursiveResult.stdout, stderr: recursiveResult.stderr });
	if(reports) await writeFile(join(reports, "recursive.lean"), recursiveSource, { flag: "wx" });
	const mutual = mutualComponentRefinementMirrorsFixture();
	const mutualLines = componentRecursiveLeanSource(mutual.abi, mutual.exports, type => {
		assert.equal(type.kind, "primitive"); assert.equal(type.name, "nat");
		return "_root_.Nat";
	}, mutual.nominalRefinements);
	const mutualChecks = [
		"mutual"
		, "def mutualLeftTotal : Carriers.LbErased.MutualMirrors.Left → Nat"
		, "  | ⟨value, none⟩ => value"
		, "  | ⟨value, some next⟩ => value + mutualRightTotal next"
		, "def mutualRightTotal : Carriers.LbErased.MutualMirrors.Right → Nat"
		, "  | .stop => 0"
		, "  | .node value none => value"
		, "  | .node value (some next) => value + mutualLeftTotal next"
		, "end"
		, "def mutualGroupTotal (values : Array (Option Carriers.LbErased.MutualMirrors.Left)) : Nat :="
		, "  values.foldl (fun total value => total + (value.map mutualLeftTotal).getD 0) 0"
		, "example : Carriers.export_mutualFirst #[⟨40, some (.node 80 (some ⟨20, none⟩))⟩] = #[144] := by native_decide"
		, "example : Carriers.export_mutualSecond #[⟨40, some (.node 80 (some ⟨20, none⟩))⟩] = #[145] := by native_decide"
		, "example : Carriers.export_mutualFirst #[⟨40, some .stop⟩] = #[41] := by native_decide"
		, "example : Carriers.export_mutualFirst #[⟨40, some (.node 90 none)⟩] = #[] := by native_decide"
		, "example : Carriers.export_mutualFirst #[⟨40, some (.node 80 (some ⟨100, none⟩))⟩] = #[] := by native_decide"
		, "example : (Carriers.export_mutualEcho #[⟨40, some (.node 80 (some ⟨20, none⟩))⟩]).map mutualLeftTotal = #[144] := by native_decide"
		, "example : Carriers.export_mutualGroups #[#[some ⟨40, some (.node 80 none)⟩, none]] = #[123] := by native_decide"
		, "example : (Carriers.export_mutualEchoGroups #[#[some ⟨40, some (.node 80 none)⟩, none]]).map mutualGroupTotal = #[123] := by native_decide"
	];
	const mutualSource = ["import ComponentMirrors", "namespace Carriers", ...mutualLines, "end Carriers", ...mutualChecks, ""].join("\n");
	assert.doesNotMatch(mutualSource, /\b(?:sorry|axiom|unsafe|partial|unsafeCast|defaultValue)\b/u);
	await writeFile(join(directory, "GeneratedMutual.lean"), mutualSource);
	const mutualResult = await run(["-c", "GeneratedMutual.c", "GeneratedMutual.lean"]);
	observations.push({ route: "mutual", checks: 8
		, sourceSha256: sha256(mutualSource)
		, cSha256: sha256(await readFile(join(directory, "GeneratedMutual.c")))
		, stdout: mutualResult.stdout, stderr: mutualResult.stderr });
	if(reports) await writeFile(join(reports, "mutual.lean"), mutualSource, { flag: "wx" });
	const mutualChecked = mutualCheckedComponentRefinementMirrorsFixture();
	const mutualCheckedLines = componentRecursiveLeanSource(mutualChecked.abi, mutualChecked.exports, type => {
		assert.equal(type.kind, "primitive"); assert.equal(type.name, "nat");
		return "_root_.Nat";
	}, mutualChecked.nominalRefinements);
	const mutualCheckedChecks = [
		"mutual"
		, "def mutualCheckedEnvelopeTotal : Carriers.LbErased.MutualChecked.Envelope → Nat"
		, "  | ⟨value, _, none⟩ => value"
		, "  | ⟨value, _, some next⟩ => value + mutualCheckedStepTotal next"
		, "def mutualCheckedStepTotal : Carriers.LbErased.MutualChecked.Step → Nat"
		, "  | .stop => 0"
		, "  | .more packet => mutualCheckedEnvelopeTotal packet"
		, "end"
		, "example : Carriers.export_mutualCheckedFirst #[⟨40, 2, some (.more ⟨80, 1, none⟩)⟩] = #[122] := by native_decide"
		, "example : Carriers.export_mutualCheckedSecond #[⟨40, 2, some (.more ⟨80, 1, none⟩)⟩] = #[124] := by native_decide"
		, "example : Carriers.export_mutualCheckedFirst #[⟨0, 2, none⟩] = #[] := by native_decide"
		, "example : Carriers.export_mutualCheckedFirst #[⟨40, 2, some (.more ⟨0, 2, none⟩)⟩] = #[] := by native_decide"
		, "example : Carriers.export_mutualCheckedFirst #[⟨40, 3, none⟩] = #[] := by native_decide"
		, "example : (Carriers.export_mutualCheckedEcho #[⟨40, 2, some (.more ⟨80, 1, none⟩)⟩]).map mutualCheckedEnvelopeTotal = #[122] := by native_decide"
		, "example : Carriers.export_mutualCheckedAlias #[⟨40, 2, none⟩] = #[41] := by native_decide"
	];
	const mutualCheckedSource = ["import ComponentMirrors"
		, "namespace Carriers", ...mutualCheckedLines
		, "end Carriers", ...mutualCheckedChecks, ""].join("\n");
	assert.doesNotMatch(mutualCheckedSource, /\b(?:sorry|axiom|unsafe|partial|unsafeCast|defaultValue)\b/u);
	await writeFile(join(directory, "GeneratedMutualChecked.lean"), mutualCheckedSource);
	const mutualCheckedResult = await run(["-c", "GeneratedMutualChecked.c", "GeneratedMutualChecked.lean"]);
	observations.push({ route: "mutual-checked", checks: 7
		, sourceSha256: sha256(mutualCheckedSource)
		, cSha256: sha256(await readFile(join(directory, "GeneratedMutualChecked.c")))
		, stdout: mutualCheckedResult.stdout, stderr: mutualCheckedResult.stderr });
	if(reports) await writeFile(join(reports, "mutual-checked.lean"), mutualCheckedSource, { flag: "wx" });
	if(reports) await writeFile(join(reports, "report.json"), JSON.stringify({ schemaVersion: 1
		, kind: "component-refinement-mirror-source-check"
		, metadataAdmission: false, installedAcceptance: false
		, compilerSha256: sha256(await readFile(lean))
		, observations }, null, 2) + "\n", { flag: "wx" });
	complete = true;
});
