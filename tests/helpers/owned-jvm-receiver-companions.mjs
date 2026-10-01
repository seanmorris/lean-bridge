/**
 * Source-free consumers of the six preceding receiver targets in a shared build.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { installCopiedConsumer, runCopied } from "./copied-fixture-install.mjs";
import { installPythonWheel } from "./python-wheel-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Check prior ownership contracts against archives built alongside the Maven JAR.
 *
 * @param options - Relocated handoff, package entries and selected consumer tools.
 */
export const checkOwnedJvmReceiverCompanions = async options => {
	const { consumer, handoff, environment, dependencies, receipt } = options;
	const companions = {};
	for(const [profile, target, file, prefix, success, checks] of [
		["cpp", "cpp", "owned-cpp-borrows.cpp", "#define OWNED_BORROW_INSTALLED 1\n", "owned-cpp-borrows-installed", 407]
		, ["rust", "cargo", "owned-rust-borrows.rs", "use owned_receivers::*;\n", "owned-rust-borrows", 440]
		, ["ruby", "rubygems", "owned-installed-ruby-borrows.rb", "", null, 137]
		, ["dotnet", "nuget", "owned-installed-dotnet-borrows.cs", "", null, null]
	]) {
		const result = await installCopiedConsumer({ profile, consumer, handoff
			, environment, dependencies
			, packages: receipt.packages.filter(item => item.target === target)
			, fixture: { source: async () => prefix + await readFile(`tests/fixtures/structured-types/${file}`, "utf8")
				, success, ...success ? {} : { parseResult: JSON.parse } } });
		if(checks !== null) assert.equal(result.checks, checks);
		else assert.ok(result.checks > 100);
		companions[profile] = result;
	}
	const root = join(consumer, "python"), wheel = receipt.packages.find(item => item.target === "pypi");
	const { command } = await installPythonWheel({ root
		, archive: join(handoff, wheel.artifacts[0].path)
		, python: environment.LEAN_BRIDGE_PYTHON, typingVersion: "4.6.0" });
	await saveLakeFile(root, "consumer.py", await readFile("tests/fixtures/structured-types/owned-installed-python-borrows.py", "utf8"));
	const observed = await runCopied(command, ["-I", "-B", "consumer.py"], root);
	assert.equal(observed.stderr, "");
	const result = JSON.parse(observed.stdout);
	assert.equal(result.checks, 328); assert.equal(result.ordinaryImport, true);
	companions.python = result;
	return companions;
};
