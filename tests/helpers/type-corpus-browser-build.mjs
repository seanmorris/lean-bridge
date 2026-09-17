/**
 * Bundle only an isolated installation, under the consumer's compiler-free PATH.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir, realpath } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { build } from "vite";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

const root = await realpath(process.argv[2]);
const variant = process.argv[3];
assert.ok(["production", "strict"].includes(variant));
const modules = new Set();
const audit = () => ({ name: "corpus-installed-dependencies"
	, load: id => {
		if(id.includes("/node_modules/") && !id.startsWith("\0"))
		{
			assert.ok(id.startsWith(`${root}/node_modules/`), `Dependency escaped the isolated installation: ${id}`);
			modules.add(relative(root, id.split("?")[0]));
		}
		return null;
	}
});
await build({ root, base: "/corpus/nested/", configFile: false, envDir: false
	, logLevel: "silent", plugins: [audit()]
	, define: { "process.env.NODE_ENV": JSON.stringify(variant === "strict" ? "development" : "production") }
	, build: { outDir: `dist-${variant}`, target: "esnext", assetsInlineLimit: 0, minify: false }
	, worker: { format: "es", plugins: () => [audit()] } });
const request = JSON.parse(await readFile(join(root, "request.json"), "utf8"));
for(const name of [request.module, "@lean-bridge/runtime"])
	assert.ok([...modules].some(path => path === `node_modules/${name}/index.mjs`), `Public browser export was not bundled: ${name}`);
const files = [];
const out = resolve(root, `dist-${variant}`);
const visit = async directory => {
	for(const entry of await readdir(directory, { withFileTypes: true }))
	{
		const path = join(directory, entry.name);
		if(entry.isDirectory()) await visit(path);
		else
		{
			const bytes = await readFile(path);
			files.push({ path: relative(out, path), bytes: bytes.length, sha256: sha256(bytes) });
		}
	}
};
await visit(out);
files.sort((a, b) => a.path.localeCompare(b.path));
const tool = JSON.parse(await readFile(new URL("../../node_modules/vite/package.json", import.meta.url), "utf8"));
process.stdout.write(canonicalJson({ variant, viteVersion: tool.version
	, modulePaths: [...modules].sort(), files
	, sha256: sha256(canonicalJson(files)) }));
