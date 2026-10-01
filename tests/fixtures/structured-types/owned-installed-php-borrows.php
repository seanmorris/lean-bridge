<?php
declare(strict_types=1);
require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bytes, Some, Ok, Err, Ticket, Payload, Bundle, TreeLeaf, TreeBranch,
    ChoiceEmpty, ChoiceOne, ChoicePair, ChoiceMany, Value, LeanBridgeError};
use function LeanOwnedAggregates\copy_value;

$checks = 0; $functions = [];
function check(bool $value, string $message = ''): void {
    global $checks; $checks++;
    if (!$value) throw new RuntimeException('Installed PHP borrows: ' . $message);
}
function invoke(string $name, mixed ...$arguments): mixed {
    global $functions; $functions[$name] = true;
    $function = 'LeanOwnedAggregates\\' . $name; return $function(...$arguments);
}
function reject(callable $call, ?int $code = null, ?string $class = null): Throwable {
    try { $call(); } catch (Throwable $error) {
        check($code === null || $error->getCode() === $code, $error->getMessage());
        check($class === null || $error instanceof $class, get_class($error)); return $error;
    }
    throw new RuntimeException('Missing installed borrow rejection');
}
function dispose(mixed $value): void {
    if ($value instanceof Big || $value instanceof Bytes) return;
    if (is_object($value)) {
        if (method_exists($value, 'close')) { $value->close(); return; }
        $value = get_object_vars($value);
    }
    if (is_array($value)) foreach ($value as $child) dispose($child);
}
function meaning(mixed $value): mixed {
    if ($value instanceof Ticket) return ['ticket', (string) invoke('serial', $value), invoke('label', $value)];
    if ($value instanceof Big) return ['integer', (string) $value];
    if ($value instanceof Bytes) return ['bytes', $value->toString()];
    if (is_object($value)) return [$value::class, array_map(meaning(...), get_object_vars($value))];
    return is_array($value) ? array_map(meaning(...), $value) : $value;
}
function ticket(int $number = 17): Value { return invoke('new_ticket', Big::of($number), "native\0🙂"); }
function payload(): Payload { return new Payload(Big::of(-9), Bytes::fromString("\0\x7f\x80\xff")); }
function bundle(Ticket $first, Ticket $second): Bundle {
    return new Bundle($first, new Some($second), [$first, $second], [$second], payload());
}

reject(fn() => invoke('new_ticket', 42, 'invalid'), null, TypeError::class);
reject(fn() => copy_value([]), null, TypeError::class);
reject(fn() => copy_value([], resultOf: 'serial'), null, TypeError::class);
reject(fn() => copy_value([], resultOf: 1), null, TypeError::class);
reject(fn() => copy_value([], parameterOf: 'echo_array'), null, TypeError::class);
reject(fn() => copy_value([], null, null, 'extra'), null, ArgumentCountError::class);
reject(fn() => copy_value([], resultOf: new class implements Stringable {
    public function __toString(): string { throw new RuntimeException('Selectors must not invoke user coercion'); }
}), null, TypeError::class);
$root = ticket(); $alias = $root->share(); $view = invoke('retain_ticket', $root);
$child = invoke('retain_ticket', $view); $kept = $view->retain(); $raw = $view->get();
check($raw->sameIdentity($root->get()) && $view->equals($kept), 'canonical identities');
check($view->hashCode() === $kept->hashCode(), 'equal values hash equally');
$root->close(); check(!$view->closed()); $alias->close();
check($view->closed() && $child->closed(), 'last shared root expires descendants');
reject(fn() => $view->get(), 4, LeanBridgeError::class);
reject(fn() => invoke('serial', $raw), 4, LeanBridgeError::class);
check((string) invoke('serial', $kept->get()) === '17');
dispose([$root, $alias, $view, $child, $kept, $raw]); unset($root, $alias, $view, $child, $kept, $raw);

foreach ([
    ['echo_array', fn($a, $b) => [$a, $b]], ['echo_array', fn($a, $b) => []],
    ['echo_list', fn($a, $b) => [$a, $b]], ['echo_list', fn($a, $b) => []],
    ['echo_option', fn($a, $b) => new Some($a)], ['echo_option', fn($a, $b) => null],
    ['echo_result', fn($a, $b) => new Ok(bundle($a, $b))], ['echo_result', fn($a, $b) => new Err($b)],
    ['echo_record', fn($a, $b) => bundle($a, $b)], ['echo_alias', fn($a, $b) => bundle($a, $b)],
    ['echo_tuple', fn($a, $b) => [$a, [new Some($b), payload()]]],
    ['echo_variant', fn($a, $b) => new ChoiceEmpty()], ['echo_variant', fn($a, $b) => new ChoiceOne($a)],
    ['echo_variant', fn($a, $b) => new ChoicePair($a, $b)], ['echo_variant', fn($a, $b) => new ChoiceMany([$a, $b])],
    ['echo_row', fn($a, $b) => [null, new Some($a)]], ['echo_row', fn($a, $b) => []],
    ['echo_recursive', fn($a, $b) => new TreeBranch([new TreeLeaf($a), new TreeBranch([new TreeLeaf($b)])])],
    ['echo_recursive', fn($a, $b) => new TreeBranch([])],
    ['echo_nested', fn($a, $b) => [[null, new Some(new Ok(bundle($a, $b))), new Some(new Err($b))], []]],
    ['echo_nested', fn($a, $b) => [[], [null]]]
] as [$name, $make]) {
    $a = ticket(); $b = ticket(23); $input = $make($a->get(), $b->get()); $expected = meaning($input);
    $root = copy_value($input, resultOf: $name); dispose([$a, $b]); unset($a, $b, $input);
    $view = invoke($name, $root); $child = invoke($name, $view); $kept = $view->retain();
    check(meaning($child->get()) === $expected, $name . ' preserves typed values');
    check($root->equals($view) && $view->hashCode() === $kept->hashCode(), $name . ' equality');
    $view->close(); check(!$root->closed() && $child->closed(), $name . ' transitive lifetime');
    reject(fn() => $root->equals($child), 4, LeanBridgeError::class);
    $root->close(); check(meaning($kept->get()) === $expected, $name . ' independent ownership');
    dispose([$root, $view, $child, $kept]); unset($root, $view, $child, $kept);
}

$first = ticket(); $anchor = copy_value([], parameterOf: ['bundle', 2]);
$record = invoke('bundle', $first->get(), null, $anchor, [], payload()); $primary = invoke('primary', $record);
check(meaning(invoke('payload', $record->get())) === meaning(payload()));
$first->close(); check((string) invoke('serial', $primary->get()) === '17', 'nonfirst anchor');
$anchor->close(); check($record->closed() && $primary->closed());
dispose([$first, $anchor, $record, $primary]); unset($first, $anchor, $record, $primary);

$first = ticket(); $second = ticket(23); $owner = copy_value(bundle($first->get(), $second->get()));
$escaped = null; $callbackKept = null;
$view = invoke('callback_record', $owner, static function($value) use (&$escaped, &$callbackKept) {
    $escaped = $value; $callbackKept = copy_value($value); return $value;
});
reject(fn() => invoke('serial', $escaped->primary), 4, LeanBridgeError::class);
$closure = invoke('make_record', $owner); $retainedClosure = $closure->retain();
$out = $closure(true, $owner->get()); check($out->equals($owner));
$owner->close(); check($view->closed() && $closure->closed());
$retainedOut = $retainedClosure(true, $callbackKept->get()); check($retainedOut->equals($callbackKept));
dispose([$first, $second, $owner, $view, $escaped, $callbackKept, $closure, $retainedClosure, $out, $retainedOut]);
unset($first, $second, $owner, $view, $escaped, $callbackKept, $closure, $retainedClosure, $out, $retainedOut);

$first = ticket(); $tree = copy_value(new TreeLeaf($first->get()));
$view = invoke('callback_recursive', $tree, fn($value) => $value); $closure = invoke('make_recursive', $tree);
$out = $closure(true, new TreeBranch([])); check($view->equals($out));
$tree->close(); check($view->closed() && $closure->closed());
dispose([$first, $tree, $view, $closure, $out]); unset($first, $tree, $view, $closure, $out);

$root = ticket(); $view = invoke('retain_ticket', $root); $kept = $root->retain();
reject(fn() => invoke('transfer_ticket', $view), 1, LeanBridgeError::class);
$moved = invoke('transfer_ticket', $root); check($root->closed() && $view->closed());
check($moved->get()->sameIdentity($kept->get()));
dispose([$root, $view, $kept, $moved]); unset($root, $view, $kept, $moved);
$anchor = ticket(); $root = ticket(31); $view = invoke('mixed_ticket', $anchor, $root);
check($root->closed() && !$anchor->closed()); check((string) invoke('serial', $view->get()) === '31');
$anchor->close(); check($view->closed()); dispose([$anchor, $root, $view]); unset($anchor, $root, $view);
$root = copy_value([], resultOf: 'echo_array'); $view = invoke('echo_array', $root); $moved = invoke('move_array', $root);
check($root->closed() && $view->closed() && $moved->get() === []);
dispose([$root, $view, $moved]); unset($root, $view, $moved);

$first = ticket(); $owner = copy_value(bundle($first->get(), $first->get())); $view = invoke('echo_record', $owner);
$moved = null;
reject(static function() use ($owner, &$moved): void {
    invoke('callback_record', $owner, static function($value) use ($owner, &$moved) {
        $moved = invoke('move_record', $owner, static function($inner) use ($owner) { check($owner->closed()); return $inner; });
        return $value;
    });
}, 4, LeanBridgeError::class);
check($owner->closed() && $view->closed()); check((string) invoke('serial', $moved->get()->primary) === '17');
$sentinel = new RuntimeException('original installed anchored callback failure');
$held = reject(fn() => invoke('move_record', $moved, static function($value) use ($sentinel) { throw $sentinel; }));
check($held === $sentinel && $moved->closed());
dispose([$first, $owner, $view, $moved]); unset($first, $owner, $view, $moved);

$root = copy_value([], resultOf: 'echo_array'); $view = invoke('echo_array', $root);
unset($root); gc_collect_cycles(); check($view->closed(), 'implicit finalization expires empty views');
dispose($view); unset($view); gc_collect_cycles();
$names = array_keys($functions); sort($names);
echo json_encode(['checks' => $checks, 'functions' => $names, 'heldOriginalError' => $held === $sentinel,
    'ordinaryAutoload' => true, 'iniDisabled' => php_ini_loaded_file() === false], JSON_THROW_ON_ERROR), "\n";
