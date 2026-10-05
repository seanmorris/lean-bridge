/**
 * Install structural Fin refinements from source-free, reproduced npm archives.
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

const source = `namespace OnboardingSmall
abbrev Digit := Fin 10
def rows (value : Array (Array Digit)) : Array (Array Digit) := value.reverse
def empty (value : Array (Fin 0)) : Array (Fin 0) := value
def huge (value : Array (Fin 184467440737095516170)) : Array (Fin 184467440737095516170) := value
def nested (value : List (Option ((Fin 3) × Except (Fin 2) (Fin 5)))) : List (Option ((Fin 3) × Except (Fin 2) (Fin 5))) := value.reverse
end OnboardingSmall
`;
const extra = {
	5: "structure Plain where\n  value : String\ndef extra (value : Plain) : Plain := value\n"
	, 7: "abbrev Label := String\ndef extra (value : Label) : Label := value\n"
	, 8: "inductive Tree where\n  | leaf : String → Tree\n  | branch : Array Tree → Tree\ndef extra (value : Tree) : Tree := value\n"
	, 9: "def use (value : Array Digit) (f : Nat → Nat) : Nat := f value.size\ndef make (value : Array Digit) : Nat → Nat := fun n => n + value.size\n"
};

/**
 * Check ordinary-source compilation, relocation, offline execution and strict TS.
 *
 * @param t - Node test context.
 * @param options - Shared unlocked author-project build harness.
 * @param options.fixture - Create an isolated author project.
 * @param options.build - Build using compiler-owned metadata.
 * @param options.runtimeRoot - Prepared shared runtime root.
 * @param options.engineRoot - Checkout containing the TypeScript compiler.
 */
export const checkNestedFinPackages = async (t, { fixture, build, runtimeRoot, engineRoot }) => {
	for(const version of [4, 5, 6, 7, 8, 9]) await t.test(`private ABI ${version}`, async t => {
	const { directory, root } = await fixture(t);
	await saveLakeFile(root, "OnboardingSmall.lean", source.replace("end OnboardingSmall", `${extra[version] ?? ""}end OnboardingSmall`));
	const names = ["rows", "empty", "huge", ...version >= 6 ? ["nested"] : [], ...[5, 7, 8].includes(version) ? ["extra"] : [], ...version === 9 ? ["use", "make"] : []];
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports: names.map(name => `OnboardingSmall.${name}`), ...version === 9 ? { arities: { "OnboardingSmall.make": 1 } } : {} }));
	const moved = join(directory, "moved"), releases = [];
	await cp(root, moved, { recursive: true });
	for(const [index, projectRoot] of [root, moved].entries())
	{
		const before = await lakeInputState(projectRoot), outputRoot = join(directory, `build-${index}`);
		await build(projectRoot, outputRoot).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		const bundleRoot = join(outputRoot, "bundle");
		const plan = JSON.parse(await readFile(join(bundleRoot, "locks/compiler-adapters.json"), "utf8"));
		assert.equal(plan.privateAbi.version, version);
		if(version >= 6) assert.equal(plan.exports.find(item => item.sourceDeclaration === "OnboardingSmall.nested").refinements.parameters[0].kind, "list");
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
const good = [none, some([2n, { ok: 4n }]), some([0n, { error: 1n }])];
const cases = [
  ["rows", [[0n, 9n], []], [[], [0n, 9n]], [[[10n]], [[-1n]], [[9]]]],
  ["empty", [], [], [[0n]]],
  ["huge", [184467440737095516169n], [184467440737095516169n], [[184467440737095516170n]]],
  ["nested", good, [...good].reverse(), [[some([3n, { ok: 4n }])], [some([2n, { ok: 5n }])], [some([0n, { error: 2n }])]]]
];
for (const [name, value, expected, invalid] of cases) {
  if (!api[name]) continue;
  assert.deepEqual(api[name](value), expected);
  for (let round = 0; round < 32; round++) for (const [badIndex, bad] of invalid.entries()) {
    assert.throws(() => api[name](bad));
    // Bypass generated JS refinements: compiled Lean must still reject safely.
    assert.throws(() => runtime.call("lean:OnboardingSmall." + name, [bad]), badIndex === 0 ? /failed \\(5\\)/ : undefined);
    assert.deepEqual(api[name](value), expected);
    assert.deepEqual(runtime.call("lean:OnboardingSmall." + name, [value]), expected);
  }
}
assert.deepEqual(good, [none, some([2n, { ok: 4n }]), some([0n, { error: 1n }])]);
if (api.nested) assert.deepEqual(api.nested([]), []);
if (api.use) {
  let calls = 0;
  const f = value => { calls++; return value + 1n; };
  for (let round = 0; round < 32; round++) {
    const before = calls;
    assert.throws(() => runtime.call("lean:OnboardingSmall.use", [[10n], f]), /failed \\(5\\)/);
    assert.equal(calls, before);
    assert.equal(api.use([9n], f), 2n);
    assert.throws(() => runtime.call("lean:OnboardingSmall.make", [[10n]]), /failed \\(5\\)/);
    const closure = api.make([0n, 9n]);
    try { assert.equal(closure(3n), 5n); } finally { closure.dispose(); }
  }
}
console.log("nested Fin passed");
`);
	const result = await processBuildRunner.capture({ command: process.execPath, args: ["index.mjs"], cwd: consumer }).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	assert.equal(result.stdout.trim(), "nested Fin passed");
	await saveLakeFile(consumer, "index.mts", `import * as api from "onboarding-small";
const rows: ReadonlyArray<ReadonlyArray<bigint>> = api.rows([[1n]]);
const huge: ReadonlyArray<bigint> = api.huge([184467440737095516169n]);
${version >= 6 ? 'const nested = api.nested([{ tag: "some", value: [2n, { ok: 4n }] }]); void nested;' : ""}
// @ts-expect-error Fin retains Nat's bigint representation.
api.rows([[1]]);
void rows; void huge;
`);
	await processBuildRunner.capture({ command: process.execPath, args: [join(engineRoot, "node_modules/typescript/lib/tsc.js"), "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"], cwd: consumer }).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	t.diagnostic(`Nested Fin ABI ${version} archive SHA-256: ${archiveSha256}`);
	});
};
