/**
 * Checked top-level Fin sites in installed, relocated native PHP packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { renderCopiedPhpPackage } from "../src/backends/php/copied-values.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const huge = "1180591620717411303424";
const expectedBounds = {
	"NativeFin.impossible": [["0"], null]
	, "NativeFin.only": [["1"], null]
	, "NativeFin.mirror": [["10"], "10"]
	, "NativeFin.twice": [["300"], null]
	, "NativeFin.succHuge": [[huge], huge]
	, "NativeFin.wrap": [[null], "7"]
	, "NativeFin.label": [[null, "4", null], null]
};
const bounds = refinements => refinements ? [refinements.parameters.map(item => item?.bound ?? null), refinements.result?.bound ?? null] : null;
const sharedLibraries = files => Object.fromEntries(Object.entries(files)
	.filter(([path]) => /\.so(?:\.|$)/.test(path)).map(([path, file]) => [basename(path), file.sha256 ?? file]));

/** Public API cases: exact bounds, host exception identity, cleanup and recovery. */
const phpFinConsumer = () => `<?php
declare(strict_types=0);
use Brick\\Math\\BigInteger;
use LeanNativeFin\\LeanBridgeError;
require 'vendor/autoload.php';
$checks = 0;
function check(bool $value, string $label): void {
    global $checks;
    if (!$value) throw new RuntimeException("failed: $label");
    ++$checks;
}
function rejected(callable $call, string $parameter, string $bound): bool {
    try { $call(); }
    catch (LeanBridgeError $error) { return $error->getCode() === 1 && $error->getMessage() === "$parameter is not below its Fin $bound bound"; }
    return false;
}
function throwsType(string $type, callable $call): bool {
    try { $call(); } catch (Throwable $error) { return $error instanceof $type; }
    return false;
}
function n(int|string $value): BigInteger { return BigInteger::of($value); }
$huge = BigInteger::of(2)->power(70); $word = BigInteger::of(2)->power(32);
check(rejected(fn() => LeanNativeFin\\impossible(n(0)), 'value', '0'), 'Fin 0 rejects zero');
check(rejected(fn() => LeanNativeFin\\impossible(n(1)), 'value', '0'), 'Fin 0 rejects one');
check(LeanNativeFin\\only(n(0))->isEqualTo(7), 'Fin 1 accepts zero');
check(rejected(fn() => LeanNativeFin\\only(n(1)), 'value', '1'), 'Fin 1 rejects its bound');
check(LeanNativeFin\\mirror(n(0))->isEqualTo(9) && LeanNativeFin\\mirror(n(9))->isEqualTo(0), 'Fin 10 endpoints');
check(LeanNativeFin\\mirror(n(4)) instanceof BigInteger, 'exact BigInteger results');
foreach ([n(10), n(11), $word, $huge] as $value)
    check(rejected(fn() => LeanNativeFin\\mirror($value), 'value', '10'), 'Fin 10 rejects ' . $value);
check(throwsType(ValueError::class, fn() => LeanNativeFin\\mirror(n(-1))), 'negative is the Nat ValueError');
foreach ([1, '1', 1.0, true, null] as $value)
    check(throwsType(TypeError::class, fn() => LeanNativeFin\\mirror($value)), 'non-BigInteger is TypeError: ' . get_debug_type($value));
check(LeanNativeFin\\twice(n(299))->isEqualTo(598), 'alias accepts its largest value');
check(rejected(fn() => LeanNativeFin\\twice(n(300)), 'value', '300'), 'alias rejects its bound');
check(rejected(fn() => LeanNativeFin\\twice(n(301)), 'value', '300'), 'alias rejects beyond its bound');
check(LeanNativeFin\\succ_huge($word)->isEqualTo($word->plus(1)), 'large Fin crosses a limb');
check(LeanNativeFin\\succ_huge($huge->minus(2))->isEqualTo($huge->minus(1)) && LeanNativeFin\\succ_huge($huge->minus(1))->isEqualTo($huge->minus(1)), 'large Fin endpoints');
foreach ([$huge, $huge->plus(1), BigInteger::of(2)->power(128)] as $value)
    check(rejected(fn() => LeanNativeFin\\succ_huge($value), 'value', (string) $huge), 'large Fin rejects ' . $value);
check(LeanNativeFin\\wrap(n(100))->isEqualTo(2) && LeanNativeFin\\wrap($huge)->isEqualTo(2) && LeanNativeFin\\wrap(n(0))->isEqualTo(0), 'result-only Fin values');
$base = n(5); $name = 'slot';
check(LeanNativeFin\\label($base, n(3), $name) === 'slot:8', 'mixed arguments');
check(rejected(fn() => LeanNativeFin\\label($base, n(4), $name), 'offset', '4'), 'mixed arguments reject the Fin site');
check($base->isEqualTo(5) && $name === 'slot' && LeanNativeFin\\label($base, n(0), $name) === 'slot:5', 'caller data unchanged');
for ($i = 0; $i < 1000; ++$i) {
    if (!rejected(fn() => LeanNativeFin\\mirror(n(10 + $i)), 'value', '10')) throw new RuntimeException("invalid call accepted at $i");
    if (!LeanNativeFin\\mirror(n($i % 10))->isEqualTo(9 - $i % 10)) throw new RuntimeException("valid call failed at $i");
}
$checks += 2000;
echo "php-fin-ok:$checks\\n";
`;

test("native PHP packages are checked Fin consumers beside the other C-adapter hosts", () => {
	for(const targets of [["php-native"], ["c", "php-native"], ["c", "cpp", "pypi", "cargo", "rubygems", "nuget", "maven", "php-native"]])
		assert.equal(supportsNativeRefinementTargets(targets), true, targets.join(","));
	for(const target of ["cpan", "wit-wasi"])
		assert.equal(supportsNativeRefinementTargets(["php-native", target]), false, target);
});

test("generated PHP bound docs come only from checked refinement metadata", () => {
	const ir = corpusReviewedIr({ id: "fins" }, [
		{ name: "Fins.label", parameters: ["nat", "nat", "string"], result: "string" }
		, { name: "Fins.plain", parameters: ["nat"], result: "nat" }]);
	const label = ir.declarations.find(item => item.id === "lean:Fins.label");
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "fin", bound: "4" }, null], result: null };
	const files = renderCopiedPhpPackage(compileCopiedPhpModel(ir));
	const api = Object.values(files).find(source => typeof source === "string" && source.includes("function label("));
	assert.match(api, /\/\*\*\n \* Checked Lean Fin bounds: \$value1 < 4\.\n \*\n \* @param/);
	assert.doesNotMatch(api, /bounds:[^\n]*\n(?: \*[^\n]*\n)* \*\/\nfunction plain\(/);
	assert.match(files["README.md"], /Lean Fin n parameters and results are Brick\\Math\\BigInteger values below n\./);
	assert.match(files["README.md"], /\n- LeanFins\\label: \$value1 < 4\n/);
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "subtype", constructor: "Fins.check" }, null], result: null };
	assert.throws(() => renderCopiedPhpPackage(compileCopiedPhpModel(ir)), TypeError);
});

test("relocated source-free native PHP packages check Fin bounds through the bundled C adapter", { skip: process.env.LEAN_BRIDGE_PHP_FIN_TEST !== "1", timeout: 2_400_000 }, async t => {
	const environment = nativeFixtureEnvironment(["c", "php-native"]), reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "native-fin", version: "1.0.0" }, "php-native": { name: "lean-bridge-fixtures/native-fin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling the shared C library and Composer archive`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "php-native"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, bounds(item.refinements)])), expectedBounds);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		await rm(author, { recursive: true, force: true });
		if(attempt === 1) break;
		const cPackage = receipt.packages.find(pkg => pkg.target === "c" && pkg.role === "component");
		const extracted = join(consumer, "c-extract");
		await saveLakeFile(extracted, ".keep", "");
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, cPackage.artifacts[0].path)], extracted);
		const cInstalled = join(extracted, `${cPackage.name}-${cPackage.version}-c`);
		const cReceipt = JSON.parse(await readFile(join(cInstalled, "lean-bridge-package.json"), "utf8"));
		await verifyNativeFiles(cInstalled, cReceipt.files);
		const cLibraries = sharedLibraries(cReceipt.files);
		// The Composer archive bundles the exact checked adapter that the C, Python and Rust probes instrument.
		const packages = receipt.packages.filter(pkg => pkg.target === "php-native");
		const unpacked = join(consumer, "composer-archive");
		await saveLakeFile(unpacked, ".keep", "");
		await runCopied("/usr/bin/unzip", ["-q", join(handoff, packages.find(pkg => pkg.role === "component").artifacts[0].path), "-d", unpacked], consumer);
		const entries = await readdir(unpacked, { recursive: true });
		const packageLibraries = Object.fromEntries(await Promise.all(entries.filter(path => /\.so(?:\.|$)/.test(path))
			.map(async path => [basename(path), sha256(await readFile(join(unpacked, path)))])));
		const shared = Object.keys(packageLibraries).filter(name => Object.hasOwn(cLibraries, name)).sort();
		assert.ok(shared.includes("libnative_fin.so"), JSON.stringify({ php: packageLibraries, c: cLibraries }));
		for(const name of shared) assert.equal(packageLibraries[name], cLibraries[name], name);
		const docs = (await Promise.all(entries.filter(path => path.endsWith(".php")).map(path => readFile(join(unpacked, path), "utf8")))).join("\n");
		assert.match(docs, /Checked Lean Fin bounds: \$value < 10; result < 10\./);
		t.diagnostic("offline Composer installation without producer files or Lean/C compilers");
		const fixture = { source: phpFinConsumer, success: "php-fin-ok" };
		const { command, ...observation } = await installCopiedConsumer({ profile: "php-native", consumer, handoff, packages, environment, fixture });
		const root = join(consumer, "php-native"), relocated = join(consumer, "php-relocated");
		await rename(root, relocated);
		const repeated = await runCopied(command, ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "consumer.php"], relocated, copiedCleanEnvironment);
		assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout.trim(), `php-fin-ok:${observation.checks}`);
		reports.push({ profile: "php-native", path: "ordinary-source"
			, ...observation
			, packages
			, sharedNativeLibraries: Object.fromEntries(shared.map(name => [name, packageLibraries[name]]))
			, dispatch: { observed: false, reason: "PHP FFI loads verified libraries privately; identity with the instrumented C adapter is asserted instead" }
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, sourceRemovedBeforeInstallation: true
			, relocatedInstallation: true, repeatExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", "php.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
