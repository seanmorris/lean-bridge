/**
 * Challenge zero-payload evidence with independent semantic and byte mutations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadBrowserReport, checkZeroPayloadNpmReport
} from "./zero-payload-checked-record-browser-report.mjs";

/**
 * Prove the live checkers refuse independently destructive substitutions.
 *
 * @param originals - Original route records keyed by route-relative path.
 * @param options - Exact route, producer, consumer and runtime identities.
 */
export const zeroPayloadBrowserNegativeControls = async (originals, options) => {
	const read = records => async path => {
		assert.ok(records.has(path), `Missing original ${path}`);
		return records.get(path);
	};
	const verify = async records => ({
		npm: await checkZeroPayloadNpmReport(read(records), options)
		, browser: await checkZeroPayloadBrowserReport(read(records), options)
	});
	const accepted = await verify(originals);
	let semanticControls = 0, byteControls = 0;

	const binding = new Map(originals);
	const bindingPath = "build-0/binding/binding-ir.json";
	const changedBinding = JSON.parse(binding.get(bindingPath));
	changedBinding.types.find(type => type.name === "Witness").fields.push({
		name: "invented", type: { kind: "primitive", name: "bool" }
	});
	binding.set(bindingPath, Buffer.from(canonicalJson(changedBinding)));
	await assert.rejects(verify(binding), /contract|Expected values|binding/iu
		, "changed proof-only carrier");
	semanticControls++;

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
	await assert.rejects(verify(gitBound), /LICENSE/u, "author input git binding");
	semanticControls++;

	const installed = new Map(originals);
	const installedPath = "browser/browser-javascript/installed-binding-ir.json";
	const installedBinding = JSON.parse(installed.get(installedPath));
	installedBinding.types.find(type => type.name === "Witness").fields.push({
		name: "invented", type: { kind: "primitive", name: "bool" }
	});
	installed.set(installedPath, Buffer.from(canonicalJson(installedBinding)));
	await assert.rejects(verify(installed), /contract|Expected values|binding/iu
		, "installed Binding IR mutation");
	semanticControls++;

	const observed = new Map(originals);
	const browser = JSON.parse(observed.get("browser.json"));
	browser.reports[0].observations[0].observation.results.checks++;
	observed.set("browser.json", Buffer.from(canonicalJson(browser)));
	await assert.rejects(verify(observed), /Expected values/u
		, "browser observation mutation");
	semanticControls++;

	for(const [label, path] of [
		["component archive", `handoff/${accepted.npm.receipt.package.archive}`]
		, ["immutable caller", "callers/check.mjs"]
		, ["browser input", "browser/browser-worker/check.mjs"]
		, ["retained browser report", "browser/browser-react/report.json"]
	]) {
		const records = new Map(originals);
		records.set(path, Buffer.concat([records.get(path), Buffer.from("x")]));
		await assert.rejects(verify(records), undefined, label);
		byteControls++;
	}
	await verify(originals);
	return { accepted, semanticControls, byteControls };
};
