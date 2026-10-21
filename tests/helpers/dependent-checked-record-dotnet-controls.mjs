/**
 * Challenge retained dependent checked-record NuGet records with destructive mutations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkDependentCheckedRecordDotnetCiRecords
} from "./dependent-checked-record-dotnet-ci-report.mjs";

const changeJson = (records, path, change) => {
	const value = JSON.parse(records.get(path));
	change(value);
	const bytes = Buffer.from(canonicalJson(value));
	records.set(path, bytes);
	return { value, bytes };
};

/**
 * Require the live .NET checker to reject semantic, Git, package, caller,
 * observation, runtime and toolchain drift.
 *
 * @param originals - Untampered records keyed by route-relative path.
 * @param options - Closed route, revisions, floor and hosted .NET path.
 * @param dotnetIdentity - Fresh or retained identity of that .NET host.
 */
export const dependentCheckedRecordDotnetNegativeControls = async (
	originals, options, dotnetIdentity
) => {
	const { tapSource, ...selected } = options;
	const read = records => async path => {
		assert.ok(records.has(path), `Missing original ${path}`);
		return records.get(path);
	};
	const verify = records => checkDependentCheckedRecordDotnetCiRecords(selected, {
		tap: tapSource, read: read(records)
		, paths: [...records.keys()].sort(), dotnetIdentity
	});
	const accepted = await verify(originals);

	const semantic = new Map(originals);
	const semanticReport = JSON.parse(semantic.get("report.json"));
	for(const attempt of [0, 1])
	{
		const path = `build-${attempt}/model.json`;
		const changed = changeJson(semantic, path, model => {
			model.bindingIr.types.find(type => type.name === "Dependent")
				.fields[1].name = "renamed";
			model.bindingIrSha256 = hashBindingIr(model.bindingIr);
		});
		semanticReport.builds[attempt].bindingIrSha256
			= changed.value.bindingIrSha256;
		semanticReport.builds[attempt].modelSha256 = sha256(changed.bytes);
	}
	semantic.set("report.json", Buffer.from(canonicalJson(semanticReport)));
	await assert.rejects(verify(semantic), /reconciles|Expected values/iu
		, "dependent checked-record C# semantic mutation");

	const gitBound = new Map(originals);
	const gitReport = JSON.parse(gitBound.get("report.json"));
	for(const attempt of [0, 1])
	{
		const path = `build-${attempt}/author-inputs.json`;
		const changed = changeJson(gitBound, path, inputs => {
			inputs.find(item => item.path === "LICENSE").sha256 = "0".repeat(64);
		});
		const stable = changed.value.map(({
			path: name, mode, sha256: digest
		}) => ({ path: name, mode, sha256: digest }));
		gitReport.builds[attempt].authorInputsSha256
			= sha256(canonicalJson(stable));
	}
	gitBound.set("report.json", Buffer.from(canonicalJson(gitReport)));
	await assert.rejects(verify(gitBound), /LICENSE/u
		, "dependent checked-record C# Git-bound author input");

	const archive = new Map(originals);
	const packagePath = accepted.packageSha256;
	const archiveName = JSON.parse(archive.get(
		"handoff/package-set-receipt.json"
	)).packages[0].artifacts[0].path;
	archive.set(`handoff/${archiveName}`, Buffer.concat([
		archive.get(`handoff/${archiveName}`), Buffer.from("x")
	]));
	await assert.rejects(verify(archive), undefined
		, `dependent checked-record C# package ${packagePath}`);

	const caller = new Map(originals);
	caller.set("consumer.cs", Buffer.concat([
		caller.get("consumer.cs"), Buffer.from("\n")
	]));
	await assert.rejects(verify(caller), /consumer\.cs|Expected values/iu
		, "dependent checked-record C# caller byte");

	const observation = new Map(originals);
	changeJson(observation, "installed.json", value => value.counts.calls++);
	await assert.rejects(verify(observation), /Expected values/iu
		, "dependent checked-record C# installed observation");

	const runtime = new Map(originals);
	changeJson(runtime, "runtime.json", value => value.arch = "changed");
	await assert.rejects(verify(runtime), /Expected values|runtime/iu
		, "dependent checked-record C# runtime identity");

	const toolchain = new Map(originals);
	changeJson(toolchain, "toolchain.json", value => value.sdk.version = "0");
	await assert.rejects(verify(toolchain), /Expected values|toolchain/iu
		, "dependent checked-record C# toolchain identity");

	await verify(originals);
	return {
		accepted, semanticControls: 1, gitBindingControls: 1
		, packageControls: 1, callerControls: 1, observationControls: 1
		, runtimeControls: 1, toolchainControls: 1
	};
};
