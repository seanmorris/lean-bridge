/**
 * Assembles the static GitHub Pages artifact from the checked demo sources.
 *
 * @file
 */

import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const demosRoot = resolve(repositoryRoot, "demos");
const outputRoot = resolve(repositoryRoot, "build/github-pages");
const manifest = JSON.parse(await readFile(resolve(demosRoot, "manifest.json"), "utf8"));
const demoSlugs = new Set(manifest.demos.map(demo => demo.slug));
const rootFiles = new Set(["gallery.css", "gallery.mjs", "index.html", "manifest.json"]);
const demoFiles = new Set(["app.mjs", "index.html", "README.md", "runtime.mjs", "styles.css"]);

for(const demo of manifest.demos)
{
	const entrypoint = resolve(demosRoot, demo.entrypoint, "index.html");
	await readFile(entrypoint);
}

await rm(outputRoot, { force: true, recursive: true });
await mkdir(outputRoot, { recursive: true });
await cp(demosRoot, outputRoot, {
	filter: source => {
		const path = relative(demosRoot, source);
		if(!path) return true;
		const parts = path.split(/[\\/]/u);
		if(parts[0] === "shared") return true;
		if(parts.length === 1) return rootFiles.has(parts[0]) || demoSlugs.has(parts[0]);
		if(!demoSlugs.has(parts[0])) return false;
		if(parts[1] === "runtime") return true;
		return demoFiles.has(parts[1]) || parts[1].endsWith(".lean");
	}
	, recursive: true
});

const commit = execFileSync("git", ["rev-parse", "HEAD"], {
	cwd: repositoryRoot
	, encoding: "utf8"
}).trim();
const identity = {
	schemaVersion: 1
	, commit
	, generatedAt: new Date().toISOString()
	, demos: manifest.demos.map(demo => demo.slug)
};
await Promise.all([
	writeFile(resolve(outputRoot, ".nojekyll"), "")
	, writeFile(resolve(outputRoot, "build-identity.json"), `${JSON.stringify(identity, null, 2)}\n`)
]);
process.stdout.write(`Assembled ${manifest.demos.length} demos in ${outputRoot}\n`);
