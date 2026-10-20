/**
 * Challenge value-index evidence with semantic provenance and installed-byte mutations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexBrowserReport
} from "./checked-record-value-index-browser-report.mjs";

const instantiation = type =>
	type.source.extensions["lean-lang.org/instantiation"];

/**
 * Prove the live checker refuses nine independently destructive substitutions.
 *
 * @param originals - Original route records keyed by route-relative path.
 * @param options - Exact route, producer, consumer and runtime identities.
 */
export const checkedRecordValueIndexBrowserNegativeControls = async (
	originals, options
) => {
	const read = records => async path => {
		assert.ok(records.has(path), `Missing original ${path}`);
		return records.get(path);
	};
	const verify = records => checkCheckedRecordValueIndexBrowserReport(
		read(records), options);
	const accepted = await verify(originals);
	const controls = [
		["true-to-false", /On preserves/u, ir => {
			instantiation(ir.types.find(type => type.name === "On")).arguments[0].value
				= "false";
		}]
		, ["unicode-value", /UnicodeToken preserves/u, ir => {
			instantiation(ir.types.find(type => type.name === "UnicodeToken"))
				.arguments[1].value = "λ";
		}]
		, ["same-text-other-kind", /ZeroToken preserves/u, ir => {
			instantiation(ir.types.find(type => type.name === "ZeroToken")).arguments[1]
				= { kind: "value", type: { kind: "primitive", name: "string" }, value: "0" };
		}]
		, ["missing-instantiation", /WideToken has value-index provenance/u, ir => {
			delete ir.types.find(type => type.name === "WideToken")
				.source.extensions["lean-lang.org/instantiation"];
		}]
		, ["missing-record", /Exact value-index record set/u, ir => {
			ir.types = ir.types.filter(type => type.name !== "Off");
		}]
	];
	let provenanceControls = 0;
	for(const [label, pattern, mutate] of controls)
	{
		const records = new Map(originals);
		const path = "build-0/binding/binding-ir.json";
		const ir = JSON.parse(records.get(path));
		mutate(ir);
		records.set(path, Buffer.from(canonicalJson(ir)));
		await assert.rejects(verify(records), pattern, label);
		provenanceControls++;
	}
	const reconciled = new Map(originals);
	const buildPath = "build-0/binding/binding-ir.json";
	const changedBinding = JSON.parse(reconciled.get(buildPath));
	changedBinding.types.find(type => type.name === "On").fields[0].name = "renamed";
	reconciled.set(buildPath, Buffer.from(canonicalJson(changedBinding)));
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
		, "author input must remain bound to git");
	const semantic = new Map(originals);
	const installedPath
		= "browser/browser-javascript/installed-binding-ir.json";
	const installed = JSON.parse(semantic.get(installedPath));
	instantiation(installed.types.find(type => type.name === "On"))
		.arguments[0].value = "false";
	semantic.set(installedPath, Buffer.from(canonicalJson(installed)));
	await assert.rejects(verify(semantic), /On preserves/u
		, "installed Binding IR semantic mutation");
	const corrupted = new Map(originals);
	corrupted.set(installedPath, Buffer.concat([
		corrupted.get(installedPath), Buffer.from("x")
	]));
	await assert.rejects(verify(corrupted), /Unexpected|JSON/u
		, "corrupted installed Binding IR byte");
	await verify(originals);
	return {
		accepted, provenanceControls, reconciliationControls: 1
		, gitBindingControls: 1, installedIrControls: 2
	};
};
