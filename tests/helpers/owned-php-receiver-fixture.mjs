/**
 * PHP member syntax runs alongside independent original-owner lifetime checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** Add member calls without replacing any existing lifetime assertions. */
export const ownedPhpReceiverProbe = async () => {
	const original = await readFile("tests/fixtures/structured-types/owned-php-borrows.php", "utf8");
	const members = (await readFile("tests/fixtures/structured-types/owned-php-receivers.php", "utf8")).replace(/^<\?php\n/u, "");
	const start = "$root = ticket(); $shared = $root->share();";
	assert.equal(original.split(start).length, 2);
	return original.replace(start, members + "\nreceiver_members(); balanced();\n" + start);
};

/** Exercise the same members through only an installed Composer public API. */
export const ownedPhpInstalledReceiverProbe = async () => {
	const original = await readFile("tests/fixtures/structured-types/owned-installed-php-borrows.php", "utf8");
	let members = (await readFile("tests/fixtures/structured-types/owned-php-receivers.php", "utf8")).replace(/^<\?php\n/u, "");
	const substitutions = [
		["    global $ffi;\n", ""]
		, ['"anchor\\0🙂"', '"native\\0🙂"']
		, ["$before = $ffi->owned_test_handoffs(); ", ""]
		, ["$ffi->owned_test_handoffs() === $before + 1 && ", ""]
	];
	for(const [before, after] of substitutions)
	{
		assert.equal(members.split(before).length, 2);
		members = members.replace(before, after);
	}
	const helpers = `function owned_call(string $name, array $arguments): mixed {
    $function = strtolower(preg_replace('/(?<!^)[A-Z]/', '_$0', $name));
    return invoke($function, ...$arguments);
}
function semantic_value(mixed $value): mixed { return meaning($value); }
function bundle_value(): Value {
    $first = ticket(); $second = ticket(23);
    try { return copy_value(bundle($first->get(), $second->get())); }
    finally { dispose([$first, $second]); }
}
`;
	const start = "$root = ticket(); $alias = $root->share(); $view = invoke('retain_ticket', $root);";
	assert.equal(original.split(start).length, 2);
	const source = original.replace(start, helpers + members + "\nreceiver_members();\n" + start);
	assert.doesNotMatch(source, /Internal\\|FFI|owned_test_/u);
	return source;
};

/**
 * Plain resource members do not require result anchors or host callbacks.
 *
 * @param consuming - Include an original-owner consuming method.
 */
export const ownedPhpPlainReceiverProbe = consuming => `<?php
declare(strict_types=1);
require __DIR__ . '/probe.php';
use Brick\\Math\\BigInteger as Big;
use LeanOwnedAggregates\\{TicketValue, Value};
use LeanOwnedAggregates\\Internal\\Native;
use function LeanOwnedAggregates\\{new_ticket, copy_value};
$root = new_ticket(Big::of(42), 'plain'); $raw = $root->get();
$alias = $root->share(); $independent = $root->retainTicket();
$rawIndependent = $raw->retainTicket(); $copied = $root->serial;
foreach ([$root, $alias, $independent, $rawIndependent] as $value)
    check($value instanceof TicketValue && $value instanceof Value, 'nominal resource owner');
check((string) $copied === '42' && (string) $raw->serial === '42', 'raw and whole getters');
check($root->pingTicket === null && $raw->pingTicket === null, 'Unit properties');
$root->close(); check($root->closed() && !$alias->closed(), 'shared original owner');
reject(fn() => $root->serial, 4);
reject(fn() => $root->equals($independent), 4);
$alias->close(); reject(fn() => $raw->serial, 4);
reject(fn() => $raw->sameIdentity($independent->get()), 4);
check((string) $independent->serial === '42' && (string) $rawIndependent->serial === '42', 'independent member results');
$shared = $independent->share(); $retained = $independent->retain(); $copy = copy_value($independent);
check($shared instanceof TicketValue && $retained instanceof TicketValue && $copy instanceof TicketValue, 'nominal share retain and copy');
check($retained->equals($copy), 'independent owners retain canonical resource equality');
check($retained->get()->sameIdentity($copy->get()), 'raw resources share canonical identity');
check($retained->hashCode() === $copy->hashCode(), 'equal independent owners hash equally');
$fresh = new_ticket(Big::of(42), 'plain');
check(!$retained->equals($fresh), 'equal fields do not merge separate native identities');
${consuming ? `$moved = $independent->transferTicket();
check($independent->closed() && $shared->closed(), 'consuming member invalidates original aliases');
check($moved instanceof TicketValue && (string) $moved->serial === '42', 'typed transferred result');
$moved->close();` : `$independent->close(); check(!$shared->closed(), 'shared root survives close');`}
check((string) $retained->serial === '42' && (string) $copy->serial === '42', 'independent whole copies');
check((string) $copied === '42', 'copied property survives close');
dispose([$root, $alias, $raw, $independent, $rawIndependent, $shared, $retained, $copy, $fresh]);
unset($root, $alias, $raw, $independent, $rawIndependent, $shared, $retained, $copy, $fresh, $value);
gc_collect_cycles(); Native::close();
check($ffi->owned_test_live() === 0 && $ffi->owned_test_identities() === 0, 'no live native owners');
echo json_encode(['checks' => $checks, 'live' => $ffi->owned_test_live(), 'identities' => $ffi->owned_test_identities()]);
`;

/**
 * Keep the resource-only consumer on public Composer imports and methods.
 *
 * @param consuming - Include the consuming method in the installed probe.
 */
export const ownedPhpPlainInstalledReceiverProbe = consuming => {
	let source = ownedPhpPlainReceiverProbe(consuming);
	const helpers = String.raw`$checks = 0;
function check(bool $value, string $message = ''): void {
    global $checks; $checks++;
    if (!$value) throw new RuntimeException('Installed PHP receivers: ' . $message);
}
function reject(callable $call, int $code): void {
    try { $call(); } catch (Throwable $error) {
        check($error->getCode() === $code, $error->getMessage());
        check($error instanceof LeanOwnedAggregates\LeanBridgeError, get_class($error)); return;
    }
    throw new RuntimeException('Missing receiver lifetime rejection');
}
function dispose(array $values): void {
    foreach ($values as $value) $value->close();
}
`;
	const substitutions = [
		["require __DIR__ . '/probe.php';", "require __DIR__ . '/vendor/autoload.php';\n" + helpers]
		, ["use LeanOwnedAggregates\\Internal\\Native;\n", ""]
		, [source.slice(source.indexOf("gc_collect_cycles(); Native::close();"))
			, String.raw`gc_collect_cycles();
check(!class_exists('LeanOwnedAggregates\\WithRecovery') && !function_exists('LeanOwnedAggregates\\with_recovery'), 'callback helpers omitted');
echo json_encode(['checks' => $checks, 'ordinaryAutoload' => true, 'iniDisabled' => php_ini_loaded_file() === false]);
`]
	];
	for(const [before, after] of substitutions)
	{
		assert.equal(source.split(before).length, 2);
		source = source.replace(before, after);
	}
	assert.doesNotMatch(source, /Internal\\|FFI|owned_test_/u);
	return source;
};

export const ownedPhpRetiredIdentityProbe = String.raw`<?php
declare(strict_types=1);
require __DIR__ . '/probe.php';
use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\LeanBridgeError;
use LeanOwnedAggregates\Internal\Native;
use function LeanOwnedAggregates\new_ticket;
$left = new_ticket(Big::of(42), 'retired'); $right = $left->retain();
$rawLeft = $left->get(); $rawRight = $right->get();
$ffi->lean_bridge_native_runtime_retire();
reject(fn() => $rawLeft->sameIdentity($rawRight), 7, LeanBridgeError::class);
reject(fn() => $left->equals($right), 7, LeanBridgeError::class);
dispose([$left, $right, $rawLeft, $rawRight]);
unset($left, $right, $rawLeft, $rawRight); gc_collect_cycles(); Native::close();
check($ffi->owned_test_live() === 0 && $ffi->owned_test_identities() === 0, 'retired runtime allows complete cleanup');
echo json_encode(['checks' => $checks, 'live' => $ffi->owned_test_live(), 'identities' => $ffi->owned_test_identities()]);
`;

export const ownedPhpUnanchoredReceiverProbe = String.raw`<?php
declare(strict_types=1);
require __DIR__ . '/probe.php';
use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{TicketValue, BundleValue, Bundle, Payload, Bytes};
use LeanOwnedAggregates\Internal\Native;
use function LeanOwnedAggregates\{new_ticket, copy_value};
$ticket = new_ticket(Big::of(42), 'unanchored'); $independent = $ticket->retainTicket();
$record = copy_value(new Bundle($ticket->get(), null, [], [], new Payload(Big::of(7), Bytes::fromString('payload'))));
check($record instanceof BundleValue && $independent instanceof TicketValue, 'unanchored nominal owners');
$primary = $record->primary; check($primary instanceof TicketValue, 'unanchored property result');
$escaped = null;
$reply = $record->callbackRecord(static function($value) use (&$escaped) { $escaped = $value; return $value; });
check($reply instanceof BundleValue, 'unanchored callback result');
check($reply->equals($record), 'unanchored callback preserves canonical identity equality');
check($reply->hashCode() === $record->hashCode(), 'unanchored callback preserves equal hashes');
reject(fn() => $escaped->primary->serial, 4);
$closure = $record->makeRecord();
$record->close(); $ticket->close();
check((string) $primary->serial === '42' && (string) $independent->serial === '42', 'independent member results survive source close');
check((string) $reply->get()->primary->serial === '42', 'callback output owns its identities');
$out = $closure(true, $reply->get());
check($out instanceof BundleValue && (string) $out->primary->serial === '42', 'unanchored closure owns captured value');
$alias = $independent->share(); $moved = $independent->transferTicket();
check($independent->closed() && $alias->closed(), 'unanchored receiver consumption');
check($moved instanceof TicketValue && (string) $moved->serial === '42', 'nominal transferred result');
dispose([$ticket, $record, $independent, $primary, $escaped, $reply, $closure, $out, $alias, $moved]);
unset($ticket, $record, $independent, $primary, $escaped, $reply, $closure, $out, $alias, $moved);
gc_collect_cycles(); Native::close();
check($ffi->owned_test_live() === 0 && $ffi->owned_test_identities() === 0, 'no surviving native owners');
echo json_encode(['checks' => $checks, 'live' => $ffi->owned_test_live(), 'identities' => $ffi->owned_test_identities()]);
`;
