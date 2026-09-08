/**
 * Execute the published local-adapter example against the maintained Lean binary.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the documentation's unmodified API example returns the stated pairs", async () => {
	const markdown = await readFile(new URL("../docs/demo-api.md", import.meta.url), "utf8");
	const example = markdown.match(/```js\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(example, "The recipe must contain an executable JavaScript example");
	const runtime = new URL("../demos/lean-sweep-and-prune/runtime.mjs", import.meta.url).href;
	const source = example.replace("'./demos/lean-sweep-and-prune/runtime.mjs'", JSON.stringify(runtime));
	assert.match(source, /finally\s*\{\s*solve\.dispose\(\)/u);
	const output = execFileSync(process.execPath, ["--input-type=module"], {
		input: source, encoding: "utf8", timeout: 30000
	});
	assert.match(output, /^\[ 0, 2 \]\n3\n$/u);
});
