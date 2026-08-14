#!/usr/bin/env node
/**
 * Audits the PHP Wasm sources workflow.
 *
 * @file
 */


import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);

const sources = Object.freeze({
	phpWasm: Object.freeze({
		commit: "bd9a46bf4984bfbdfef4bb6f5b04b7dcd6264c89"
		, files: Object.freeze({
			"source/resolveDependencies.mjs": "f70c7f469d6d47ee268421e976e0f3e536f418f6b1bc8988b0c77d1c912ed08b"
			, "source/PhpBase.mjs": "d748ee69b4828dc16dc9562b104a44b0eb0136c794c0f641d43bdc9d065e6101"
			, "packages/intl/8.4.mjs": "a171cbc91210b20d2c3e3bb78d5349adefe6b06aac9bbbdce75fc12f9b21871b"
		})
	})
	, vrzno: Object.freeze({
		commit: "c3aa3b9dd9de0eab88e3e3c3dc0f86d813ebb53d"
		, files: Object.freeze({
			"vrzno.c": "bae556833b8bb2b40339c66fde27ee84794652e9ef28a7f73e1affea5d2f427e"
			, "vrzno_object.c": "3d8b201025c2c386f69464faade28212ed2c8bc8db75115516ba8ce586bd1241"
		})
	})
	, weaker: Object.freeze({
		commit: "8e147cc8832589f582ab61a12b9c429dee1e15b0"
		, files: Object.freeze({
			"weakermap/WeakerMap.mjs": "42250e992c7d1dedc36b5ac984c77327c6cc99e2cf002204c8a1fa8138041eff"
		})
	})
});

const usage = () => {
	process.stderr.write("Usage: audit-php-wasm-sources.mjs --php-wasm PATH --vrzno PATH --weaker PATH\n");
};

const parseArguments = argv => {
	const result = {};
	for(let index = 0; index < argv.length; index += 2)
	{
		const flag = argv[index];
		const value = argv[index + 1];
		if(!value || !new Set(["--php-wasm", "--vrzno", "--weaker"]).has(flag)) return null;
		result[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = resolve(value);
	}
	return result.phpWasm && result.vrzno && result.weaker ? result : null;
};

const sha256 = value => createHash("sha256").update(value).digest("hex");

const verifyRepository = async (name, root) => {
	const expected = sources[name];
	const { stdout } = await execute("git", ["-C", root, "rev-parse", "HEAD"]);
	const commit = stdout.trim();
	if(commit !== expected.commit)
	{
		throw new Error(`${name} commit ${commit} does not match ${expected.commit}`);
	}
	const files = {};
	for(const [path, expectedHash] of Object.entries(expected.files))
	{
		const actualHash = sha256(await readFile(resolve(root, path)));
		if(actualHash !== expectedHash)
		{
			throw new Error(`${name}/${path} hash ${actualHash} does not match ${expectedHash}`);
		}
		files[path] = actualHash;
	}
	return { commit, files };
};

const reproduceResolverBoundary = async phpWasmRoot => {
	const resolverUrl = pathToFileURL(resolve(phpWasmRoot, "source/resolveDependencies.mjs"));
	const { resolveDependencies } = await import(resolverUrl.href);
	const nested = resolveDependencies([{
		getLibs: () => [{
			getLibs: () => [{ name: "leaf.so", url: new URL("file:///leaf.so") }]
		}]
	}], { phpVersion: "8.4" });
	if(nested.libs.length !== 1 || typeof nested.libs[0].getLibs !== "function")
	{
		throw new Error("PHP-Wasm resolver recursion behavior changed; repeat the architecture audit");
	}
	const complete = resolveDependencies([{
		getLibs: () => [
			{ name: "runtime.so", url: new URL("file:///runtime.so") }
			, { name: "component.so", url: new URL("file:///component.so"), ini: true }
		]
	}], { phpVersion: "8.4" });
	if(complete.libs.map(value => value.name).join(",") !== "runtime.so,component.so")
	{
		throw new Error("PHP-Wasm resolver no longer preserves a complete ordered closure");
	}
	return {
		recursivelyExpandsReturnedHelpers: false
		, preservesCompleteClosureOrder: true
		, malformedNestedUrl: nested.libs[0].url
	};
};

const main = async () => {
	const paths = parseArguments(process.argv.slice(2));
	if(!paths)
	{
		usage();
		process.exitCode = 2;
		return;
	}
	const [phpWasm, vrzno, weaker] = await Promise.all([
		verifyRepository("phpWasm", paths.phpWasm)
		, verifyRepository("vrzno", paths.vrzno)
		, verifyRepository("weaker", paths.weaker)
	]);
	const resolver = await reproduceResolverBoundary(paths.phpWasm);
	const { stdout: weakerTap } = await execute(
		process.execPath,
		["--expose-gc", "weakermap/test.mjs"],
		{ cwd: paths.weaker, maxBuffer: 8 * 1024 * 1024 },
	);
	if(!weakerTap.includes("# pass 11") || !weakerTap.includes("# fail 0"))
	{
		throw new Error("maintained Weaker test suite did not pass 11 of 11 tests");
	}
	process.stdout.write(`${JSON.stringify({ phpWasm, vrzno, weaker, resolver, weakerTests: 11 }, null, 2)}\n`);
};

main().catch(error => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
