/**
 * Check caller counters and mutation detection with explicit PHP stand-ins, not Lean execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import test from "node:test";
import { checkedRecordPhpWasmCaller, checkedRecordPhpWasmExpected } from "./checked-record-php-wasm-fixture.mjs";
import { brickMathSources } from "../../src/backends/php/brick-math.mjs";

const sources = brickMathSources();
const encoded = Buffer.from(JSON.stringify(sources)).toString("base64");
const autoload = `namespace { $brick_sources = json_decode(base64_decode('${encoded}'), true, 512, JSON_THROW_ON_ERROR);
spl_autoload_register(function ($class) use ($brick_sources) {
    $prefix = 'Brick\\\\Math\\\\';
    if (str_starts_with($class, $prefix)) {
        $path = 'src/' . str_replace('\\\\', '/', substr($class, strlen($prefix))) . '.php';
        if (isset($brick_sources[$path])) eval(substr($brick_sources[$path], 5));
    }
}); }
`;
const standins = String.raw`namespace LeanCheckedrecords {
use Brick\Math\BigInteger;
final readonly class Interval { public function __construct(public BigInteger $lo, public BigInteger $hi) {} }
final readonly class Triple { public function __construct(public array $data) {} }
final readonly class Percent { public function __construct(public BigInteger $value) {} }
class LeanBridgeError extends \Exception {}
function reject_input($bad, $position, $constructor) {
    if ($bad) throw new LeanBridgeError(DIAGNOSTIC_PREFIX . $position . ' was rejected by CheckedRecords.' . $constructor, 1);
}
function interval($value, $position) { reject_input($value->lo->isGreaterThan($value->hi), $position, 'mkInterval'); }
function triple($value, $position, $constructor = 'mkTriple') { reject_input(count($value->data) !== 3, $position, $constructor); }
function width($value) { interval($value, 0); return $value->hi->minus($value->lo); }
function span($left, $right) { interval($left, 0); interval($right, 1); return $right->hi->minus($left->lo); }
function total($value) { triple($value, 0); return array_reduce($value->data, fn($a, $b) => $a->plus($b), BigInteger::zero()); }
function first_of($value) { triple($value, 0); return $value->data[0]; }
function smallest($value) { triple($value, 0, 'sortedTriple'); $items = $value->data; usort($items, fn($a, $b) => $a->compareTo($b)); return $items[0]; }
function scale($factor, $value) { triple($value, 1); return new Triple(array_map(fn($item) => $item->multipliedBy($factor), $value->data)); }
function repeated($value) { return new Triple([$value, $value, $value]); }
function complement($value) { reject_input($value->value->isGreaterThanOrEqualTo(101), 0, 'mkPercent'); return BigInteger::of(100)->minus($value->value); }
function mutate_snapshot_control($value) { $value->nested->number++; }
}
`;

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("native PHP stand-ins verify all eight caller counters and detect nested mutation without claiming Wasm acceptance", {
	skip: !process.env.LEAN_BRIDGE_PHP && !existsSync(php) && "Select LEAN_BRIDGE_PHP for caller controls"
}, async t => {
	const measured = spawnSync(php, ["-n", "-r", "echo json_encode(['word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION]);"], { encoding: "utf8" });
	assert.equal(measured.status, 0, measured.stdout + measured.stderr);
	const runtime = JSON.parse(measured.stdout);
	let passed = 0;
	for(const route of ["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"])
		for(const mode of ["weak", "strict"])
		{
			const caller = await checkedRecordPhpWasmCaller(route, mode);
			const opening = `<?php\ndeclare(strict_types=${mode === "strict" ? 1 : 0});\n`;
			assert.ok(caller.startsWith(opening));
			const prefix = opening + autoload + standins.replaceAll("DIAGNOSTIC_PREFIX", JSON.stringify(route.endsWith("reviewed-ir") ? "value" : "arg")) + "namespace {\n";
			const code = prefix + caller.slice(opening.length) + "}\n";
			const run = spawnSync(php, ["-n"], { input: code, encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
			assert.equal(run.status, 0, run.stdout + run.stderr);
			const observation = JSON.parse(run.stdout), expected = checkedRecordPhpWasmExpected(route);
			// This control uses native PHP. Never substitute these host facts for Wasm observations.
			assert.deepEqual({ word_bits: observation.word_bits, php: observation.php }, runtime);
			const counters = value => Object.fromEntries(Object.entries(value).filter(([key]) => !["word_bits", "php"].includes(key)));
			assert.deepEqual(counters(observation), counters(expected));
			const mutation = code.replace("$low_bit =", "observe_public_call('mutate_snapshot_control', [(object)['nested' => (object)['number' => 1]]]);\n$low_bit =");
			const rejected = spawnSync(php, ["-n"], { input: mutation, encoding: "utf8" });
			assert.notEqual(rejected.status, 0); assert.match(rejected.stdout + rejected.stderr, /checked-record assertion failed/u);
			t.diagnostic(JSON.stringify({ controlOnly: true, route, mode, observation, mutationRejected: true }));
			passed++;
		}
	assert.equal(passed, 8);
	t.diagnostic(JSON.stringify({ controlOnly: true, passed, installedAcceptance: false }));
});
