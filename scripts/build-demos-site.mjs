/**
 * Assembles the static GitHub Pages artifact from the checked demo sources.
 *
 * @file
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderGalleryCard } from "../demos/shared/gallery-card.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const demosRoot = resolve(repositoryRoot, "demos");
const outputRoot = resolve(repositoryRoot, "build/github-pages");
const manifest = JSON.parse(await readFile(resolve(demosRoot, "manifest.json"), "utf8"));
const demoSlugs = new Set(manifest.demos.map(demo => demo.slug));
const rootFiles = new Set(["gallery.css", "gallery.mjs", "index.html", "manifest.json"]);
const demoFiles = new Set(["app.mjs", "benchmark-workload.mjs", "browser-benchmark.mjs", "graph.mjs", "index.html", "network.mjs", "percolation.mjs", "README.md", "reference.mjs", "runtime.mjs", "scenario.mjs", "styles.css", "terrain.mjs"]);

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
const gitOutput = args => execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
const modified = gitOutput(["status", "--porcelain", "--untracked-files=no"])
	|| gitOutput([
		"ls-files", "--others", "--exclude-standard", "--"
		, "demos", "scripts", "src", "poc", "patches"
		, "containers", "nix", "schema", ".github"
	]);
const identity = {
	schemaVersion: 2
	, commit
	, sourceState: modified ? "modified" : "clean"
	, generatedAt: new Date().toISOString()
	, demos: manifest.demos.map(demo => demo.slug)
	, artifacts: {}
};
for(const demo of manifest.demos)
{
	for(const file of [`${demo.slug}.wasm`, `${demo.slug}.mjs`, "proof-audit.json"])
	{
		const path = `${demo.slug}/runtime/${file}`;
		const bytes = await readFile(resolve(outputRoot, path));
		identity.artifacts[path] = { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
	}
}
const homepage = await readFile(resolve(outputRoot, "index.html"), "utf8");
await Promise.all([
	writeFile(resolve(outputRoot, ".nojekyll"), "")
	, writeFile(resolve(outputRoot, "build-identity.json"), `${JSON.stringify(identity, null, 2)}\n`)
	, writeFile(resolve(outputRoot, "index.html"), homepage.replace("<!-- published-demo-cards -->",
		manifest.demos.map(renderGalleryCard).join("\n")))
]);
process.stdout.write(`Assembled ${manifest.demos.length} demos in ${outputRoot}\n`);
