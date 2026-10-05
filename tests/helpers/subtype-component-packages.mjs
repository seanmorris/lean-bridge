/**
 * Installed checked refinements composed with each copied/callable transport.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

const common = `namespace OnboardingSmall
abbrev Small := { value : UInt32 // value < 10 }
def checkedSmall (value : UInt32) : Option Small :=
  if valid : value < 10 then some ⟨value, valid⟩ else none
abbrev Text := { value : String // value != "" }
def checkedText (value : String) : Option Text :=
  if valid : value != "" then some ⟨value, valid⟩ else none
def echo (value : Text) : Text := value
`;
const tree = `inductive Tree where
  | leaf : String → Tree
  | branch : Array Tree → Tree
def echoTree (value : Tree) : Tree := value
`;
const sources = {
	2: `def use (text : Text) (small : Small) (suffix : String) : String := text.val ++ toString small.val ++ suffix
`
	, 3: `def use (text : Text) (small : Small) (f : String → String) : String := f text.val ++ toString small.val
def make (text : Text) : String → String := fun suffix => text.val ++ suffix
`
	, 4: `def use (text : Text) (small : Small) (values : Array String) : String := text.val ++ toString small.val ++ toString values.size
`
	, 5: `structure Payload where
  text : String
def use (text : Text) (small : Small) (value : Payload) : String := text.val ++ toString small.val ++ value.text
`
	, 6: `def use (text : Text) (small : Small) (value : Option String) : String := text.val ++ toString small.val ++ value.getD "!"
`
	, 7: `abbrev Label := String
def use (text : Text) (small : Small) (value : Label) : String := text.val ++ toString small.val ++ value
`
	, 8: `${tree}def use (text : Text) (small : Small) (_value : Tree) : String := text.val ++ toString small.val
`
	, 9: `${tree}def use (text : Text) (small : Small) (f : Array String → Array String) : Array String := f #[text.val, toString small.val]
def make (text : Text) : Array String → Array String := fun suffix => #[text.val] ++ suffix
`
};
const consumers = {
	2: `const use = (text, small) => api.use(text, small, "!");
assert.equal(use("hello", 9), "hello9!");
`
	, 3: `const use = (text, small) => api.use(text, small, value => { calls++; return value + "!"; });
assert.equal(use("Lean λ 🙂", 9), "Lean λ 🙂!9");
assert.equal(calls, 1);
const closure = api.make("hello");
try { assert.equal(closure("!"), "hello!"); } finally { closure.dispose(); }
assert.throws(() => api.make(""));
`
	, 4: `const values = ["one", "two"];
const use = (text, small) => api.use(text, small, values);
assert.equal(use("hello", 9), "hello92");
assert.deepEqual(values, ["one", "two"]);
`
	, 5: `const value = { text: "!" };
const use = (text, small) => api.use(text, small, value);
assert.equal(use("hello", 9), "hello9!");
assert.deepEqual(value, { text: "!" });
`
	, 6: `const use = (text, small) => api.use(text, small, { tag: "some", value: "!" });
assert.equal(use("hello", 9), "hello9!");
`
	, 7: `const use = (text, small) => api.use(text, small, "!");
assert.equal(use("hello", 9), "hello9!");
`
	, 8: `const tree = { kind: "branch", arg0: [{ kind: "leaf", arg0: "leaf λ" }] };
assert.deepEqual(api.echoTree(tree), tree);
const use = (text, small) => api.use(text, small, tree);
assert.equal(use("hello", 9), "hello9");
`
	, 9: `const tree = { kind: "branch", arg0: [{ kind: "leaf", arg0: "leaf λ" }] };
assert.deepEqual(api.echoTree(tree), tree);
const use = (text, small) => api.use(text, small, values => { calls++; return [...values, "!"]; });
assert.deepEqual(use("Lean λ 🙂", 9), ["Lean λ 🙂", "9", "!"]);
assert.equal(calls, 1);
const closure = api.make("hello");
try { assert.deepEqual(closure(["!"]), ["hello", "!"]); } finally { closure.dispose(); }
assert.throws(() => api.make(""));
`
};
const typed = {
	2: 'const result: string = api.use("hello", 9, "!");'
	, 3: 'const result: string = api.use("hello", 9, (value: string) => value);\nconst closure = api.make("hello"); const text: string = closure("!"); closure.dispose();'
	, 4: 'const result: string = api.use("hello", 9, ["one", "two"]);'
	, 5: 'const result: string = api.use("hello", 9, { text: "!" });'
	, 6: 'const result: string = api.use("hello", 9, { tag: "some", value: "!" });'
	, 7: 'const result: string = api.use("hello", 9, "!");'
	, 8: 'const result: string = api.use("hello", 9, { kind: "leaf", arg0: "leaf" });'
	, 9: 'const result: ReadonlyArray<string> = api.use("hello", 9, (values: ReadonlyArray<string>) => values);\nconst closure = api.make("hello"); const texts: ReadonlyArray<string> = closure(["!"]); closure.dispose();'
};

/**
 * Build relocated packages, install only their archives and exercise rejection,
 * cleanup, closure disposal and strict consumer types against real Lean/Wasm.
 *
 * @param t - Node test context.
 * @param options - Existing unlocked build harness and pinned runtime.
 * @param options.fixture - Create an isolated author project.
 * @param options.build - Build using the ordinary-source compiler path.
 * @param options.runtimeRoot - Prepared shared runtime root.
 * @param options.engineRoot - Checkout containing the TypeScript compiler.
 */
export const checkSubtypeComponentPackages = async (t, { fixture, build, runtimeRoot, engineRoot }) => {
	for(const version of [2, 3, 4, 5, 6, 7, 8, 9]) await t.test(`private ABI ${version}`, async t => {
		const { directory, root } = await fixture(t);
		await saveLakeFile(root, "OnboardingSmall.lean", `${common}${sources[version]}end OnboardingSmall\n`);
		const copy = { ownership: "copy", lifetime: null };
		const refined = constructor => ({ ...copy, refinement: { constructor: `OnboardingSmall.${constructor}` } });
		const callback = [3, 9].includes(version);
		const exports = ["OnboardingSmall.echo", "OnboardingSmall.use", ...callback ? ["OnboardingSmall.make"] : [], ...version >= 8 ? ["OnboardingSmall.echoTree"] : []];
		const contracts = {
			"OnboardingSmall.echo": { parameters: [refined("checkedText")], result: refined("checkedText") }
			, "OnboardingSmall.use": { parameters: [refined("checkedText"), refined("checkedSmall"), callback ? { ownership: "borrow", lifetime: { scope: "call", anchor: null } } : copy] }
			, ...callback ? { "OnboardingSmall.make": { parameters: [refined("checkedText")] } } : {}
		};
		await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports, contracts, ...callback ? { arities: { "OnboardingSmall.make": 1 } } : {} }));
		const moved = join(directory, "moved"), releases = [];
		await cp(root, moved, { recursive: true });
		for(const [index, projectRoot] of [root, moved].entries())
		{
			const before = await lakeInputState(projectRoot);
			const outputRoot = join(directory, `build-${index}`);
			await build(projectRoot, outputRoot).catch(error => { assert.fail(`${error.message}: ${JSON.stringify(error.details)}`); });
			const bundleRoot = join(outputRoot, "bundle");
			const plan = JSON.parse(await readFile(join(bundleRoot, "locks/compiler-adapters.json"), "utf8"));
			assert.equal(plan.privateAbi.version, version);
			releases.push(await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(directory, `npm-${index}`) }));
			await verifyComponentPackageReceipt({ receiptPath: join(releases[index].output, "component-package-receipt.json") });
			assert.deepEqual(await lakeInputState(projectRoot), before);
		}
		assert.deepEqual(releases[0].report, releases[1].report);
		const archiveSha256 = sha256(await readFile(releases[0].componentArchive));
		assert.equal(archiveSha256, sha256(await readFile(releases[1].componentArchive)));
		await rename(root, join(directory, "source-unavailable"));
		await rename(moved, join(directory, "moved-unavailable"));
		const consumer = join(directory, "consumer"); await mkdir(consumer);
		await saveLakeFile(consumer, "package.json", '{"private":true,"type":"module"}');
		await processBuildRunner.capture({ command: "npm", args: ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(directory, "npm-cache"), releases[0].runtimeArchive, releases[0].componentArchive], cwd: consumer });
		await saveLakeFile(consumer, "index.mjs", `import assert from "node:assert/strict";
import * as api from "onboarding-small";
let calls = 0;
assert.equal(api.echo("Lean λ 🙂"), "Lean λ 🙂");
${consumers[version]}
for(let index = 0; index < 64; index++) {
  const before = calls;
  assert.throws(() => use("", 9));
  assert.throws(() => use("valid", 10));
  assert.equal(calls, before, "invalid input must not enter the host callback");
  assert.throws(() => api.echo(""));
  assert.equal(api.echo("recovered"), "recovered");
  use("valid", 9);
}
console.log("subtype component passed");
`);
		const result = await processBuildRunner.capture({ command: process.execPath, args: ["index.mjs"], cwd: consumer }).catch(error => { assert.fail(`${error.message}: ${JSON.stringify(error.details)}`); });
		assert.equal(result.stdout.trim(), "subtype component passed");
		await saveLakeFile(consumer, "index.mts", `import * as api from "onboarding-small";\nconst echoed: string = api.echo("hello");\n${typed[version]}\n`);
		await processBuildRunner.capture({ command: process.execPath, args: [join(engineRoot, "node_modules/typescript/lib/tsc.js"), "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"], cwd: consumer }).catch(error => { assert.fail(`${error.message}: ${JSON.stringify(error.details)}`); });
		t.diagnostic(`Subtype ABI ${version} archive SHA-256: ${archiveSha256}`);
	});
};
