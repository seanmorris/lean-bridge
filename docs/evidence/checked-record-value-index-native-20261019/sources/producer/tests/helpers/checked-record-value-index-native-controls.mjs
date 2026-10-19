/**
 * Challenge native value-index evidence with independently destructive mutations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexNativeReport
} from "./checked-record-value-index-native-report.mjs";

const instantiation = type =>
	type.source.extensions["lean-lang.org/instantiation"];

/**
 * Require the live checker to reject provenance, review, Git, package and caller drift.
 *
 * @param originals - Original route records keyed by route-relative path.
 * @param options - Exact route, producer, runtime and glibc floor.
 */
export const checkedRecordValueIndexNativeNegativeControls = async (
	originals, options
) => {
	const read = records => async path => {
		assert.ok(records.has(path), `Missing original ${path}`);
		return records.get(path);
	};
	const verify = records => checkCheckedRecordValueIndexNativeReport(
		read(records), options);
	const accepted = await verify(originals);
	const modelPath = "build-0/model.json";
	const provenance = [
		["closed Bool value-index mutation", /On preserves/u, ir => {
			instantiation(ir.types.find(type => type.name === "On"))
				.arguments[0].value = "false";
		}]
		, ["Unicode String value-index mutation", /UnicodeToken preserves/u, ir => {
			instantiation(ir.types.find(type => type.name === "UnicodeToken"))
				.arguments[1].value = "λ";
		}]
		, ["same text under another value-index kind", /ZeroToken preserves/u, ir => {
			instantiation(ir.types.find(type => type.name === "ZeroToken"))
				.arguments[1] = {
					kind: "value", type: { kind: "primitive", name: "string" }
					, value: "0"
				};
		}]
		, [
			"missing value-index provenance", /WideToken has value-index provenance/u
			, ir => {
				delete ir.types.find(type => type.name === "WideToken")
					.source.extensions["lean-lang.org/instantiation"];
			}
		]
		, ["missing value-index record", /Exact value-index record set/u, ir => {
			const id = "lean:CheckedRecordValueIndices.Off";
			ir.types = ir.types.filter(type => type.id !== id);
			ir.declarations = ir.declarations.filter(declaration => ![
				...declaration.parameters.map(parameter => parameter.type)
				, declaration.result?.type
			].some(type => type?.id === id));
		}]
	];
	let provenanceControls = 0;
	for(const [label, pattern, mutate] of provenance)
	{
		const semantic = new Map(originals);
		const changedSemantic = JSON.parse(semantic.get(modelPath));
		mutate(changedSemantic.bindingIr);
		semantic.set(modelPath, Buffer.from(canonicalJson(changedSemantic)));
		await assert.rejects(verify(semantic), pattern, label);
		provenanceControls++;
	}
	const reconciled = new Map(originals);
	const reconcileReport = JSON.parse(reconciled.get("report.json"));
	for(const attempt of [0, 1])
	{
		const path = `build-${attempt}/model.json`;
		const changedBinding = JSON.parse(reconciled.get(path));
		changedBinding.bindingIr.types.find(type => type.name === "On")
			.fields[0].name = "renamed";
		changedBinding.bindingIrSha256 = hashBindingIr(changedBinding.bindingIr);
		const bytes = Buffer.from(canonicalJson(changedBinding));
		reconciled.set(path, bytes);
		reconcileReport.builds[attempt].bindingIrSha256
			= changedBinding.bindingIrSha256;
		reconcileReport.builds[attempt].modelSha256 = sha256(bytes);
	}
	reconciled.set("report.json", Buffer.from(canonicalJson(reconcileReport)));
	await assert.rejects(verify(reconciled), /independently reconciles/u
		, "non-provenance Binding IR change");
	const gitBound = new Map(originals);
	const report = JSON.parse(gitBound.get("report.json"));
	for(const attempt of [0, 1])
	{
		const path = `build-${attempt}/author-inputs.json`;
		const inputs = JSON.parse(gitBound.get(path));
		inputs.find(item => item.path === "LICENSE").sha256 = "0".repeat(64);
		gitBound.set(path, Buffer.from(canonicalJson(inputs)));
		const stable = inputs.map(({ path: name, mode, sha256: digest }) => ({
			path: name, mode, sha256: digest
		}));
		report.builds[attempt].authorInputsSha256 = sha256(canonicalJson(stable));
	}
	gitBound.set("report.json", Buffer.from(canonicalJson(report)));
	await assert.rejects(verify(gitBound), /LICENSE/u
		, "author input must remain bound to Git");
	const artifact = new Map(originals);
	const firstArchive = accepted.receipt.packages[0].artifacts[0].path;
	const archivePath = `handoff/${firstArchive}`;
	artifact.set(archivePath, Buffer.concat([
		artifact.get(archivePath), Buffer.from("x")
	]));
	await assert.rejects(verify(artifact), new RegExp(firstArchive, "u")
		, "prepared package archive byte");
	const caller = new Map(originals);
	caller.set("consumers/c.c", Buffer.concat([
		caller.get("consumers/c.c"), Buffer.from("\n")
	]));
	await assert.rejects(verify(caller), /c caller source/u
		, "installed C caller byte");
	const installedIr = new Map(originals);
	const packagePath = "c/lean-bridge-package.json";
	const packageReceipt = JSON.parse(installedIr.get(packagePath));
	packageReceipt.bindingIrSha256 = "0".repeat(64);
	installedIr.set(packagePath, Buffer.from(canonicalJson(packageReceipt)));
	await assert.rejects(verify(installedIr), /c installed compiler Binding IR/u
		, "installed package Binding IR identity");
	const execution = new Map(originals);
	const stdoutPath = "c/installed.stdout";
	const executionResult = JSON.parse(execution.get(stdoutPath));
	executionResult.calls++;
	execution.set(stdoutPath, Buffer.from(canonicalJson(executionResult)));
	await assert.rejects(verify(execution), /c installed stdout/u
		, "retained installed execution stdout");
	const observation = new Map(originals);
	const cReport = JSON.parse(observation.get("c/report.json"));
	const top = JSON.parse(observation.get("report.json"));
	cReport.calls++;
	top.reports.find(item => item.profile === "c").calls++;
	observation.set("c/report.json", Buffer.from(canonicalJson(cReport)));
	observation.set("report.json", Buffer.from(canonicalJson(top)));
	await assert.rejects(verify(observation), /c calls/u
		, "installed execution counter");
	const runtime = new Map(originals);
	const changedRuntime = JSON.parse(runtime.get("runtime.json"));
	changedRuntime.cc += " changed";
	runtime.set("runtime.json", Buffer.from(canonicalJson(changedRuntime)));
	await assert.rejects(verify(runtime), /runtime record/u
		, "independent runtime identity");
	await verify(originals);
	return {
		accepted, provenanceControls, reconciliationControls: 1
		, gitBindingControls: 1, packageControls: 1, callerControls: 1
		, installedIrControls: 1, executionRecordControls: 1
		, observationControls: 1, runtimeControls: 1
	};
};
