/**
 * Install checked nominal Fin values from source-free, reproduced npm archives.
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
import { assertJsonSchema } from "./json-schema.mjs";

const source = `namespace OnboardingSmall
abbrev Digits := Array (Fin 7)
abbrev MoreDigits := Digits
structure Packet where
  digit : Fin 10
  digits : MoreDigits
  nested : List (Option ((Fin 3) × Except (Fin 2) (Fin 5)))
  huge : Fin 184467440737095516170
structure Impossible where
  value : Fin 0
inductive Choice where
  | empty
  | packet (value : Packet)
  | digit (value : Fin 3)
  | impossible (value : Fin 0)
inductive Tree where
  | leaf (value : Fin 5)
  | branch (value : Array Tree)
def packet (value : Packet) : Packet := value
def digits (value : MoreDigits) : MoreDigits := value.reverse
def choice (value : Choice) : Choice := value
def tree (value : Tree) : Tree := value
def impossible (value : Option Impossible) : Option Impossible := value
def arrays (value : Array (Fin 0)) : Array (Fin 0) := value
def both (first : Packet) (second : Packet) : Packet := if first.digit.val < second.digit.val then first else second
end OnboardingSmall
`;

/**
 * Exercise checked construction and projection without source or SDK access.
 *
 * @param t - Node test context.
 * @param options - Shared ordinary-source build harness.
 * @param options.fixture - Isolated author project factory.
 * @param options.build - Fresh compiler-owned component build.
 * @param options.runtimeRoot - Prepared shared runtime root.
 * @param options.engineRoot - Checkout containing the TypeScript compiler.
 */
export const checkNominalFinPackage = async (t, { fixture, build, runtimeRoot, engineRoot }) => {
	const { directory, root } = await fixture(t);
	await saveLakeFile(root, "OnboardingSmall.lean", source);
	const names = ["packet", "digits", "choice", "tree", "impossible", "arrays", "both"];
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports: names.map(name => `OnboardingSmall.${name}`) }));
	const moved = join(directory, "moved"), releases = [];
	await cp(root, moved, { recursive: true });
	for(const [index, projectRoot] of [root, moved].entries())
	{
		const before = await lakeInputState(projectRoot), outputRoot = join(directory, `build-${index}`);
		await build(projectRoot, outputRoot).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		const bundleRoot = join(outputRoot, "bundle");
		const plan = JSON.parse(await readFile(join(bundleRoot, "locks/compiler-adapters.json"), "utf8"));
		assert.equal(plan.privateAbi.version, 8);
		assert.ok(plan.nominalRefinements.some(entry => entry.id === "lean:OnboardingSmall.Packet"));
		assert.ok(plan.nominalRefinements.some(entry => entry.id === "lean:OnboardingSmall.Tree"));
		await assertJsonSchema("compiler-adapter-plan", plan);
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
import { runtime } from "./node_modules/onboarding-small/internal/runtime.mjs";
const none = { tag: "none" }, some = value => ({ tag: "some", value });
const good = { digit: 9n, digits: [0n, 6n], nested: [none, some([2n, { ok: 4n }]), some([0n, { error: 1n }])], huge: 184467440737095516169n };
const snapshot = structuredClone(good);
const leaf = value => ({ kind: "leaf", value });
const branch = value => ({ kind: "branch", value });
const cases = [
  ["packet", good, good, [
    { ...good, digit: 10n }, { ...good, digits: [7n] },
    { ...good, nested: [some([3n, { ok: 4n }])] },
    { ...good, nested: [some([2n, { ok: 5n }])] },
    { ...good, nested: [some([0n, { error: 2n }])] },
    { ...good, huge: 184467440737095516170n }
  ]],
  ["digits", [0n, 6n], [6n, 0n], [[7n]]],
  ["choice", { kind: "packet", value: good }, { kind: "packet", value: good }, [
    { kind: "digit", value: 3n }, { kind: "impossible", value: 0n }, { kind: "packet", value: { ...good, digit: 10n } }
  ]],
  ["tree", branch([leaf(4n), branch([])]), branch([leaf(4n), branch([])]), [branch([leaf(5n)])]],
  ["impossible", none, none, [some({ value: 0n })]],
  ["arrays", [], [], [[0n]]]
];
for (const [name, value, expected, invalid] of cases) {
  assert.deepEqual(api[name](value), expected);
  for (let round = 0; round < 32; round++) for (const bad of invalid) {
    assert.throws(() => api[name](bad), /below/);
    // Skip generated JS validation: the compiled constructor must reject safely.
    assert.throws(() => runtime.call("lean:OnboardingSmall." + name, [bad]), /failed \\(5\\)/, name);
    assert.deepEqual(api[name](value), expected);
    assert.deepEqual(runtime.call("lean:OnboardingSmall." + name, [value]), expected);
  }
}
for (let round = 0; round < 32; round++) {
  const bad = { ...good, digit: 10n };
  for (const args of [[bad, good], [good, bad], [bad, bad]])
    assert.throws(() => runtime.call("lean:OnboardingSmall.both", args), /failed \\(5\\)/);
  assert.deepEqual(api.both(good, good), good);
}
for (const digit of [-1n, 1]) assert.throws(() => api.packet({ ...good, digit }));
let reads = 0;
const getter = { ...good, get digit() { reads++; return 0n; } };
assert.throws(() => api.packet(getter), /own data fields/);
assert.equal(reads, 0);
const cycle = branch([]); cycle.value.push(cycle);
assert.throws(() => api.tree(cycle), /Cyclic/);
assert.deepEqual(api.choice({ kind: "empty" }), { kind: "empty" });
assert.deepEqual(api.choice({ kind: "digit", value: 2n }), { kind: "digit", value: 2n });
assert.deepEqual(good, snapshot);
console.log("nominal Fin passed");
`);
	const result = await processBuildRunner.capture({ command: process.execPath, args: ["index.mjs"], cwd: consumer }).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	assert.equal(result.stdout.trim(), "nominal Fin passed");
	await saveLakeFile(consumer, "index.mts", `import * as api from "onboarding-small";
const digits: ReadonlyArray<bigint> = api.digits([0n, 6n]);
const packet = api.packet({ digit: 9n, digits, nested: [{ tag: "some", value: [2n, { ok: 4n }] }], huge: 1n });
const digit: bigint = packet.digit;
const tree = api.tree({ kind: "branch", value: [{ kind: "leaf", value: 4n }] });
api.choice({ kind: "packet", value: packet });
api.impossible({ tag: "none" });
// @ts-expect-error Fin retains Nat's bigint representation.
api.packet({ ...packet, digit: 1 });
// @ts-expect-error Aliases preserve bigint leaves.
api.digits([1]);
void digits; void digit; void tree;
`);
	await processBuildRunner.capture({ command: process.execPath, args: [join(engineRoot, "node_modules/typescript/lib/tsc.js"), "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"], cwd: consumer }).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	t.diagnostic(`Nominal Fin ABI 8 archive SHA-256: ${archiveSha256}`);
};
