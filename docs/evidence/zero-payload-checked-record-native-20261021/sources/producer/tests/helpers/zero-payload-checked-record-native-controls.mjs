/**
 * Challenge native zero-payload evidence with independent destructive mutations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadNativeReport
} from "./zero-payload-checked-record-native-report.mjs";

/**
 * Require the live checker to reject semantic, Git, package and caller drift.
 *
 * @param originals - Untampered records keyed by route-relative path.
 * @param options - Exact route, revisions, runtime and ABI floor.
 */
export const zeroPayloadNativeNegativeControls = async (originals, options) => {
	const read = records => async path => {
		assert.ok(records.has(path), `Missing original ${path}`);
		return records.get(path);
	};
	const verify = records => checkZeroPayloadNativeReport(read(records), options);
	const accepted = await verify(originals);

	const semantic = new Map(originals);
	const semanticReport = JSON.parse(semantic.get("report.json"));
	for(const attempt of [0, 1])
	{
		const path = `build-${attempt}/model.json`;
		const model = JSON.parse(semantic.get(path));
		model.bindingIr.types.find(type => type.name === "Token")
			.fields[0].name = "renamed";
		model.bindingIrSha256 = hashBindingIr(model.bindingIr);
		const bytes = Buffer.from(canonicalJson(model));
		semantic.set(path, bytes);
		semanticReport.builds[attempt].bindingIrSha256 = model.bindingIrSha256;
		semanticReport.builds[attempt].modelSha256 = sha256(bytes);
	}
	semantic.set("report.json", Buffer.from(canonicalJson(semanticReport)));
	await assert.rejects(verify(semantic), /independently reconciles/u
		, "zero-payload record shape mutation");

	const gitBound = new Map(originals);
	const gitReport = JSON.parse(gitBound.get("report.json"));
	for(const attempt of [0, 1])
	{
		const path = `build-${attempt}/author-inputs.json`;
		const inputs = JSON.parse(gitBound.get(path));
		inputs.find(item => item.path === "LICENSE").sha256 = "0".repeat(64);
		gitBound.set(path, Buffer.from(canonicalJson(inputs)));
		const stable = inputs.map(({ path: name, mode, sha256: digest }) => ({
			path: name, mode, sha256: digest
		}));
		gitReport.builds[attempt].authorInputsSha256 = sha256(canonicalJson(stable));
	}
	gitBound.set("report.json", Buffer.from(canonicalJson(gitReport)));
	await assert.rejects(verify(gitBound), /LICENSE/u, "Git-bound author input");

	const artifact = new Map(originals);
	const archive = accepted.receipt.packages[0].artifacts[0].path;
	const archivePath = `handoff/${archive}`;
	artifact.set(archivePath, Buffer.concat([
		artifact.get(archivePath), Buffer.from("x")
	]));
	await assert.rejects(verify(artifact), new RegExp(archive, "u")
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
	const result = JSON.parse(execution.get(stdoutPath));
	result.calls++;
	execution.set(stdoutPath, Buffer.from(canonicalJson(result)));
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
	await assert.rejects(verify(runtime), /runtime/u
		, "independent runtime identity");

	await verify(originals);
	return {
		accepted, semanticControls: 1, gitBindingControls: 1
		, packageControls: 1, callerControls: 1, installedIrControls: 1
		, executionRecordControls: 1, observationControls: 1, runtimeControls: 1
	};
};
