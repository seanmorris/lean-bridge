/**
 * Run the npm entry probe's consumer inside browser pages: the probe installation is bundled into a static
 * deployment exactly like the acceptance pages, every engine loads it with external requests blocked, and
 * the dbgTrace markers reach the page console through the runtime's error channel where the consumer's
 * brackets also go, so the same accounting applies per engine.
 *
 * @file
 */
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { startSiteServer } from "../../site/serve.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { corpusBrowserSelection } from "./type-corpus.mjs";
import { nominalSubtypeName } from "./nominal-subtype-installed-fixture.mjs";
import { accountNominalSubtypeEntry, nominalSubtypeEntryConsumer, nominalSubtypeEntryExpected } from "./nominal-subtype-entry.mjs";

const repository = resolve(import.meta.dirname, "../..");
const base = "/corpus/nested/";
export const nominalSubtypeEntryPage = `<!doctype html><meta charset="utf-8"><title>Nominal entry probe</title><div id="result" data-status="loading"></div><script type="module" src="./entry-page.mjs"></script>
`;

/**
 * Bundle the probe installation and account the consumer's brackets in every selected engine.
 *
 * @param options - The probe consumer root and record directory.
 * @param options.consumer - Probe consumer root holding the installed probe packages.
 * @param options.output - Record directory; the page sources and per-engine traces are saved under `entry/browser/`.
 * @param options.environment - Compiler-free consumer environment for the bundler.
 */
export const observeNominalSubtypeEntryBrowser = async ({ consumer, output, environment }) => {
	const requestedEngines = corpusBrowserSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS);
	const page = nominalSubtypeEntryConsumer(nominalSubtypeName, "page");
	await saveLakeFile(consumer, "request.json", canonicalJson({ module: nominalSubtypeName }));
	await saveLakeFile(consumer, "entry-page.mjs", page);
	await saveLakeFile(consumer, "index.html", nominalSubtypeEntryPage);
	const built = await processBuildRunner.capture({ command: process.execPath
		, args: [join(repository, "tests/helpers/type-corpus-browser-build.mjs"), consumer, "production"]
		, cwd: consumer, env: environment, timeoutMs: 120_000 });
	const deployment = JSON.parse(built.stdout);
	await saveLakeFile(output, "entry/browser/entry-page.mjs", page);
	await saveLakeFile(output, "entry/browser/index.html", nominalSubtypeEntryPage);
	await saveLakeFile(output, "entry/browser/deployment.json", canonicalJson(deployment));
	const expected = nominalSubtypeEntryExpected(), engines = [];
	const playwright = await import("playwright");
	for(const engine of requestedEngines)
	{
		const browser = await playwright[engine].launch({ headless: true, ...(engine === "chromium" ? { args: ["--no-sandbox"] } : {}) });
		try
		{
			const server = await startSiteServer({ root: join(consumer, "dist-production"), base });
			try
			{
				const context = await browser.newContext({ serviceWorkers: "block" });
				const lines = [], errors = [], foreignRequests = [];
				// Nothing outside the static deployment may be fetched.
				await context.route("**/*", async route => {
					if(route.request().url().startsWith(server.url)) return route.continue();
					foreignRequests.push(route.request().url());
					return route.abort();
				});
				const tab = await context.newPage();
				tab.on("pageerror", error => errors.push(error.message));
				tab.on("console", message => lines.push(message.text()));
				await tab.goto(server.url);
				await tab.locator("#result[data-status=\"ready\"], #result[data-status=\"error\"]").waitFor();
				assert.equal(await tab.locator("#result").getAttribute("data-status"), "ready", await tab.locator("#result").textContent());
				const rows = await tab.evaluate(() => globalThis.nominalEntryRows);
				const trace = lines.map(line => line + "\n").join("");
				await saveLakeFile(output, `entry/browser/${engine}.console.txt`, trace);
				const { observed, counts } = accountNominalSubtypeEntry(trace, rows, expected);
				assert.deepEqual(foreignRequests, []); assert.deepEqual(errors, []);
				engines.push({ engine, hostVersion: browser.version(), rows, observed, counts, errors, consoleLines: lines.length });
				await context.close();
			}
			finally
			{ await server.close(); }
		}
		finally
		{ await browser.close(); }
	}
	// Only the static deployment is kept for the record; the probe installation is not reused.
	await rm(join(consumer, "dist-production"), { recursive: true, force: true });
	const result = { requestedEngines, deployment: { sha256: deployment.sha256, viteVersion: deployment.viteVersion }, pageSha256: sha256(page), engines, externalNetworkBlocked: true };
	await saveLakeFile(output, "entry/browser/browser.json", canonicalJson(result));
	return result;
};
