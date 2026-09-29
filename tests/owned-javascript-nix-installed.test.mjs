/**
 * Build through the real Nix transport, then consume only relocated npm archives.
 * This test does not replace the process runner or claim an OS sandbox.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { readVerifiedPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedAnalysisFixture } from "./helpers/owned-analysis.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const sourceBoundary = async () => {
	const core = JSON.parse(await readFile("nix/core-source-boundary.json", "utf8"));
	const component = JSON.parse(await readFile("nix/component-engine-source-boundary.json", "utf8"));
	assert.equal(new Set(component.includedFiles).size, component.includedFiles.length);
	return { includedFiles: [...new Set([...core.includedFiles, ...component.includedFiles, ...component.identityFiles])]
		, includedDirectoryPrefixes: core.includedDirectoryPrefixes };
};

test("the Nix component source boundary contains its complete import closure", async () => {
	const boundary = await sourceBoundary();
	const paths = new Set(boundary.includedFiles.map(path => resolve(path)));
	for(const path of boundary.includedFiles.filter(path => path.endsWith(".mjs")))
	{
		const tree = ts.createSourceFile(path, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		const visit = node => {
			const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
				: ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
			if(specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith("."))
				assert.ok(paths.has(resolve(dirname(path), specifier.text)), `${path}: ${specifier.text}`);
			ts.forEachChild(node, visit);
		};
		visit(tree);
	}
});

test("the filtered component engine imports without undeclared checkout files", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-component-filtered-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const boundary = await sourceBoundary();
	for(const prefix of boundary.includedDirectoryPrefixes)
		await cp(prefix, join(directory, prefix), { recursive: true });
	for(const path of boundary.includedFiles)
	{
		await mkdir(dirname(join(directory, path)), { recursive: true });
		await copyFile(path, join(directory, path));
	}
	const modules = boundary.includedFiles.filter(path => path.startsWith("src/") && path.endsWith(".mjs"));
	const options = { cwd: directory, encoding: "utf8", env: { PATH: "/unavailable" }, stdio: "pipe" };
	const run = () => execFileSync(process.execPath, ["--input-type=module", "-e"
		, `for(const path of ${JSON.stringify(modules)}) await import("./" + path); console.log("filtered-component-ready");`], options);
	assert.equal(run(), "filtered-component-ready\n");
	await rm(join(directory, "src/backends/native/owned-value-transfers.mjs"));
	assert.throws(run, error => error.stderr.includes("ERR_MODULE_NOT_FOUND")
		&& error.stderr.includes("owned-value-transfers.mjs"));
});

for(const reviewed of [false, true]) test(`actual Nix installs ${reviewed ? "reviewed" : "ordinary"} owned npm exports after producer removal`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_NIX_TEST !== "1", timeout: 3600000
}, async t => {
	const { root, directory } = await ownedAnalysisFixture(t, reviewed);
	const before = await lakeInputState(root), output = join(directory, "release");
	const result = await buildCanonicalProject({ projectRoot: root
		, engineRoot: resolve("."), outputRoot: output, targets: ["npm"]
		, environment: { ...process.env
			, LEAN_BRIDGE_BUILD_BACKEND: "nix"
			, LEAN_BRIDGE_LEAN_PREFIX: "/absent/author-lean"
			, LEAN_BRIDGE_JS_EMSDK: "/absent/author-emsdk"
			, LEAN_BRIDGE_JS_INPUTS: "/absent/author-headers"
			, LEAN_BRIDGE_RUNTIME_ROOT: resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy") }
	}).catch(error => { t.diagnostic(JSON.stringify(error.details)); throw error; });
	assert.equal(result.backend, "native-nix");
	assert.deepEqual(await lakeInputState(root), before);
	const report = JSON.parse(await readFile(join(output, result.engineReport), "utf8"));
	assert.equal(report.backend, "native-nix");
	assert.equal(report.sourceReadOnly, true);
	assert.equal(report.runtimeBinaryIncluded, false);
	const receipt = await readVerifiedPackageSetReceipt({ receiptPath: join(output, result.packageSet) });
	assert.deepEqual(receipt.result.profiles, ["javascript-wasm-owned-v1"]);
	const consumer = join(directory, "consumer"), archives = [];
	await saveLakeFile(consumer, "package.json", '{"name":"actual-owned-engine-consumer","version":"1.0.0","private":true,"type":"module"}\n');
	for(const item of receipt.receipt.packages.flatMap(pkg => pkg.artifacts))
	{
		archives.push(`./${item.path}`);
		await saveLakeFile(consumer, item.path, await readFile(join(output, "packages/npm", item.path)));
	}
	const name = receipt.receipt.packages.find(pkg => pkg.role === "component").name;
	await rm(root, { recursive: true }); await rm(output, { recursive: true });
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: consumer, timeoutMs: 120000 });
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", ...archives]);
	await saveLakeFile(consumer, "call.mjs", `import assert from "node:assert/strict";
import api from ${JSON.stringify(name)};
const ticket = api.newTicket(1n << 120n, "nix\\0🙂");
const value = {primary: ticket, spare: {tag: "none"}, peers: [ticket], history: [ticket], payload: {count: -(1n << 150n), bytes: new Uint8Array([0, 255])}};
assert.deepEqual(api.echoRecord(value), value);
let borrowed;
assert.deepEqual(api.callbackRecord(value, input => { borrowed = input.primary; return input; }), value);
assert.equal(borrowed.disposed, true);
const closure = api.dispatch(value);
assert.deepEqual(closure(input => input), value); closure.dispose();
const failure = new Error("Nix installed callback");
assert.throws(() => api.callbackRecord(value, () => { throw failure; }), error => error === failure);
ticket.dispose(); assert.equal(api.close(), true);
console.log("actual Nix owned consumer passed");
`);
	assert.equal((await run(process.execPath, ["call.mjs"])).stdout, "actual Nix owned consumer passed\n");
	t.diagnostic(JSON.stringify({ reviewed, backend: "native-nix"
		, injectedTransport: false, unusableHostSdk: true
		, sourceUnchanged: true, installedOffline: true, producerRemoved: true
		, nestedResources: true, callbackBorrowExpiry: true
		, returnedClosure: true, callbackException: true }));
});
