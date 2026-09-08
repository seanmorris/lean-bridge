/**
 * Check the executable consumer tutorial's public imports, ranges, and local links.
 *
 * @file
 */

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const fixture = "tests/fixtures/component-consumer";
const docs = ["docs/javascript-typescript.md", "docs/react.md", "docs/browser-workers.md"];

test("consumer docs use portable paths, valid local links, and public package imports", async () => {
	for(const path of docs)
	{
		const source = await readFile(path, "utf8");
		assert.doesNotMatch(source, /—|(?:^|[^A-Za-z0-9_])\/app(?:\/|\b)/u);
		for(const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu))
		{
			const target = match[1].split("#")[0];
			if(!target || /^[a-z]+:/u.test(target)) continue;
			await access(resolve(dirname(path), target));
		}
		for(const match of source.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gmu))
			assert.doesNotMatch(match[1], /\b(?:ccall|cwrap|WebAssembly)\b|_Lean|@lean-bridge\/alpha|poc\/lean-link/u);
	}
});

test("React and worker fixtures import the installed component without repository runtime imports", async () => {
	const packageJson = JSON.parse(await readFile(`${fixture}/package.json`, "utf8"));
	assert.equal(packageJson.dependencies.react, "19.2.8");
	for(const name of ["main.tsx", "lean.ts", "lean-worker.ts", "typecheck.ts"])
	{
		const source = await readFile(`${fixture}/${name}`, "utf8");
		assert.doesNotMatch(source, /\.\.\/|@lean-bridge\/alpha|ccall|cwrap|\.dispose\(/u);
	}
	assert.match(await readFile(`${fixture}/lean.ts`, "utf8"), /import\("onboarding-small"\)/u);
	assert.match(await readFile(`${fixture}/main.tsx`, "utf8"), /worker\.terminate\(\)/u);
	assert.match(await readFile(`${fixture}/vite.config.ts`, "utf8"), /assetsInlineLimit: 0/u);
	assert.match(await readFile(`${fixture}/vite.config.ts`, "utf8"), /worker: \{ format: "es" \}/u);
});

test("the example validates the supported numeric boundary before invoking the package", async () => {
	const source = await readFile(`${fixture}/lean.ts`, "utf8");
	const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
	const { calculate, maximumSum } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
	const calls = [];
	const api = { add: (left, right) => { calls.push([left, right]); return left + right; }, isEmpty: value => value === "" };
	assert.deepEqual(calculate(api, { left: "20", right: "22", text: "" }), { sum: "42", empty: true });
	assert.deepEqual(calculate(api, { left: String(maximumSum), right: "0", text: "Lean" }), { sum: "2147483647", empty: false });
	for(const input of [{ left: "-1", right: "0" }, { left: "1.5", right: "1" }, { left: "", right: "1" }, { left: String(maximumSum), right: "1" }])
		assert.throws(() => calculate(api, { ...input, text: "" }), RangeError);
	assert.equal(calls.length, 2, "Rejected inputs never reach the installed call");
});
