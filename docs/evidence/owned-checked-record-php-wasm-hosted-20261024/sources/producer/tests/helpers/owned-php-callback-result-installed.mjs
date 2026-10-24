/**
 * Adapt original callback assertions to public-only installed Composer consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Exact authored public assertions and ABI scope, not inferred from observations.
 *
 * @param variant - Required capability shape.
 * @param version - Independently queried installed PHP version.
 */
export const expectedOwnedPhpInstalledCallback = (variant, version) => {
	assert.ok(["no-host", "host", "combined"].includes(variant));
	const phases = { surface: 12, native: 65, nativeOrder: 4
		, ...variant === "no-host" ? { noHost: 20 } : { host: 33, hostOrder: 12 }
		, ...variant === "combined" ? { combined: 42, transferOrder: 20 } : {} };
	return { checks: Object.values(phases).reduce((sum, count) => sum + count, 1)
		, phases, variant, actualLean: true, installedPackage: true
		, ordinaryAutoload: true, iniDisabled: true, phpVersion: version
		, phpIntSize: 8, phpZts: false, phpSapi: "cli", phpOs: "Linux"
		, machine: "x86_64", ffi: true };
};

/** Preserve callback assertions while removing unpackaged instrumentation. */
export const ownedPhpInstalledCallbackProbe = async () => {
	let source = await readFile("tests/fixtures/structured-types/owned-php-callback-results.php", "utf8");
	const replace = (before, after, count = 1) => {
		assert.equal(source.split(before).length - 1, count, before);
		source = source.replaceAll(before, after);
	};
	const helpers = String.raw`
$checks = 0;
function check(bool $value, string $message = ''): void {
    global $checks; $checks++;
    if (!$value) throw new RuntimeException('Installed PHP callback result: ' . $message);
}
function owned_call(string $name, array $arguments): mixed {
    $public = strtolower(preg_replace('/(?<!^)[A-Z]/', '_$0', $name));
    $function = 'LeanOwnedAggregates\\' . $public;
    return $function(...$arguments);
}
function reject(callable $call, ?int $code = null): Throwable {
    try { $call(); } catch (Throwable $error) {
        check($code === null || $error->getCode() === $code, $error->getMessage());
        check($code === null || $error instanceof LeanOwnedAggregates\LeanBridgeError, get_class($error));
        return $error;
    }
    throw new RuntimeException('Missing installed callback result rejection');
}
function dispose(mixed $value): void {
    $stack = [$value]; $seen = new SplObjectStorage();
    while ($stack) {
        $item = array_pop($stack);
        if (is_object($item)) {
            if ($seen->contains($item)) continue;
            $seen->attach($item);
            if (method_exists($item, 'close')) { $item->close(); continue; }
            $item = get_object_vars($item);
        }
        if (is_array($item)) foreach ($item as $child) $stack[] = $child;
    }
}
`;
	replace("require __DIR__ . '/probe.php';", "require __DIR__ . '/vendor/autoload.php';\n" + helpers);
	replace("use LeanOwnedAggregates\\Internal\\Native;\n", "");
	replace(`function balanced(array $baseline, string $message): void {
    global $ffi;
    gc_collect_cycles();
    check([$ffi->owned_test_live(), $ffi->owned_test_identities()] === $baseline, $message . ' native cleanup');
}
`, "");
	replace("    global $ffi;\n", "");
	replace("$before = $ffi->owned_test_handoffs();", "", 3);
	replace("        check($ffi->owned_test_handoffs() === $before + 1, 'mixed callback receiver handed off exactly once');\n", "");
	replace("    check($ffi->owned_test_handoffs() === $before + 1, 'post-handoff failure recorded actual native handoff');\n", "");
	replace(" && $ffi->owned_test_handoffs() === $before", "");
	replace("'expired recovery skips callback and handoff'", "'expired recovery skips callback'");
	replace("$baseline = [$ffi->owned_test_live(), $ffi->owned_test_identities()]; $phases = [];", "$phases = [];");
	for(const phase of ["native", "host", "combined"]) replace(`balanced($baseline, '${phase} callbacks'); `, "");
	replace("gc_collect_cycles(); Native::close();", "gc_collect_cycles();");
	replace("check($ffi->owned_test_live() === 0 && $ffi->owned_test_identities() === 0, 'final native allocation and broker identity counters are zero');\n", "");
	replace("'actualLean' => true, 'installedPackage' => false, 'live' => $ffi->owned_test_live(), 'identities' => $ffi->owned_test_identities(),", "'actualLean' => true, 'installedPackage' => true, 'ordinaryAutoload' => true, 'iniDisabled' => php_ini_loaded_file() === false,");
	const additions = String.raw`
function callback_surface(Bundle $raw, string $variant): void {
    $host = $variant !== 'no-host'; $combined = $variant === 'combined';
    check(function_exists('LeanOwnedAggregates\\with_recovery') === $host, 'recovery function surface');
    check(class_exists('LeanOwnedAggregates\\WithRecovery') === $host, 'recovery class surface');
    foreach (['borrow_record', 'move_record', 'move_twice'] as $name)
        check(function_exists('LeanOwnedAggregates\\' . $name) === $combined, 'optional export surface ' . $name);
    $record = owned_call('echoRecord', [$raw]);
    foreach (['borrowRecord', 'moveRecord', 'moveTwice'] as $name)
        check(method_exists($record, $name) === $combined, 'optional receiver surface ' . $name);
    $native = owned_call('makeRecordCallback', [$raw]); $closure = $native->get();
    foreach ([$native, $closure] as $value) foreach (['copyArg', 'copyResult'] as $name)
        check(method_exists($value, $name), 'authenticated callback factory surface ' . $name);
    dispose([$record, $native, $closure]);
}
function no_host_cases(Bundle $raw): void {
    $calls = 0;
    $host = static function($value) use (&$calls) { $calls++; return $value; };
    $native = owned_call('makeRecordCallback', [$raw]); $closure = $native->get();
    $dispatch = owned_call('dispatch', [$raw]);
    foreach ([
        fn() => owned_call('callbackRecord', [$raw, $host]),
        fn() => owned_call('applyTwice', [$raw, $closure, $host]),
        fn() => owned_call('applyTwice', [$raw, $host, $native]),
        fn() => $dispatch($host)
    ] as $attempt) {
        $error = reject($attempt);
        check($error instanceof TypeError, 'no-host callback admission rejects with TypeError');
        check($calls === 0, 'no-host callable never entered');
    }
    $recovery = 'LeanOwnedAggregates\\with_recovery';
    $error = reject(fn() => $recovery($host, $raw));
    check(get_class($error) === Error::class && $error->getMessage() === 'Call to undefined function LeanOwnedAggregates\\with_recovery()',
        'no-host recovery wrapper is not exported');
    check($calls === 0, 'absent recovery wrapper never enters callable');
    dispose([$native, $closure, $dispatch]);
}
function counted_record(Bundle $raw, mixed $count): Bundle {
    return new Bundle($raw->primary, $raw->spare, $raw->peers, $raw->history,
        new Payload(Big::of($count), $raw->payload->bytes));
}
function native_order_cases(Bundle $raw): void {
    $left = owned_call('makeRecordCallback', [counted_record($raw, 10)]);
    $right = owned_call('makeRecordCallback', [counted_record($raw, 20)]);
    foreach ([[$left->get(), $right, '20'], [$right->get(), $left, '10']] as [$first, $second, $expected]) {
        $out = owned_call('applyTwice', [$raw, $first, $second]);
        check((string) $out->get()->payload->count === $expected, 'noncommuting native callback order');
        check((string) owned_call('serial', [$out->get()->primary]) === '63', 'ordered native callback preserves resource');
        $out->close();
    }
    dispose([$left, $right]);
}
function host_order_cases(Bundle $raw, bool $consuming): void {
    $trace = [];
    $double = static function($value) use (&$trace) {
        $trace[] = ['double', (string) $value->payload->count];
        return counted_record($value, $value->payload->count->multipliedBy(2)->plus(1));
    };
    $triple = static function($value) use (&$trace) {
        $trace[] = ['triple', (string) $value->payload->count];
        return counted_record($value, $value->payload->count->multipliedBy(3)->plus(4));
    };
    $native = owned_call('makeRecordCallback', [counted_record($raw, 10)]);
    foreach ([
        [$double, $triple, '-95', [['double', '-17'], ['triple', '-33']]],
        [$triple, $double, '-93', [['triple', '-17'], ['double', '-47']]],
        [$native->get(), $triple, '34', [['triple', '10']]],
        [$triple, $native, '10', [['triple', '-17']]]
    ] as [$left, $right, $expected, $expectedTrace]) {
        $trace = []; $receiver = null; $alias = null; $retained = null;
        if ($consuming) {
            $receiver = owned_call('echoRecord', [$raw]); $alias = $receiver->share(); $retained = $receiver->retain();
            $out = $receiver->moveTwice($left, $right);
            check($receiver->closed() && $alias->closed(), 'ordered callbacks consume original receiver aliases');
            check((string) $retained->get()->payload->count === '-17', 'ordered consuming callbacks preserve independent retain');
        } else $out = owned_call('applyTwice', [$raw, $left, $right]);
        check((string) $out->get()->payload->count === $expected, 'noncommuting host/native callback result');
        check($trace === $expectedTrace, 'exact host callback order, invocation count and input sequence');
        check((string) owned_call('serial', [$out->get()->primary]) === '63', 'ordered callbacks preserve native resource');
        dispose([$receiver, $alias, $retained, $out]);
    }
    $native->close();
}

`;
	replace("$variant = $argv[1] ?? '';", additions + "$variant = $argv[1] ?? '';");
	replace("$phases = [];", "$phases = [];\n$start = $checks; callback_surface($raw, $variant); $phases['surface'] = $checks - $start;");
	replace("if ($variant !== 'no-host') {", String.raw`$start = $checks; native_order_cases($raw); $phases['nativeOrder'] = $checks - $start;
if ($variant === 'no-host') {
    $start = $checks; no_host_cases($raw); $phases['noHost'] = $checks - $start;
}
if ($variant !== 'no-host') {`);
	replace("$phases['host'] = $checks - $start;", "$phases['host'] = $checks - $start;\n    $start = $checks; host_order_cases($raw, false); $phases['hostOrder'] = $checks - $start;");
	replace("$phases['combined'] = $checks - $start;", "$phases['combined'] = $checks - $start;\n    $start = $checks; host_order_cases($raw, true); $phases['transferOrder'] = $checks - $start;");
	assert.doesNotMatch(source, /Internal\\|\bFFI::|owned_test_|\$ffi|\$before|\$baseline/u);
	return source;
};
