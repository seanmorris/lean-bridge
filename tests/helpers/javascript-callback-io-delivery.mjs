/** @file Run a cross-package runtime fault in executed TypeScript and mounted React. */
import assert from "node:assert/strict";
import {copyFile, readFile, readdir, rename, rm} from "node:fs/promises";
import {createRequire} from "node:module";
import {join, sep} from "node:path";
import {build} from "vite";
import {sha256} from "../../src/capsule/node.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

const require = createRequire(import.meta.url);
const fixtures = new URL("../fixtures/javascript-wasm-callback-io/", import.meta.url);
const digest = async f => sha256(await readFile(f));
const expected = ({order, propagate}) => ({order, propagate, checks: 23, counterBeforeTrap: 4, healthyFinishes: 8, finishesAfterTrap: 0});

/**
 * Create lazy imports so bundling never initializes a package before its turn.
 *
 * @param consumer - Installed project root.
 * @param names - Component package names.
 */
export const writeCallbackLoaders = async (consumer, names) => {
	const loaders = [...names, "@lean-bridge/runtime"].map(n => "[" + JSON.stringify(n) + ",()=>import(" + JSON.stringify(n) + ")]");
	await saveLakeFile(consumer, "loaders.mjs", "const packages=new Map([" + loaders.join(",") + "]);export const load=n=>packages.get(n)();");
};

/**
 * Run each case in a fresh process or page. Keep the exact package and client
 * identities alongside the application observations, not just a pass count.
 *
 * @param options - Isolated workspace, verified handoffs, and requested fault cases.
 */
export const checkCallbackDelivery = async options => {
	const {root, consumer, io, owned, requests} = options;
	const deps = join(consumer, "node_modules"), ioDir = join(deps, io.name);
	const meta = JSON.parse(await readFile(join(ioDir, "metadata/compiler.json")));
	assert.equal(meta.sourceTreeSha256, io.sourceTree);
	if(meta.reviewedSourceSha256) assert.equal(await digest(join(ioDir, "metadata/review.binding-ir.json")), meta.reviewedSourceSha256);
	const sources = {};
	for(const name of ["consumer.mts", "react.mjs"])
		await copyFile(new URL(name, fixtures), join(consumer, name));
	await writeCallbackLoaders(consumer, [io.name, owned.name]);
	for(const name of ["consumer.mts", "react.mjs", "loaders.mjs", "calls.mjs"]) sources[name] = await digest(join(consumer, name));
	const compilerOptions = {strict: true, types: [], allowJs: true, target: "es2022", module: "nodenext", outDir: "compiled"};
	await saveLakeFile(consumer, "tsconfig.json", JSON.stringify({compilerOptions, files: ["consumer.mts"]}));
	const env = {LANG: "C.UTF-8", PATH: "/no-author-tools", TMPDIR: root};
	await run(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", "tsconfig.json"], consumer, env);
	await copyFile(join(consumer, "fault.wasm"), join(consumer, "compiled/fault.wasm"));
	const typescript = [];
	for(const request of requests)
	{
		const actual = JSON.parse(await run(process.execPath, ["compiled/consumer.mjs", JSON.stringify(request)], consumer, env));
		assert.deepEqual(actual, {common: expected(request), entries: 1, rejected: true});
		typescript.push(actual);
	}
	await saveLakeFile(consumer, "index.html", `<div id="trap"></div>
<script>globalThis.trapReady = Promise.withResolvers();</script>
<script type="module">import("./react.mjs").then(m => trapReady.resolve(m.runUI), e => trapReady.reject(e));</script>`);
	const versions = {};
	for(const name of ["react", "react-dom", "scheduler"]) versions[name] = JSON.parse(await readFile(join(deps, name, "package.json"))).version;
	const seen = new Set();
	const audit = id => {
		if(!id.startsWith("\0") && id.includes(sep + "node_modules" + sep))
		{
			assert.ok(id.startsWith(deps + sep), "Bundled a dependency outside the installation: " + id);
			seen.add(id.slice(deps.length + 1));
		}
		return null;
	};
	await build({root: consumer, configFile: false, publicDir: false, envDir: false
		, plugins: [{name: "installed-callback-ui", load: audit}], logLevel: "error"
		, build: {target: "esnext", assetsInlineLimit: 0}});
	for(const name of [io.name, owned.name, "@lean-bridge/runtime", "react", "react-dom"])
		assert.ok([...seen].some(p => p.startsWith(name + "/")), "Missing installed dependency " + name);
	const site = join(root, "callback-ui"), assets = join(site, "assets");
	await rename(join(consumer, "dist"), site);
	const bins = [join(ioDir, "internal/component.wasm")
		, join(deps, owned.name, "internal/component.so.wasm")
		, join(deps, "@lean-bridge/runtime/internal/main.wasm")
		, join(consumer, "fault.wasm")];
	const deployed = (await Promise.all((await readdir(assets)).filter(n => n.endsWith(".wasm")).map(n => digest(join(assets, n))))).sort();
	assert.deepEqual(deployed, (await Promise.all(bins.map(digest))).sort());
	await rm(consumer, {recursive: true});
	const react = [];
	let browser;
	const evaluate = async request => ({ui: await (await globalThis.trapReady.promise)(request), browser: globalThis.navigator.userAgent});
	for(const request of requests)
	{
		const page = await runInstalledChromium({root, assembledDirectory: site, evaluate, argument: request, timeoutMs: 90000});
		const {ui} = page; browser = page.browser;
		assert.deepEqual(ui, {common: expected(request), labels: ["Run", "Runtime retired", "Peer update refused"]});
		react.push(ui);
	}
	const reviewedSourceSha256 = meta.reviewedSourceSha256;
	return {schemaVersion: 1, route: reviewedSourceSha256 ? "reviewed" : "ordinary"
		, reviewedSourceSha256
		, io: io.receiptSha256
		, callbacks: owned.receiptSha256
		, sources
		, deployed
		, diagnostic: requests[0].integrity
		, node: process.version
		, compiler: require("typescript/package.json").version
		, frameworks: versions
		, browser
		, typescript
		, react};
};
