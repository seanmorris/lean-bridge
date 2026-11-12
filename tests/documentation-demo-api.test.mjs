/**
 * Execute the published local-adapter example against the maintained Lean binary.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the demo gallery uses the bounded current-documentation checkout", async () => {
	const [demos, consumers, packageDocument] = await Promise.all([
		readFile(new URL("../.github/workflows/demos-pages.yml", import.meta.url)
			, "utf8")
		, readFile(new URL("../.github/workflows/consumer-matrix.yml"
			, import.meta.url), "utf8")
		, readFile(new URL("../package.json", import.meta.url), "utf8")
			.then(JSON.parse)
	]);
	const sparse = source => /^ {2}LEAN_BRIDGE_DOCUMENTATION_SPARSE_CHECKOUT: \|\n(?<body>(?: {4}.*\n)+)/mu
		.exec(source)?.groups?.body;
	assert.ok(sparse(demos));
	assert.equal(sparse(demos), sparse(consumers));
	const checkout = demos.split("      - name: Check out the exact revision\n")[1]
		?.split("      - name:")[0];
	assert.match(checkout
		, /uses: actions\/checkout@v6\n {8}with:\n {10}fetch-depth: 1\n {10}filter: blob:none\n {10}persist-credentials: false\n {10}sparse-checkout: \$\{\{ env\.LEAN_BRIDGE_DOCUMENTATION_SPARSE_CHECKOUT \}\}\n {10}sparse-checkout-cone-mode: false\n/u);
	const cleanup = "Free hosted runner disk before bounded documentation checkout";
	assert.equal(demos.split(cleanup).length - 1, 1);
	assert.ok(demos.indexOf(cleanup)
		< demos.indexOf("Check out the exact revision"));
	assert.match(demos
		, /LEAN_BRIDGE_RETAINED_CONTRACTS: deferred\n {8}run: npm run test:docs:demo/u);
	assert.match(packageDocument.scripts["test:docs"], /type-surface-docs\.test\.mjs/u);
	assert.doesNotMatch(packageDocument.scripts["test:docs:demo"]
		, /type-surface-docs\.test\.mjs/u);
	for(const path of [
		"documentation.test.mjs", "consumer-guide-docs.test.mjs"
		, "contributing-docs.test.mjs", "lean-author-documentation.test.mjs"
		, "component-consumer-docs.test.mjs"
		, "documentation-demo-api.test.mjs", "reference-documentation.test.mjs"
	]) assert.match(packageDocument.scripts["test:docs:demo"]
		, new RegExp(`tests/${path.replaceAll(".", "\\.")}`, "u"), path);
});

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
