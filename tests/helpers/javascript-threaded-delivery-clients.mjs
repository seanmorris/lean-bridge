/** @file Reinstall a verified Workshop release and run strict TypeScript and mounted React clients. */
import assert from "node:assert/strict";
import {copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm} from "node:fs/promises";
import {createRequire} from "node:module";
import {tmpdir} from "node:os";
import {dirname, join, resolve, sep} from "node:path";
import {build} from "vite";
import {sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {retainPackageSetEvidence} from "./package-set.mjs";

const require = createRequire(import.meta.url), fixture = resolve("tests/fixtures/javascript-threaded-host");
const name = "@lean-bridge/workshop-host-example", runtime = "@lean-bridge/runtime";
const frameworks = ["react", "react-dom", "scheduler"];

/**
 * Verify and install only the archives named by the receipt. Neither downstream
 * program imports the author project or the monorepo's Lean Bridge modules.
 *
 * @param handoff - Directory containing the package-local npm receipt.
 * @param route - Required author route, checked against compiler metadata inside the install.
 */
export const checkThreadedDeliveryClients = async (handoff, route) => {
	const root = await mkdtemp(join(tmpdir(), "threaded-ui-"));
	try
	{
		const feed = join(root, "feed"), app = join(root, "app"), site = join(root, "site");
		const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(handoff, "package-set-receipt.json")});
		assert.equal(receipt.profiles[0].id, "javascript-wasm-threaded-task-v1");
		assert.deepEqual(receipt.packages.map(p => p.name).sort(), [runtime, name].sort());
		const copy = await retainPackageSetEvidence(handoff, feed);
		assert.equal(copy.receiptSha256, result.receiptSha256);
		const archives = receipt.packages.map(p => join(feed, p.artifacts[0].path));
		const cache = join(root, "npm-cache"), npmEnv = {...process.env, npm_config_cache: cache};
		for(const pkg of frameworks)
		{
			const local = dirname(require.resolve(pkg + "/package.json"));
			const tar = await run("npm", ["pack", "--offline", "--ignore-scripts", "--silent", "--pack-destination", feed, local], root, npmEnv);
			archives.push(join(feed, tar));
		}
		await mkdir(app);
		await saveLakeFile(app, "package.json", '{"private":true,"type":"module"}');
		await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", ...archives], app, npmEnv);
		const metadata = JSON.parse(await readFile(join(app, "node_modules", name, "metadata/compiler.json")));
		assert.equal(metadata.sourceTreeSha256, receipt.source.treeSha256);
		if(route === "ordinary") assert.equal(metadata.reviewedSourceSha256, null);
		else
		{
			assert.equal(route, "reviewed");
			assert.match(metadata.reviewedSourceSha256, /^[0-9a-f]{64}$/u);
		}
		const frameworkVersions = {};
		for(const pkg of frameworks)
			frameworkVersions[pkg] = JSON.parse(await readFile(join(app, "node_modules", pkg, "package.json"), "utf8")).version;
		await rm(feed, {recursive: true}); await rm(cache, {recursive: true});
		const env = {PATH: "/no-author-tools", LANG: "C.UTF-8", TMPDIR: root};
		const typed = "installed-delivery.mts", dom = "react-delivery.mjs";
		for(const file of [typed, dom]) await copyFile(join(fixture, file), join(app, file));
		const compilerOptions = {strict: true, types: [], module: "NodeNext", target: "ES2022", lib: ["ES2024", "DOM"]};
		await saveLakeFile(app, "tsconfig.json", JSON.stringify({files: [typed], compilerOptions}));
		await run(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", "tsconfig.json"], app, env);
		const typescript = JSON.parse(await run(process.execPath, ["installed-delivery.mjs"], app, env, 90000));
		assert.deepEqual(typescript, {value: 7, yielded: 1, readsAtExhaustion: 1, canceled: true, drained: true});

		await saveLakeFile(app, "index.html", `<div id="component"></div>
<script>globalThis.deliveryReady = Promise.withResolvers();</script>
<script type="module">
import("./react-delivery.mjs").then(m => deliveryReady.resolve(m.exerciseDelivery), e => deliveryReady.reject(e));
</script>`);
		const installed = join(app, "node_modules") + sep, imported = new Set();
		const load = id => {
			if(!id.startsWith("\0") && id.includes(sep + "node_modules" + sep))
			{
				assert.ok(id.startsWith(installed), "Imported dependency outside the installation: " + id);
				imported.add(id.slice(installed.length));
			}
			return null;
		};
		await build({root: app, configFile: false, publicDir: false
			, envDir: false, logLevel: "error"
			, plugins: [{name: "check-offline-imports", load}]
			, worker: {format: "es"}, build: {target: "esnext", assetsInlineLimit: 0}
		});
		for(const pkg of [runtime, name, ...frameworks])
			assert.ok([...imported].some(path => path.startsWith(pkg + "/")), "Missing installed import: " + pkg);
		await rename(join(app, "dist"), site);
		const assets = join(site, "assets"), wasm = (await readdir(assets)).filter(p => p.endsWith(".wasm"));
		const digests = paths => Promise.all(paths.map(path => readFile(path).then(sha256)));
		const deployed = await digests(wasm.map(path => join(assets, path)));
		assert.deepEqual(deployed.sort(), (await digests([
			join(installed, runtime, "internal/task.wasm")
			, join(installed, name, "internal/component.wasm")
		])).sort());
		await rm(app, {recursive: true});
		const evaluate = async () => ({
			react: await (await globalThis.deliveryReady.promise)()
			, browser: globalThis.navigator.userAgent
		});
		const {react, browser} = await runInstalledChromium({root, consumer: app
			, assembledDirectory: site, isolated: true, timeoutMs: 90000, evaluate});
		assert.deepEqual(react, {text: "8:1:0", won: true
			, canceled: "operation-cancelled"
			, lateCommits: 0, next: 3, empty: true, drained: true});
		return {packageSetSha256: copy.receiptSha256
			, typescript, react, deployed, browser
			, node: process.version, reviewedSourceSha256: metadata.reviewedSourceSha256
			, typescriptVersion: require("typescript/package.json").version
			, frameworkVersions
			, typedClientSha256: sha256(await readFile(join(fixture, typed)))
			, reactClientSha256: sha256(await readFile(join(fixture, dom)))};
	} finally
	{ await rm(root, {recursive: true, force: true}); }
};
