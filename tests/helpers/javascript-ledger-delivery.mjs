/** @file Execute real strict TypeScript, React, and dedicated worker Ledger clients. */
import assert from "node:assert/strict";
import {copyFile, readFile, readdir, rename, rm} from "node:fs/promises";
import {createRequire} from "node:module";
import {dirname, join, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {sha256} from "../../src/capsule/node.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

const require = createRequire(import.meta.url), fixtures = fileURLToPath(new URL("../fixtures/javascript-ledger/", import.meta.url));
const frameworks = ["react", "react-dom", "scheduler"];

/**
 * Pack already installed framework dependencies without registry access.
 *
 * @param root - Private offline workspace.
 */
export const ledgerFrameworkArchives = async root => {
	const archives = [];
	for(const pkg of frameworks)
	{
		const local = dirname(require.resolve(pkg + "/package.json"));
		const name = await run("npm", ["pack", "--offline", "--ignore-scripts"
			, "--silent", "--cache", join(root, "cache")
			, "--pack-destination", root, local], root);
		archives.push(join(root, name));
	}
	return archives;
};

/**
 * Check all three clients against the same verified installation, then remove
 * the install before running the bundled UI and worker in Chromium.
 *
 * @param options - Isolated installation and observations from the plain Node client.
 * @param options.root - Private test directory.
 * @param options.consumer - Offline npm install.
 * @param options.node - Expected common scalar, value/error, ordering and cleanup results.
 * @param options.sourceTreeSha256 - Verified receipt's source tree.
 */
export const ledgerDelivery = async ({root, consumer, node, sourceTreeSha256}) => {
	assert.deepEqual(node, {checks: 45, scalarKinds: 19, counter: 3});
	const sources = {};
	for(const file of ["consumer.mts", "react.mjs", "worker.mjs"])
	{
		await copyFile(join(fixtures, file), join(consumer, file));
		sources[file] = sha256(await readFile(join(consumer, file)));
	}
	sources["calls.mjs"] = sha256(await readFile(join(consumer, "calls.mjs")));
	const compilerOptions = {strict: true, types: [], allowJs: true
		, target: "es2022", module: "nodenext", outDir: "compiled"};
	const tsconfig = {files: ["consumer.mts"], compilerOptions};
	await saveLakeFile(consumer, "tsconfig.json", JSON.stringify(tsconfig));
	const env = {LANG: "C.UTF-8", PATH: "/no-author-tools", TMPDIR: root};
	await run(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", "tsconfig.json"], consumer, env);
	const typescript = JSON.parse(await run(process.execPath, ["compiled/consumer.mjs"], consumer, env));
	assert.deepEqual(typescript, {common: node, branch: 4000000000, after: 4});
	const deps = join(consumer, "node_modules"), component = join(deps, "@example/ledger-io");
	const meta = JSON.parse(await readFile(join(component, "metadata/compiler.json")));
	assert.equal(meta.sourceTreeSha256, sourceTreeSha256);
	const review = meta.reviewedSourceSha256;
	if(review) assert.equal(sha256(await readFile(join(component, "metadata/review.binding-ir.json"))), review);
	else assert.equal(review, null);
	const versions = {};
	for(const name of frameworks) versions[name] = JSON.parse(await readFile(join(deps, name, "package.json"))).version;
	const checkImport = id => {
		if(!id.startsWith("\0") && id.includes(sep + "node_modules" + sep))
			assert.ok(id.startsWith(deps + sep), "Bundled dependency outside the offline install: " + id);
		return null;
	};
	const audit = () => ({name: "ledger-installed-dependencies", load: checkImport});
	await saveLakeFile(consumer, "index.html", `<div id="ledger"></div>
<script>globalThis.ledgerReady = Promise.withResolvers();</script>
<script type="module">import("./react.mjs").then(m => ledgerReady.resolve(m.runUI), e => ledgerReady.reject(e));</script>`);
	await build({root: consumer, configFile: false, publicDir: false
		, envDir: false, logLevel: "error", plugins: [audit()]
		, worker: {format: "es", plugins: () => [audit()]}
		, build: {target: "esnext", assetsInlineLimit: 0}});
	const site = join(root, "site");
	await rename(join(consumer, "dist"), site);
	const expected = [join(component, "internal/component.wasm"), join(deps, "@lean-bridge/runtime/internal/main.wasm")];
	const hashFiles = files => Promise.all(files.map(f => readFile(f).then(sha256)));
	const assets = join(site, "assets"), files = (await readdir(assets)).filter(f => f.endsWith(".wasm"));
	const deployed = (await hashFiles(files.map(f => join(assets, f)))).sort();
	assert.deepEqual(deployed, (await hashFiles(expected)).sort());
	await rm(consumer, {recursive: true});
	const evaluate = async () => ({ui: await (await globalThis.ledgerReady.promise)(), browser: globalThis.navigator.userAgent});
	const {browser, ui} = await runInstalledChromium({root, consumer, assembledDirectory: site, evaluate});
	assert.deepEqual(ui, {react: node, text: "Total: 3", worker: node, parentAfterWorker: 4});
	return {route: review ? "reviewed" : "ordinary"
		, reviewedSourceSha256: review, sources
		, deployed, typescriptVersion: require("typescript/package.json").version
		, nodeVersion: process.version, frameworks: versions
		, browser, typescript, ui};
};
