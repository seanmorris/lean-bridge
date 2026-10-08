/**
 * Checked top-level Fin sites in installed, relocated native PHP packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
import { reviewedScalarHostIr } from "./helpers/reviewed-scalar-host-fixture.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { nativeFinDispatchColumns } from "./helpers/native-fin-consumers.mjs";
import { nativeFinCountInterposer } from "./helpers/native-fin-count-interposer.mjs";
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
check(rejected(fn() => LeanNativeFin\\impossible(n(0)), 'arg0', '0'), 'Fin 0 rejects zero');
check(rejected(fn() => LeanNativeFin\\impossible(n(1)), 'arg0', '0'), 'Fin 0 rejects one');
check(LeanNativeFin\\only(n(0))->isEqualTo(7), 'Fin 1 accepts zero');
check(rejected(fn() => LeanNativeFin\\only(n(1)), 'arg0', '1'), 'Fin 1 rejects its bound');
check(LeanNativeFin\\mirror(n(0))->isEqualTo(9) && LeanNativeFin\\mirror(n(9))->isEqualTo(0), 'Fin 10 endpoints');
check(LeanNativeFin\\mirror(n(4)) instanceof BigInteger, 'exact BigInteger results');
foreach ([n(10), n(11), $word, $huge] as $value)
    check(rejected(fn() => LeanNativeFin\\mirror($value), 'arg0', '10'), 'Fin 10 rejects ' . $value);
check(throwsType(ValueError::class, fn() => LeanNativeFin\\mirror(n(-1))), 'negative is the Nat ValueError');
foreach ([1, '1', 1.0, true, null] as $value)
    check(throwsType(TypeError::class, fn() => LeanNativeFin\\mirror($value)), 'non-BigInteger is TypeError: ' . get_debug_type($value));
check(LeanNativeFin\\twice(n(299))->isEqualTo(598), 'alias accepts its largest value');
check(rejected(fn() => LeanNativeFin\\twice(n(300)), 'arg0', '300'), 'alias rejects its bound');
check(rejected(fn() => LeanNativeFin\\twice(n(301)), 'arg0', '300'), 'alias rejects beyond its bound');
check(LeanNativeFin\\succ_huge($word)->isEqualTo($word->plus(1)), 'large Fin crosses a limb');
check(LeanNativeFin\\succ_huge($huge->minus(2))->isEqualTo($huge->minus(1)) && LeanNativeFin\\succ_huge($huge->minus(1))->isEqualTo($huge->minus(1)), 'large Fin endpoints');
foreach ([$huge, $huge->plus(1), BigInteger::of(2)->power(128)] as $value)
    check(rejected(fn() => LeanNativeFin\\succ_huge($value), 'arg0', (string) $huge), 'large Fin rejects ' . $value);
check(LeanNativeFin\\wrap(n(100))->isEqualTo(2) && LeanNativeFin\\wrap($huge)->isEqualTo(2) && LeanNativeFin\\wrap(n(0))->isEqualTo(0), 'result-only Fin values');
$base = n(5); $name = 'slot';
check(LeanNativeFin\\label($base, n(3), $name) === 'slot:8', 'mixed arguments');
check(rejected(fn() => LeanNativeFin\\label($base, n(4), $name), 'arg1', '4'), 'mixed arguments reject the Fin site');
check($base->isEqualTo(5) && $name === 'slot' && LeanNativeFin\\label($base, n(0), $name) === 'slot:5', 'caller data unchanged');
for ($i = 0; $i < 1000; ++$i) {
    if (!rejected(fn() => LeanNativeFin\\mirror(n(10 + $i)), 'arg0', '10')) throw new RuntimeException("invalid call accepted at $i");
    if (!LeanNativeFin\\mirror(n($i % 10))->isEqualTo(9 - $i % 10)) throw new RuntimeException("valid call failed at $i");
}
$checks += 2000;
echo "php-fin-ok:$checks\\n";
`;

/**
 * Per-step public PHP calls in the dispatch probe with their exact statuses and
 * cumulative counts in nativeFinDispatchColumns order: source mirror, impossible
 * and label, then their adapters. Invalid calls run before any valid call.
 */
const phpFinDispatchSteps = [
	["start", null, "ok", [0, 0, 0, 0, 0, 0]]
	, ["invalid-mirror-bound", String.raw`LeanNativeFin\mirror(n(10))`, "rejected:1:arg0<10", [0, 0, 0, 0, 0, 0]]
	, ["invalid-mirror-huge", String.raw`LeanNativeFin\mirror(BigInteger::of(2)->power(70))`, "rejected:1:arg0<10", [0, 0, 0, 0, 0, 0]]
	, ["invalid-impossible-zero", String.raw`LeanNativeFin\impossible(n(0))`, "rejected:1:arg0<0", [0, 0, 0, 0, 0, 0]]
	, ["invalid-label-late", String.raw`LeanNativeFin\label(n(5), n(4), 'slot')`, "rejected:1:arg1<4", [0, 0, 0, 0, 0, 0]]
	, ["valid-mirror", String.raw`LeanNativeFin\mirror(n(3))`, "ok:6", [1, 0, 0, 1, 0, 0]]
	, ["valid-label", String.raw`LeanNativeFin\label(n(5), n(3), 'slot')`, "ok:slot:8", [1, 0, 1, 1, 0, 1]]
	, ["recovery-invalid-mirror", String.raw`LeanNativeFin\mirror(n(10))`, "rejected:1:arg0<10", [1, 0, 1, 1, 0, 1]]
	, ["recovery-invalid-impossible", String.raw`LeanNativeFin\impossible(n(0))`, "rejected:1:arg0<0", [1, 0, 1, 1, 0, 1]]
	, ["recovery-invalid-label", String.raw`LeanNativeFin\label(n(5), n(4), 'slot')`, "rejected:1:arg1<4", [1, 0, 1, 1, 0, 1]]
	, ["recovery-valid-mirror", String.raw`LeanNativeFin\mirror(n(9))`, "ok:0", [2, 0, 1, 2, 0, 1]]
	, ["recovery-valid-label", String.raw`LeanNativeFin\label(n(5), n(0), 'slot')`, "ok:slot:5", [2, 0, 2, 2, 0, 2]]
];
const phpFinDispatchExpected = phpFinDispatchSteps.map(([step, , status, counts]) => [step, status, counts]);
const phpFinDispatchRoutes = [String.raw`public PHP functions LeanNativeFin\mirror, LeanNativeFin\impossible and LeanNativeFin\label through Composer autoload and PHP FFI into the bundled C adapter`];
const missingCounter = "native_fin_dispatch_count is not resolvable in this PHP process: Failed resolving C function 'native_fin_dispatch_count'\n";

/**
 * Probe run under the count interposer. It resolves the counter from the
 * process-wide symbol scope before loading the package and exits with status 2
 * when the counter is missing, so an absent interposer never reports zeros.
 */
const phpFinDispatchProbe = () => String.raw`<?php
declare(strict_types=1);
use Brick\Math\BigInteger;
use LeanNativeFin\LeanBridgeError;
try {
    $counter = FFI::cdef('unsigned long native_fin_dispatch_count(unsigned);');
} catch (Throwable $error) {
    fwrite(STDERR, 'native_fin_dispatch_count is not resolvable in this PHP process: ' . $error->getMessage() . "\n");
    exit(2);
}
if ($argc !== 2) {
    fwrite(STDERR, "usage: dispatch.php CONSUMER_ROOT\n");
    exit(2);
}
require $argv[1] . '/vendor/autoload.php';
function n(int $value): BigInteger { return BigInteger::of($value); }
function status(callable $call): string {
    try { $result = $call(); }
    catch (LeanBridgeError $error) {
        return preg_match('/^(arg[0-9]+) is not below its Fin ([0-9]+) bound$/D', $error->getMessage(), $match) === 1
            ? 'rejected:' . $error->getCode() . ':' . $match[1] . '<' . $match[2] : 'native-error:' . $error->getCode();
    }
    catch (Throwable $error) { return 'threw:' . get_class($error); }
    if ($result instanceof BigInteger) return 'ok:' . $result;
    return is_string($result) && preg_match('/^[!-~]+$/D', $result) === 1 ? 'ok:' . $result : 'ok:unprintable';
}
function report(FFI $counter, string $step, string $status): void {
    $line = "$step $status";
    for ($index = 0; $index < ${phpFinDispatchSteps[0][3].length}; ++$index) $line .= ' ' . $counter->native_fin_dispatch_count($index);
    echo $line, "\n";
}
report($counter, 'start', 'ok');
${phpFinDispatchSteps.slice(1).map(([step, call]) => `report($counter, '${step}', status(fn() => ${call}));`).join("\n")}
`;

const dispatchLine = /^([a-z]+(?:-[a-z]+)*) (\S+)((?: (?:0|[1-9][0-9]{0,14})){6})$/;

/**
 * Parse the probe output strictly and accept only the exact ordered rows. Each
 * row is checked against its step, status and per-step count change, so a
 * rejected call that enters Lean fails even when later counts compensate.
 *
 * @param stdout - Complete standard output of one PHP dispatch probe run.
 */
const readPhpFinDispatch = stdout => {
	if(typeof stdout !== "string" || !stdout.endsWith("\n")) throw new TypeError("dispatch output must be newline-terminated text");
	const rows = stdout.slice(0, -1).split("\n").map((line, index) => {
		const match = dispatchLine.exec(line);
		if(!match) throw new TypeError(`dispatch line ${index + 1} is malformed: ${JSON.stringify(line)}`);
		return [match[1], match[2], match[3].slice(1).split(" ").map(Number)];
	});
	const steps = rows.map(([step]) => step).join(",");
	if(steps !== phpFinDispatchExpected.map(([step]) => step).join(",")) throw new TypeError(`dispatch steps differ: ${steps}`);
	const zero = phpFinDispatchExpected[0][2].map(() => 0);
	rows.forEach(([step, status, counts], index) => {
		const [, expectedStatus, expectedCounts] = phpFinDispatchExpected[index];
		const previous = index ? rows[index - 1][2] : zero, expectedPrevious = index ? phpFinDispatchExpected[index - 1][2] : zero;
		const change = counts.map((value, column) => value - previous[column]);
		const expectedChange = expectedCounts.map((value, column) => value - expectedPrevious[column]);
		if(status !== expectedStatus) throw new TypeError(`${step} reported ${status} instead of ${expectedStatus}`);
		if(counts[1] !== 0 || counts[4] !== 0) throw new TypeError(`${step}: Fin 0 entered ${nativeFinDispatchColumns[1]} or its adapter`);
		if(status.startsWith("rejected:") && change.some(Boolean)) throw new TypeError(`${step} was rejected but changed counts by ${change.join(" ")}`);
		if(change.some((value, column) => value !== expectedChange[column])) throw new TypeError(`${step} changed counts by ${change.join(" ")} instead of ${expectedChange.join(" ")}`);
	});
	return rows;
};

/**
 * Count source and adapter entry inside a PHP process that runs the relocated consumer.
 *
 * @param root0 - Relocated consumer project and the PHP command that ran it.
 * @param root0.consumer - Task-owned root that receives the probe directory beside the deployment.
 * @param root0.relocated - Relocated Composer project that holds vendor/autoload.php.
 * @param root0.command - PHP CLI that ran the installed consumers.
 */
const observePhpDispatch = async ({ consumer, relocated, command }) => {
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
	// Each counted symbol must be a defined dynamic symbol of the verified deployment for the preload to interpose it.
	const native = (await readdir(join(relocated, "vendor"), { recursive: true })).filter(path => /\/native\/linux-x64\/[^/]+\.so$/.test(path));
	assert.ok(native.some(path => basename(path) === "libnative_fin.so"), native.join(","));
	const defined = new Set();
	for(const path of native)
	{
		const listed = await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(relocated, "vendor", path)], relocated, tools);
		for(const line of listed.stdout.split("\n")) defined.add(line.trim().split(/\s+/).at(-1));
	}
	for(const symbol of nativeFinDispatchColumns) assert.ok(defined.has(symbol), symbol);
	const probeRoot = join(consumer, "dispatch"), interposer = join(probeRoot, "libdispatch.so");
	await saveLakeFile(probeRoot, "interposer.c", nativeFinCountInterposer());
	await saveLakeFile(probeRoot, "dispatch.php", phpFinDispatchProbe());
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], probeRoot, tools);
	assert.match((await runCopied("/usr/bin/nm", ["-D", "--defined-only", interposer], probeRoot, tools)).stdout, /^[0-9a-f]+ T native_fin_dispatch_count$/m);
	const args = ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", join(probeRoot, "dispatch.php"), relocated];
	// Without the preload the counter is missing and the probe refuses before loading the package.
	await assert.rejects(runCopied(command, args, relocated), error => /exited with status 2/.test(error.message)
		&& error.details.stdout === "" && error.details.stderr === missingCounter);
	const run = await runCopied(command, args, relocated, { ...copiedCleanEnvironment, LD_PRELOAD: interposer });
	assert.equal(run.stderr, "");
	const observed = readPhpFinDispatch(run.stdout);
	assert.deepEqual(observed, phpFinDispatchExpected);
	return { columns: nativeFinDispatchColumns, observed, interposer: "LD_PRELOAD"
		, routes: phpFinDispatchRoutes
		, positiveControl: "valid public PHP calls increment exactly their source and adapter columns; rejected calls, including every Fin 0 call, change no column"
		, probeSha256: sha256(phpFinDispatchProbe())
		, interposerSha256: sha256(nativeFinCountInterposer()) };
};

test("native PHP packages are checked Fin consumers beside the other C-adapter hosts", () => {
	for(const targets of [["php-native"], ["c", "php-native"], ["c", "cpp", "pypi", "cargo", "rubygems", "nuget", "maven", "php-native"]])
		assert.equal(supportsNativeRefinementTargets(targets), true, targets.join(","));
	assert.equal(supportsNativeRefinementTargets(["php-native", "cpan"]), true);
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
	// A top-level Subtype documents its checked constructor; one inside a container is refused.
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "subtype", constructor: "Fins.check" }, null], result: null };
	const checked = renderCopiedPhpPackage(compileCopiedPhpModel(ir));
	assert.match(checked["README.md"], /checked by Fins\.check/);
	assert.match(checked["README.md"], /Lean Subtype parameters cross as their base value\./);
	assert.doesNotMatch(checked["README.md"], /Lean Fin n parameters/);
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "array", arguments: [{ kind: "subtype", constructor: "Fins.check" }] }, null], result: null };
	assert.throws(() => renderCopiedPhpPackage(compileCopiedPhpModel(ir)), TypeError);
});

test("the PHP dispatch expectations separate rejections from positive controls", () => {
	assert.equal(phpFinDispatchSteps[0][3].length, nativeFinDispatchColumns.length);
	assert.deepEqual(nativeFinDispatchColumns.slice(0, 3), ["l_NativeFin_mirror", "l_NativeFin_impossible", "l_NativeFin_label"]);
	const firstValid = phpFinDispatchSteps.findIndex(([, , status]) => status.startsWith("ok:"));
	assert.ok(phpFinDispatchSteps.slice(1, firstValid).every(([, , status, counts]) => status.startsWith("rejected:") && counts.every(value => value === 0)));
	for(const [index, [step, call, status, counts]] of phpFinDispatchSteps.entries())
	{
		if(!index) continue;
		const change = counts.map((value, column) => value - phpFinDispatchSteps[index - 1][3][column]);
		const source = call.match(/LeanNativeFin\\(mirror|impossible|label)\(/)[1];
		const column = ["mirror", "impossible", "label"].indexOf(source);
		const entered = change.map((value, i) => i === column || i === column + 3 ? 1 : 0);
		assert.deepEqual(change, status.startsWith("ok:") ? entered : [0, 0, 0, 0, 0, 0], step);
		if(source === "impossible") assert.match(status, /^rejected:1:arg0<0$/, step);
	}
	assert.ok(phpFinDispatchSteps.some(([step, call]) => step.startsWith("invalid-") && /2\)->power\(70\)/.test(call)));
	assert.ok(phpFinDispatchSteps.some(([, , status]) => status === "rejected:1:arg1<4"));
});

test("the PHP dispatch parser accepts only the exact ordered per-step rows", () => {
	const render = rows => rows.map(([step, status, counts]) => `${step} ${status} ${counts.join(" ")}\n`).join("");
	const expected = phpFinDispatchExpected, copy = () => structuredClone(expected);
	const at = step => expected.findIndex(([name]) => name === step);
	const shift = (rows, from, column, by) => {
		for(const row of rows.slice(from)) row[2][column] += by;
		return rows;
	};
	const swap = (rows, a, b) => {
		[rows[a], rows[b]] = [rows[b], rows[a]];
		return rows;
	};
	const status = (step, value) => {
		const rows = copy();
		rows[at(step)][1] = value;
		return render(rows);
	};
	assert.deepEqual(readPhpFinDispatch(render(expected)), expected);
	const mutations = {
		"missing row": render(expected.filter(([step]) => step !== "recovery-invalid-label"))
		, "missing final row": render(expected.slice(0, -1))
		, "missing start row": render(expected.slice(1))
		, "duplicated row": render([...expected, expected.at(-1)])
		, "reordered rejections": render(swap(copy(), at("invalid-mirror-bound"), at("invalid-mirror-huge")))
		, "reordered valid steps": render(swap(copy(), at("valid-mirror"), at("valid-label")))
		, "reordered recovery": render(swap(copy(), at("recovery-invalid-mirror"), at("recovery-valid-mirror")))
		, "all-zero valid counters": render(expected.map(([step, value, counts]) => [step, value, counts.map(() => 0)]))
		, "nonzero start": render(shift(copy(), 0, 3, 1))
		, "valid source without adapter": render(shift(copy(), at("valid-mirror"), 3, -1))
		, "valid adapter without source": render(shift(copy(), at("valid-label"), 2, -1))
		, "valid call entering twice": render(shift(copy(), at("recovery-valid-label"), 2, 1))
		, "Fin 0 source entered by a later valid step": render(shift(copy(), at("valid-mirror"), 1, 1))
		, "Fin 0 adapter entered by a rejection": render(shift(copy(), at("invalid-impossible-zero"), 4, 1))
		, "altered valid result": status("valid-mirror", "ok:7")
		, "altered label result": status("valid-label", "ok:slot:9")
		, "altered rejection bound": status("invalid-mirror-bound", "rejected:1:arg0<11")
		, "altered rejection parameter": status("invalid-label-late", "rejected:1:arg0<4")
		, "altered rejection code": status("invalid-mirror-huge", "rejected:2:arg0<10")
		, "rejection replaced by a PHP exception": status("invalid-impossible-zero", "threw:TypeError")
		, "rejection reported as success": status("recovery-invalid-mirror", "ok:6")
		, "success reported as rejection": status("recovery-valid-mirror", "rejected:1:arg0<10")
		, "unmatched native message": status("recovery-invalid-label", "native-error:1")
		, "compensated totals": render(shift(shift(copy(), at("invalid-mirror-bound"), 0, 1), at("valid-mirror"), 0, -1))
		, "compensated recovery totals": render(shift(shift(copy(), at("recovery-invalid-label"), 5, 1), at("recovery-valid-label"), 5, -1))
		, "empty output": ""
		, "missing final newline": render(expected).slice(0, -1)
		, "trailing blank line": `${render(expected)}\n`
		, "carriage returns": render(expected).replaceAll("\n", "\r\n")
		, "tab separator": render(expected).replace("start ok", "start\tok")
		, "double space": render(expected).replace("start ok", "start  ok")
		, "five columns": render(expected).replace("start ok 0 0 0 0 0 0", "start ok 0 0 0 0 0")
		, "seven columns": render(expected).replace("start ok 0 0 0 0 0 0", "start ok 0 0 0 0 0 0 0")
		, "leading zero": render(expected).replace("start ok 0 0 0 0 0 0", "start ok 00 0 0 0 0 0")
		, "negative count": render(expected).replace("start ok 0 0 0 0 0 0", "start ok -0 0 0 0 0 0")
		, "trailing text": render(expected).replace("start ok 0 0 0 0 0 0", "start ok 0 0 0 0 0 0 extra")
		, "uppercase step": render(expected).replace("start ok", "Start ok")
		, "trailing diagnostic line": `${render(expected)}warning ok 0 0 0 0 0 0\n`
	};
	for(const [column, symbol] of nativeFinDispatchColumns.entries())
		for(const [step, value] of expected)
			if(value.startsWith("rejected:")) mutations[`${step} entering ${symbol}`] = render(shift(copy(), at(step), column, 1));
	for(const [name, output] of Object.entries(mutations))
		assert.throws(() => readPhpFinDispatch(output), TypeError, name);
	assert.throws(() => readPhpFinDispatch(Buffer.from(render(expected))), TypeError);
});

test("the PHP dispatch probe parses and refuses a process without the counter", { skip: !existsSync("/usr/bin/php") }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-fin-probe-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await saveLakeFile(root, "dispatch.php", phpFinDispatchProbe());
	assert.match((await runCopied("/usr/bin/php", ["-n", "-l", "dispatch.php"], root)).stdout, /^No syntax errors detected in dispatch\.php\n$/);
	const ffi = await runCopied("/usr/bin/php", ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "-r", "echo extension_loaded('FFI') ? 'ffi' : 'none';"], root).catch(() => null);
	if(ffi?.stdout !== "ffi") return t.skip("PHP FFI is unavailable");
	// The missing-root argument is never read: the counter is resolved first.
	await assert.rejects(runCopied("/usr/bin/php", ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "dispatch.php", join(root, "absent")], root)
		, error => /exited with status 2/.test(error.message) && error.details.stdout === "" && error.details.stderr === missingCounter);
});

const checkInstalledPhpFin = async (t, reviewed = false) => {
	const environment = nativeFixtureEnvironment(["c", "php-native"]), reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		const reviewedSource = reviewed ? canonicalJson(reviewedScalarHostIr()) : null;
		if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", reviewedSource);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "native-fin", version: "1.0.0" }, "php-native": { name: "lean-bridge-fixtures/native-fin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling the shared C library and Composer archive`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "php-native"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, bounds(item.refinements)])), expectedBounds);
		if(reviewed)
		{
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, reviewedSource);
			assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, sha256(reviewedSource));
		}
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
		assert.match(docs, /Checked Lean Fin bounds: \$arg0 < 10; result < 10\./);
		t.diagnostic("offline Composer installation without producer files or Lean/C compilers");
		const fixture = { source: phpFinConsumer, success: "php-fin-ok" };
		const { command, ...observation } = await installCopiedConsumer({ profile: "php-native", consumer, handoff, packages, environment, fixture });
		const root = join(consumer, "php-native"), relocated = join(consumer, "php-relocated");
		await rename(root, relocated);
		const repeated = await runCopied(command, ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "consumer.php"], relocated, copiedCleanEnvironment);
		assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout.trim(), `php-fin-ok:${observation.checks}`);
		t.diagnostic("per-step source and adapter counts in the relocated PHP process");
		const dispatch = await observePhpDispatch({ consumer, relocated, command });
		reports.push({ profile: "php-native"
			, path: reviewed ? "reviewed-ir" : "ordinary-source"
			, ...observation
			, packages
			, sharedNativeLibraries: Object.fromEntries(shared.map(name => [name, packageLibraries[name]]))
			, dispatch
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, ...(reviewed ? { reviewedSourceSha256: model.sourceIdentity.reviewedBindingIr.sourceSha256 } : {})
			, sourceRemovedBeforeInstallation: true
			, relocatedInstallation: true, repeatExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", reviewed ? "php-reviewed.json" : "php.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
};

test("relocated source-free native PHP packages check Fin bounds through the bundled C adapter", { skip: process.env.LEAN_BRIDGE_PHP_FIN_TEST !== "1", timeout: 2_400_000 }, t => checkInstalledPhpFin(t));

test("independently reviewed Php packages check scalar Fin through installed consumers", { skip: process.env.LEAN_BRIDGE_PHP_FIN_TEST !== "1", timeout: 2_400_000 }, t => checkInstalledPhpFin(t, true));
