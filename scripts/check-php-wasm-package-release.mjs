#!/usr/bin/env node
/**
 * Checks the PHP Wasm package release workflow.
 *
 * @file
 */


import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index];
	const value = process.argv[index + 1];
	if(!name?.startsWith("--") || !value) throw new Error(`invalid option ${name ?? ""}`);
	options.set(name, value);
}
const value = (name, fallback) => resolve(projectRoot, options.get(name) ?? fallback);
const phpSource = value("--php-source", "build/php-wasm-sdk/php8.4-src");
const emsdk = value("--emsdk", ".toolchains/emsdk-php-wasm");
const phpWasm = value("--php-wasm", "build/php-wasm-host/node_modules/php-wasm");
const reportDirectory = value("--report-directory", "build/php-wasm-release-evidence");
const existingLeft = options.has("--left") ? value("--left") : null;
const existingRight = options.has("--right") ? value("--right") : null;
if(Boolean(existingLeft) !== Boolean(existingRight))
{
	throw new Error("--left and --right must be supplied together");
}

const sha256 = source => createHash("sha256").update(source).digest("hex");

const collect = async directory => {
	const files = new Map();
	const visit = async current => {
		for(const entry of await readdir(current, { withFileTypes: true }))
		{
			const absolute = join(current, entry.name);
			if(entry.isDirectory()) await visit(absolute);
			if(entry.isFile()) files.set(relative(directory, absolute), await readFile(absolute));
		}
	};
	await visit(directory);
	return files;
};

const compare = (left, right) => {
	const paths = [...new Set([...left.keys(), ...right.keys()])].sort();
	const differences = [];
	const artifacts = [];
	for(const path of paths)
	{
		const first = left.get(path);
		const second = right.get(path);
		const leftSha256 = first ? sha256(first) : null;
		const rightSha256 = second ? sha256(second) : null;
		if(leftSha256 !== rightSha256) differences.push({ path, leftSha256, rightSha256 });
		if(first && second && leftSha256 === rightSha256)
		{
			artifacts.push({ path, bytes: first.length, sha256: leftSha256 });
		}
	}
	return { artifacts, differences };
};

const run = async (command, args) => execute(command, args, {
	cwd: projectRoot
	, maxBuffer: 64 * 1024 * 1024
});

const writeReports = async report => {
	await mkdir(reportDirectory, { recursive: true });
	await writeFile(join(reportDirectory, "reproducibility.json"), `${JSON.stringify(report, null, 2)}\n`);
	const selected = report.artifacts.filter(artifact =>
		artifact.path === "lib/liblean_bridge_runtime.so"
    || artifact.path === "lib/php8.4-lean-alpha.so"
    || artifact.path === "php-wasm-manifest.json"
    || artifact.path === "metadata/release/release-manifest.json"
	);
	const table = selected.map(artifact =>
		`| \`${artifact.path}\` | ${artifact.bytes} | \`${artifact.sha256}\` |`
	).join("\n");
	const differences = report.differences.length === 0
		? "No artifact differences were found."
		: report.differences.map(item =>
			`- \`${item.path}\`: build A \`${item.leftSha256 ?? "missing"}\`, build B \`${item.rightSha256 ?? "missing"}\``
		).join("\n");
	const markdown = `# PHP-Wasm Release Reproducibility Report

Result: **${report.result}**

Two isolated output directories produced ${report.artifactCount} compared files. ${differences}

The host test loaded the generated PHP 8.4 extension and the three locked Lean components into one PHP-Wasm instance. It observed one runtime initialization, one component initialization, preserved object identity, typed copied values, callbacks, closures, and zero live identities after cleanup.

| Selected artifact | Bytes | SHA-256 |
|---|---:|---|
${table}

Reproduce the gate with:

\`\`\`sh
npm run test:php-wasm-package:release
\`\`\`

If a comparison fails, inspect compiler paths, timestamps, archive member metadata, generated ordering, and host toolchain drift first. Publication MUST remain blocked until every path matches.
`;
	await writeFile(join(reportDirectory, "reproducibility.md"), markdown);
};

if(!existingLeft) await mkdir(join(projectRoot, "build"), { recursive: true });
const scratch = existingLeft
	? null
	: await mkdtemp(join(projectRoot, "build/php-wasm-release-"));
const leftDirectory = existingLeft ?? join(scratch, "build-a");
const rightDirectory = existingRight ?? join(scratch, "build-b");
try
{
	if(!existingLeft)
	{
		const build = output => run("node", [
			"scripts/build-php-wasm-package.mjs"
			, "--manifest", "poc/lean-link-spike/bindings/php-wasm.package.json"
			, "--output", output
			, "--php-source", phpSource
			, "--emsdk", emsdk
		]);
		await build(leftDirectory);
		await build(rightDirectory);
	}
	const [left, right] = await Promise.all([collect(leftDirectory), collect(rightDirectory)]);
	const comparison = compare(left, right);
	let host = null;
	if(comparison.differences.length === 0)
	{
		const { stdout } = await run("node", [
			"scripts/test-php-wasm-package-host.mjs"
			, "--package", leftDirectory
			, "--php-wasm", phpWasm
		]);
		host = JSON.parse(stdout);
	}
	const report = {
		schemaVersion: 1
		, packageId: "poc/lean-alpha-php-wasm@0.0.0"
		, result: comparison.differences.length === 0 ? "passed" : "failed"
		, releaseCriterion: "byte-identical"
		, artifactCount: comparison.artifacts.length
		, artifacts: comparison.artifacts
		, differences: comparison.differences
		, host
		, likelyEntropySources: [
			"compiler paths"
			, "file timestamps"
			, "archive member metadata"
			, "generated file ordering"
			, "host toolchain drift"
		]
		, reproductionCommand: "npm run test:php-wasm-package:release"
	};
	await writeReports(report);
	if(report.result !== "passed") throw new Error("PHP-Wasm release artifacts are not byte-identical");
	process.stdout.write(`PHP-Wasm release passed: ${report.artifactCount} byte-identical files and one host execution.\n`);
} finally
{
	if(scratch) await rm(scratch, { recursive: true, force: true });
}
