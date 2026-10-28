/**
 * Source-free npm acceptance for checked Fin callbacks and returned closures.
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

const scalarSource = `namespace OnboardingSmall
def three (f : Fin 3 → Fin 3) (value : Fin 3) : Fin 3 := f value
def five (f : Fin 5 → Fin 5) (value : Fin 5) : Fin 5 := f value
def closure (offset : Nat) : Fin 3 → Fin 3 := fun value => ⟨(value.val + offset) % 3, Nat.mod_lt _ (by decide)⟩
def emptyInput (_offset : Nat) : Fin 0 → Nat := fun value => value.val
def twice (f : Fin 3 → Fin 3) (value : Fin 3) : Fin 3 := f (f value)
def emptyArray (f : Array (Fin 0) → Array (Fin 0)) : Array (Fin 0) := f #[]
def emptyOption (f : Option (Fin 0) → Option (Fin 0)) : Option (Fin 0) := f none
def nested (f : List (Option ((Fin 3) × Except (Fin 2) (Fin 5))) → List (Option ((Fin 3) × Except (Fin 2) (Fin 5))))
    (value : List (Option ((Fin 3) × Except (Fin 2) (Fin 5)))) := f value
end OnboardingSmall
`;
const nominalSource = `namespace OnboardingSmall
abbrev Digits := Array (Fin 7)
abbrev MoreDigits := Digits
structure Packet where
  digit : Fin 10
  digits : MoreDigits
inductive Tree where
  | leaf (value : Fin 5)
  | branch (value : Array Tree)
inductive Choice where
  | impossible (value : Fin 0)
  | digit (value : Fin 3)
def packet (f : Packet → Packet) (value : Packet) : Packet := f value
def digits (f : MoreDigits → MoreDigits) (value : MoreDigits) : MoreDigits := f value
def tree (f : Tree → Tree) (value : Tree) : Tree := f value
def choice (f : Choice → Choice) (value : Choice) : Choice := f value
def packetClosure (offset : Nat) : Packet → Packet := fun value =>
  { value with digit := ⟨(value.digit.val + offset) % 10, Nat.mod_lt _ (by decide)⟩ }
def scalar (value : Fin 3) : Fin 3 := value
end OnboardingSmall
`;

const scalarCheck = `
assert.equal(api.three(value => value, 2n), 2n);
assert.equal(api.five(value => value, 4n), 4n);
const closure = api.closure(2n);
const rawClosure = raw("closure", [2n]);
for (let round = 0; round < 32; round++) {
  for (const bad of [3n, 999999999999999999999n]) {
    assert.throws(() => api.three(() => bad, 1n), /below/);
    assert.throws(() => raw("three", [() => bad, 1n]), /failed \\(5\\)/);
    assert.throws(() => closure(bad), /below/);
    assert.throws(() => rawClosure(bad), /failed \\(5\\)/);
  }
  assert.equal(closure(2n), 1n);
  assert.equal(rawClosure(2n), 1n);
  assert.equal(raw("three", [value => value, 2n]), 2n);
  let called = 0;
  assert.throws(() => raw("twice", [() => { called++; return 3n; }, 1n]), /failed \\(5\\)/);
  assert.equal(called, 1, "A failed callback suppresses subsequent host calls");
}
for (const bad of [-1n, 1, null]) {
  assert.throws(() => api.three(() => bad, 1n));
  assert.throws(() => raw("three", [() => bad, 1n]));
  assert.equal(api.three(value => value, 2n), 2n);
}
const original = new Error("host callback failed");
for (const call of [api.three, (f, value) => raw("three", [f, value])])
  assert.throws(() => call(() => { throw original; }, 1n), error => error === original);
assert.equal(api.three(value => api.five(() => 4n, value) % 3n, 2n), 1n);
assert.deepEqual(api.emptyArray(value => value), []);
assert.deepEqual(api.emptyOption(value => value), { tag: "none" });
for (const [name, bad] of [["emptyArray", [0n]], ["emptyOption", { tag: "some", value: 0n }]]) {
  assert.throws(() => api[name](() => bad), /below/);
  assert.throws(() => raw(name, [() => bad]), /failed \\(5\\)/);
  assert.deepEqual(api[name](value => value), name === "emptyArray" ? [] : { tag: "none" });
}
const nested = [{ tag: "some", value: [2n, { ok: 4n }] }, { tag: "some", value: [0n, { error: 1n }] }];
assert.deepEqual(api.nested(value => value, nested), nested);
for (const bad of [[3n, { ok: 4n }], [2n, { ok: 5n }], [0n, { error: 2n }]]) {
  const reply = [{ tag: "some", value: bad }];
  assert.throws(() => api.nested(() => reply, nested), /below/);
  assert.throws(() => raw("nested", [() => reply, nested]), /failed \\(5\\)/);
}
assert.deepEqual(api.nested(value => value, nested), nested);
const empty = api.emptyInput(0n), rawEmpty = raw("emptyInput", [0n]);
assert.throws(() => empty(0n), /below/);
assert.throws(() => rawEmpty(0n), /failed \\(5\\)/);
for (const value of [closure, rawClosure, empty, rawEmpty]) {
  assert.equal(value.disposed, false); value.dispose(); value.dispose();
  assert.equal(value.disposed, true); assert.throws(() => value(0n), /disposed|released|below 0/);
}
`;
const nominalCheck = `
const packet = { digit: 9n, digits: [0n, 6n] };
const cases = [
  ["packet", packet, [{ ...packet, digit: 10n }, { ...packet, digits: [7n] }]],
  ["digits", [0n, 6n], [[7n]]],
  ["tree", { kind: "branch", value: [{ kind: "leaf", value: 4n }] }, [{ kind: "leaf", value: 5n }]],
  ["choice", { kind: "digit", value: 2n }, [{ kind: "impossible", value: 0n }, { kind: "digit", value: 3n }]]
];
for (const [name, good, invalid] of cases) for (let round = 0; round < 32; round++) {
  for (const bad of invalid) {
    assert.throws(() => api[name](() => bad, good), /below/);
    assert.throws(() => raw(name, [() => bad, good]), /failed \\(5\\)/);
    let calls = 0;
    assert.throws(() => raw(name, [value => { calls++; return value; }, bad]), /failed \\(5\\)/);
    assert.equal(calls, 0);
  }
  assert.deepEqual(api[name](value => value, good), good);
  assert.deepEqual(raw(name, [value => value, good]), good);
}
const closure = api.packetClosure(2n), rawClosure = raw("packetClosure", [2n]);
for (const value of [closure, rawClosure]) {
  assert.throws(() => value({ ...packet, digit: 10n }));
  assert.deepEqual(value(packet), { ...packet, digit: 1n });
  value.dispose(); assert.equal(value.disposed, true); assert.throws(() => value(packet), /disposed|released/);
}
let reads = 0;
assert.throws(() => api.packet(() => ({ ...packet, get digit() { reads++; return 1n; } }), packet), /own data fields/);
assert.equal(reads, 0);
assert.equal(api.scalar(2n), 2n);
assert.throws(() => raw("scalar", [3n]), /failed \\(5\\)/);
assert.equal(api.scalar(2n), 2n);
`;

/** Each package's source, exports and closure arities; the browser acceptance reuses them unchanged. */
export const callbackFinCases = Object.freeze({
	scalar: { source: scalarSource, names: ["three", "five", "closure", "emptyInput", "twice", "emptyArray", "emptyOption", "nested"], arities: { "OnboardingSmall.closure": 1, "OnboardingSmall.emptyInput": 1 } }
	, nominal: { source: nominalSource, names: ["packet", "digits", "tree", "choice", "packetClosure", "scalar"], arities: { "OnboardingSmall.packetClosure": 1 } }
});

/**
 * Accept only the compiler's uninhabited callback-result rejection, in process or
 * decoded from the engine boundary; any other child failure or message is rejected.
 *
 * @param error - Build failure.
 */
export const isUninhabitedCallbackResult = error => error?.code === "uninhabited-callback-result"
	&& error.message === "Callback result has no finite recovery value";

/**
 * Build in two roots, install offline without source, and exercise both facades.
 *
 * @param t - Node test context.
 * @param options - Ordinary-source component build harness.
 * @param options.fixture - Isolated author project factory.
 * @param options.build - Fresh compiler-owned component build.
 * @param options.runtimeRoot - Prepared shared runtime root.
 * @param options.engineRoot - Checkout containing the TypeScript compiler.
 */
export const checkCallbackFinPackages = async (t, { fixture, build, runtimeRoot, engineRoot }) => {
	for(const [profile, check] of [["scalar", scalarCheck], ["nominal", nominalCheck]])
	{
		const { source, names, arities } = callbackFinCases[profile];
		const { directory, root } = await fixture(t);
		await saveLakeFile(root, "OnboardingSmall.lean", source);
		await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports: names.map(name => `OnboardingSmall.${name}`), arities }));
		const moved = join(directory, "moved"), releases = [];
		await cp(root, moved, { recursive: true });
		for(const [index, projectRoot] of [root, moved].entries())
		{
			const before = await lakeInputState(projectRoot), outputRoot = join(directory, `build-${index}`);
			await build(projectRoot, outputRoot).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
			const bundleRoot = join(outputRoot, "bundle");
			const plan = JSON.parse(await readFile(join(bundleRoot, "locks/compiler-adapters.json"), "utf8"));
			assert.equal(plan.privateAbi.version, 9);
			if(profile === "scalar")
			{
				assert.equal(plan.privateAbi.types.length, 0);
				const bounds = plan.privateAbi.callbacks.filter(type => type.refinements?.result?.kind === "fin");
				assert.ok(bounds.some(type => type.refinements.result.bound === "3"));
				assert.ok(bounds.some(type => type.refinements.result.bound === "5"));
				assert.equal(new Set(bounds.map(type => type.key)).size, bounds.length);
			} else assert.deepEqual(plan.privateAbi.nominalRefinements, plan.nominalRefinements);
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
const raw = (name, args) => runtime.call("lean:OnboardingSmall." + name, args);
${check}
console.log("callback Fin passed");
`);
		const run = command => processBuildRunner.capture({ ...command, cwd: consumer }).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		assert.equal((await run({ command: process.execPath, args: ["index.mjs"] })).stdout.trim(), "callback Fin passed");
		await saveLakeFile(consumer, "index.mts", profile === "scalar" ? `import * as api from "onboarding-small";
const value: bigint = api.three(value => value, 2n);
const closure = api.closure(2n); const result: bigint = closure(value); closure.dispose();
api.emptyArray(value => value); api.emptyOption(value => value);
api.nested(value => value, [{ tag: "some", value: [2n, { ok: 4n }] }]);
// @ts-expect-error Fin callbacks use bigint, not number.
api.three(() => 1, 2n);
// @ts-expect-error Returned closures retain bigint inputs.
closure(1);
void result;
` : `import * as api from "onboarding-small";
const packet = { digit: 9n, digits: [0n, 6n] };
const digit: bigint = api.packet(value => value, packet).digit;
const closure = api.packetClosure(2n); closure(packet); closure.dispose();
api.digits(value => value, [0n]); api.tree(value => value, { kind: "leaf", value: 4n });
api.choice(value => value, { kind: "digit", value: 2n });
// @ts-expect-error Nominal callback fields retain bigint leaves.
api.packet(() => ({ ...packet, digit: 1 }), packet);
void digit;
`);
		await run({ command: process.execPath, args: [join(engineRoot, "node_modules/typescript/lib/tsc.js"), "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"] });
		t.diagnostic(`Callback Fin ${profile} ABI 9 archive SHA-256: ${archiveSha256}`);
	}
	const { directory, root } = await fixture(t);
	await saveLakeFile(root, "OnboardingSmall.lean", "namespace OnboardingSmall\ndef impossible (_f : Nat → Fin 0) : Nat := 0\nend OnboardingSmall\n");
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports: ["OnboardingSmall.impossible"] }));
	const before = await lakeInputState(root);
	await assert.rejects(() => build(root, join(directory, "rejected")), isUninhabitedCallbackResult);
	assert.deepEqual(await lakeInputState(root), before);
};
