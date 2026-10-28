/**
 * Compiler-free npm and strict TypeScript controls for optional parameters.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import {
	checkOptionalParameters
} from "./fixtures/optional-parameter-consumers/javascript.mjs";
import { optionalParameterReview } from "./helpers/optional-parameter-fixture.mjs";

const runtime = [
	"export const runtime = Object.freeze({"
	, "  call(_declaration, arguments_) { return arguments_[0]; }"
	, "});", ""
].join("\n");

test("generated npm wrappers distinguish every optional host case", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-optional-npm-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const packageRoot = join(root, "node_modules/optional-parameters");
	const files = {
		...generateJavaScriptPackage(optionalParameterReview())
		, "internal/runtime.mjs": runtime
	};
	for(const [path, contents] of Object.entries(files))
	{
		const destination = join(packageRoot, path);
		await mkdir(dirname(destination), { recursive: true });
		await writeFile(destination, contents);
	}
	const module = await import(pathToFileURL(
		join(packageRoot, "index.mjs")).href);
	assert.deepEqual(checkOptionalParameters(module), {
		checks: 27, rejections: 7
	});
	assert.match(files["index.mjs"]
		, /if \(arguments\.length <= 0\) value0 = /u);
	assert.doesNotMatch(files["index.mjs"], /value0 \?\?=|value0 \|\|=/u);

	await writeFile(join(root, "package.json")
		, '{"private":true,"type":"module"}\n');
	await writeFile(join(root, "index.mts"), await readFile(
		"tests/fixtures/optional-parameter-consumers/index.mts"
	));
	const commonGit = resolve(execFileSync(
		"git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" }
	).trim());
	const repository = commonGit.endsWith("/.git")
		? dirname(commonGit) : process.cwd();
	const typescript = join(repository, "node_modules/typescript/lib/tsc.js");
	const checked = await processBuildRunner.capture({
		command: process.execPath, cwd: root
		, args: [typescript, "--strict", "--noEmit", "--skipLibCheck", "false"
			, "--target", "ES2022", "--module", "NodeNext"
			, "--moduleResolution", "NodeNext", "index.mts"]
	}).catch(error => {
		error.message += `: ${JSON.stringify(error.details)}`;
		throw error;
	});
	assert.equal(checked.stdout, "");
	assert.equal(checked.stderr, "");
});
