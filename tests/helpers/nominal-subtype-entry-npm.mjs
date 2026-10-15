/**
 * Build, install and run the separately identified npm entry probe for the Nat nominal fixture: the
 * instrumented fixture is compiled into its own package set, installed offline into its own consumer and
 * driven by the bracketing consumer, so constructor and source entry are accounted per public call. The
 * unmodified release packages are never touched; every probe identity is recorded beside the rows.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { nominalSubtypeFixture, nominalSubtypeModule, nominalSubtypeName } from "./nominal-subtype-installed-fixture.mjs";
import { accountNominalSubtypeEntry, instrumentNominalSubtypeLean, nominalSubtypeEntryConsumer, nominalSubtypeEntryExpected, nominalSubtypeEntryInstrumentation } from "./nominal-subtype-entry.mjs";

/**
 * Classify the side module's exports: the compiler-emitted carrier validators are exported but no
 * package JavaScript names them, so they are reported as unreferenced rather than silently absent.
 *
 * @param exportNames - Export names of the installed side module.
 * @param javascript - Concatenated package JavaScript that could reference an export by name.
 */
export const classifyNominalSubtypeEntryExports = (exportNames, javascript) => {
	assert.ok(Array.isArray(exportNames) && exportNames.length > 0, "empty side module export table");
	assert.equal(typeof javascript, "string");
	const validators = exportNames.filter(name => /_refinement_\d+$/u.test(name)).sort();
	const adapters = exportNames.filter(name => /_lean$/u.test(name)).sort();
	assert.ok(adapters.length > 0, "no exported adapters");
	const referenced = validators.filter(name => javascript.includes(name));
	return { exports: exportNames.length, adapters: adapters.length, validators: { exported: validators, referencedByPackageJavaScript: referenced } };
};

/**
 * Build the probe package set from the instrumented fixture, install it into its own consumer and
 * account every public call of the bracketing consumer. Returns the entry record and the consumer root
 * so the browser lane can bundle the same probe installation.
 *
 * @param options - Probe roots, the selection under test and the installed-run conventions.
 * @param options.directory - Disposable root; the probe author, handoff and consumer live beside the release ones.
 * @param options.output - Record directory; probe inputs, identities and rows are saved under `entry/`.
 * @param options.route - Ordinary source or reviewed source.
 * @param options.configuration - The exact export configuration of the release build.
 * @param options.expected - Reviewed binding IR the probe must reproduce.
 * @param options.engineRoot - Compiler engine root.
 * @param options.environment - Producer environment of the release build.
 * @param options.runtimeRoot - Shared runtime root of the release build.
 * @param options.npmCli - Resolved npm CLI script.
 * @param options.clean - Builds the offline consumer environment for a root.
 */
export const observeNominalSubtypeEntryNpm = async ({ directory, output, route, configuration, expected, engineRoot, environment, runtimeRoot, npmCli, clean }) => {
	const author = join(directory, "probe-author"), projectRoot = join(author, "project"), outputRoot = join(author, "release");
	await cp(nominalSubtypeFixture, projectRoot, { recursive: true });
	const leanPath = join(projectRoot, `${nominalSubtypeModule}.lean`), original = await readFile(leanPath, "utf8");
	const probeLean = instrumentNominalSubtypeLean(original);
	await saveLakeFile(projectRoot, `${nominalSubtypeModule}.lean`, probeLean);
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
	if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
	await buildCanonicalProject({ projectRoot, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	const bundleRoot = join(outputRoot, "bundle"), irBytes = await readFile(join(bundleRoot, "binding/binding-ir.json"));
	assert.equal(reviewedContractDifference(expected, JSON.parse(irBytes)), null, "the probe keeps the exact public contract");
	const linkManifest = JSON.parse(await readFile(join(bundleRoot, "locks/side-module-link-manifest.json"), "utf8"));
	const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(author, "npm") });
	await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
	const receipt = JSON.parse(await readFile(join(release.output, "component-package-receipt.json"), "utf8"));
	const handoff = join(directory, "probe-handoff"); await mkdir(handoff);
	for(const name of [release.report.package.archive, release.report.runtime.archive, "component-package-receipt.json"])
		await cp(join(release.output, name), join(handoff, name));
	const consumer = join(directory, "probe-consumer"), bin = join(consumer, "bin");
	await mkdir(bin, { recursive: true }); await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(consumer, "package.json", canonicalJson({ private: true, type: "module" }));
	for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(consumer, name, "");
	const installArgs = [npmCli, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"];
	installArgs.push("--userconfig", join(consumer, "user.npmrc"), "--globalconfig", join(consumer, "global.npmrc"), "--cache", join(consumer, "empty-cache"));
	installArgs.push(join(handoff, receipt.runtime.archive), join(handoff, receipt.package.archive));
	const install = await runCopied(process.execPath, installArgs, consumer, clean(consumer));
	const consumerSource = nominalSubtypeEntryConsumer(nominalSubtypeName);
	await saveLakeFile(consumer, "entry.mjs", consumerSource);
	const run = await runCopied(process.execPath, ["entry.mjs"], consumer, clean(consumer));
	const rows = JSON.parse(run.stdout);
	const expectedEntries = nominalSubtypeEntryExpected();
	const { observed, counts } = accountNominalSubtypeEntry(run.stderr, rows, expectedEntries);
	const packageRoot = join(consumer, "node_modules", nominalSubtypeName), wasmRoot = join(packageRoot, "wasm");
	const wasmNames = (await readdir(wasmRoot)).filter(name => name.endsWith(".wasm"));
	assert.equal(wasmNames.length, 1, "one installed side module");
	const wasmBytes = await readFile(join(wasmRoot, wasmNames[0]));
	const exportNames = WebAssembly.Module.exports(new WebAssembly.Module(wasmBytes)).map(item => item.name);
	const javascriptFiles = [];
	const walk = async root => {
		for(const entry of await readdir(root, { withFileTypes: true }))
		{
			if(entry.isDirectory() && entry.name !== "wasm") await walk(join(root, entry.name));
			else if(entry.isFile() && /\.(?:mjs|cjs|js)$/u.test(entry.name)) javascriptFiles.push(join(root, entry.name));
		}
	};
	await walk(packageRoot);
	const javascript = (await Promise.all(javascriptFiles.sort().map(path => readFile(path, "utf8")))).join("\n");
	const sideModule = classifyNominalSubtypeEntryExports(exportNames, javascript);
	const fixture = { originalSha256: sha256(original), probeSha256: sha256(probeLean) };
	const probe = { receiptSha256: sha256(canonicalJson(receipt)), packageSha256: receipt.package.sha256, runtimeSha256: receipt.runtime.sha256 };
	probe.bindingIrSha256 = sha256(irBytes); probe.linkManifest = linkManifest; probe.sideModule = { name: wasmNames[0], sha256: sha256(wasmBytes) };
	const entry = { instrumentation: nominalSubtypeEntryInstrumentation, fixture, probe, consumerSha256: sha256(consumerSource) };
	entry.install = { status: install.status ?? 0 }; entry.rows = rows; entry.observed = observed; entry.counts = counts;
	entry.sideModuleExports = sideModule; entry.unmodifiedReleasePackages = true;
	entry.validatorExportsReferenced = sideModule.validators.referencedByPackageJavaScript.length > 0;
	await saveLakeFile(output, "entry/fixture.probe.lean", probeLean);
	await saveLakeFile(output, "entry/entry.mjs", consumerSource);
	await saveLakeFile(output, "entry/stderr.txt", run.stderr);
	await saveLakeFile(output, "entry/stdout.json", run.stdout);
	await saveLakeFile(output, "entry/component-package-receipt.json", canonicalJson(receipt));
	await saveLakeFile(output, "entry/entry.json", canonicalJson(entry));
	return { entry, consumer };
};
