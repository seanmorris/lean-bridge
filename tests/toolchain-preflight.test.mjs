/**
 * Tests complete toolchain preflight and profile evaluation.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";

import { collectToolchainPreflight, renderToolchainPreflight, toolchainPreflightProfiles } from "../src/adoption/toolchain-preflight.mjs";

const commandFor = async command => `/tools/${command}`;
const absent = new Set();
const versions = new Map();
const runner = Object.freeze({
	/**
	 * Returns deterministic probe output or a configured absence.
	 *
	 * @param command - Synthetic executable path.
	 */
	async capture(command) {
		const id = command.split("/").at(-1);
		return absent.has(id)
			? { exitCode: 1, stdout: "", stderr: "unavailable", errorCode: null }
			: { exitCode: 0, stdout: `${id} ${versions.get(id) ?? (id === "node" ? "22.0.0" : "1.0.0")}\n`, stderr: "", errorCode: null };
	}
});

test("preflight probes every tool before reporting multiple missing requirements", async () => {
	absent.clear();
	versions.clear();
	absent.add("clang");
	absent.add("clang++");
	absent.add("cmake");
	const report = await collectToolchainPreflight({ profile: "native", runner, resolveCommand: commandFor, environment: { PATH: "/tools" } });
	assert.equal(report.accepted, false);
	assert.deepEqual(report.missing, ["clang", "clang++", "cmake"]);
	assert.equal(report.tools.length, 21);
	assert.match(renderToolchainPreflight(report), /missing=clang,clang\+\+,cmake/);
});

test("component profile accepts either a working Nix or Docker engine", async () => {
	absent.clear();
	versions.clear();
	absent.add("nix");
	const report = await collectToolchainPreflight({ profile: "component", runner, resolveCommand: commandFor, environment: { PATH: "/tools" } });
	assert.equal(report.accepted, true);
	assert.deepEqual(report.unsatisfiedAlternatives, []);

	absent.add("docker");
	const blocked = await collectToolchainPreflight({ profile: "component", runner, resolveCommand: commandFor, environment: { PATH: "/tools" } });
	assert.equal(blocked.accepted, false);
	assert.deepEqual(blocked.unsatisfiedAlternatives, [["nix", "docker"]]);
});

test("preflight profiles and result objects are closed and machine-readable", async () => {
	absent.clear();
	versions.clear();
	assert.deepEqual(toolchainPreflightProfiles, ["core", "component", "native", "php", "managed", "browser", "performance", "reproducibility", "full"]);
	const report = await collectToolchainPreflight({ profile: "core", runner, resolveCommand: commandFor, environment: { PATH: "/tools" } });
	assert.equal(report.accepted, true);
	assert.deepEqual(Object.keys(report), ["schemaVersion", "kind", "profile", "accepted", "host", "requirements", "missing", "unsatisfiedAlternatives", "tools"]);
	assert.deepEqual(Object.keys(report.tools[0]), ["id", "available", "compatible", "command", "version", "requirement", "failure", "remediation"]);
	assert.doesNotThrow(() => JSON.parse(JSON.stringify(report)));
});

test("core profile rejects an incompatible Node version with remediation", async () => {
	absent.clear();
	versions.clear();
	versions.set("node", "20.19.0");
	const report = await collectToolchainPreflight({ profile: "core", runner, resolveCommand: commandFor, environment: { PATH: "/tools" } });
	assert.equal(report.accepted, false);
	assert.deepEqual(report.missing, ["node"]);
	assert.equal(report.tools.find(tool => tool.id === "node")?.failure, "incompatible-version");
	assert.match(report.tools.find(tool => tool.id === "node")?.remediation ?? "", /22 or newer/);
});
