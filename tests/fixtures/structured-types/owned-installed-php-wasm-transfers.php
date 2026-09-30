<?php
declare(strict_types=1);

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bytes, Some, Ok, Err, Ticket, Payload, Bundle, TreeLeaf, TreeBranch,
    ChoiceEmpty, ChoiceOne, ChoicePair, ChoiceMany, ChainStop, ChainLink, Mixed_, LeanBridgeError};

$checks = 0; $functions = [];
function check(bool $value, string $message = ''): void {
    global $checks; $checks++;
    if (!$value) throw new RuntimeException('Installed PHP-Wasm transfers: ' . $message);
}
function invoke(string $name, mixed ...$arguments): mixed {
    global $functions; $functions[$name] = true;
    $function = 'LeanOwnedAggregates\\' . $name;
    return $function(...$arguments);
}
function reject(callable $call, ?int $code = null, ?string $class = null): Throwable {
    try { $call(); }
    catch (Throwable $error) {
        check($code === null || $error->getCode() === $code, $error->getMessage());
        check($class === null || $error instanceof $class, get_class($error)); return $error;
    }
    throw new RuntimeException('Missing installed transfer rejection');
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
    if (is_float($value)) return ['float', is_nan($value) ? 'nan' : pack('e', $value)];
    if (is_object($value)) return [$value::class, array_map(meaning(...), get_object_vars($value))];
    return is_array($value) ? array_map(meaning(...), $value) : $value;
}
function consumed(mixed $value): void {
    if ($value instanceof Ticket) { reject(fn() => invoke('serial', $value), 4, LeanBridgeError::class); return; }
    if ($value instanceof Big || $value instanceof Bytes) return;
    if (is_object($value)) $value = get_object_vars($value);
    if (is_array($value)) foreach ($value as $child) consumed($child);
}
function ticket(int $number = 17): Ticket { return invoke('new_ticket', Big::of($number), "wasm\0🙂"); }
function payload(): Payload { return new Payload(Big::of(-9), Bytes::fromString("\0\x7f\x80\xff")); }
function bundle(): Bundle {
    $first = ticket(); $second = ticket(23);
    return new Bundle($first, new Some($second), [$first, $second], [$second], payload());
}
function chain(int $depth = 30): ChainStop|ChainLink {
    $value = new ChainStop();
    for ($index = 0; $index < $depth; $index++) $value = new ChainLink(ticket($index), new Some($value));
    return $value;
}
function mixed_value(bool $error): Mixed_ {
    return new Mixed_(ticket(), [null, new Some(null), new Some(new Some(false)), new Some(new Some(true))],
        new Some(null), $error ? new Err(ticket(31)) : new Ok(bundle()),
        Big::of(2)->power(180)->negated(), Big::of(2)->power(200), '🙂', -0.0, 1.5,
        Bytes::fromString("\0\x7f\x80\xff"), [Big::of(0), Big::of('18446744073709551615')],
        [ticket(), [new Some(ticket(32)), payload()]], chain(3));
}

reject(fn() => invoke('new_ticket', 42, 'invalid'), null, TypeError::class);
reject(fn() => invoke('transfer_callback', fn($value) => $value), null, TypeError::class);
$first = ticket(); $alias = $first; $kept = $first->retain(); $result = invoke('retain_ticket', $first);
consumed($alias); check((string) invoke('serial', $kept) === '17'); check(meaning($result) === meaning($kept));
dispose([$first, $kept, $result]); unset($first, $alias, $kept, $result);

foreach ([['echo_array', fn() => [ticket(), ticket(2)]], ['echo_array', fn() => []],
    ['echo_list', fn() => [ticket(), ticket(3)]], ['echo_list', fn() => []],
    ['echo_option', fn() => new Some(ticket())], ['echo_option', fn() => null],
    ['echo_result', fn() => new Ok(bundle())], ['echo_result', fn() => new Err(ticket())],
    ['echo_record', fn() => bundle()], ['echo_alias', fn() => bundle()],
    ['echo_tuple', fn() => [ticket(), [new Some(ticket(2)), payload()]]],
    ['echo_variant', fn() => new ChoiceEmpty()], ['echo_variant', fn() => new ChoiceOne(ticket())],
    ['echo_variant', fn() => new ChoicePair(ticket(), ticket(2))], ['echo_variant', fn() => new ChoiceMany([ticket(), ticket(3)])],
    ['echo_row', fn() => [null, new Some(ticket())]],
    ['echo_recursive', fn() => new TreeBranch([new TreeLeaf(ticket()), new TreeBranch([])])],
    ['echo_nested', fn() => [[null, new Some(new Ok(bundle())), new Some(new Err(ticket()))], []]],
    ['echo_chain', fn() => chain()], ['echo_mixed', fn() => mixed_value(false)], ['echo_mixed', fn() => mixed_value(true)]] as [$name, $make]) {
    $input = $make(); $expected = meaning($input); $result = invoke($name, $input);
    consumed($input); check(meaning($result) === $expected, $name);
    dispose([$input, $result]); unset($input, $result);
}

$first = ticket();
reject(fn() => invoke('bundle', $first, null, [$first], [], payload()), null, TypeError::class);
check((string) invoke('serial', $first) === '17');
$second = ticket(29); $result = invoke('bundle', $first, null, [$second], [], payload());
consumed([$first, $second]); $primary = invoke('primary', $result);
check((string) invoke('serial', $primary) === '17'); check(meaning(invoke('payload', $result)) === meaning(payload()));
$sibling = $result->peers[0]; $moved = invoke('retain_ticket', $result->primary);
consumed($sibling); check((string) invoke('serial', $primary) === '17', 'borrowed projection owns an independent result');
dispose([$first, $second, $result, $primary, $moved]); unset($first, $second, $result, $primary, $sibling, $moved);

$input = bundle(); $kept = $input->primary->retain(); $escaped = null;
reject(fn() => invoke('callback_record', $input, 42), null, TypeError::class);
check((string) invoke('serial', $input->primary) === '17'); $expected = meaning($input);
$result = invoke('callback_record', $input, static function($value) use ($input, &$escaped) {
    consumed($input); $escaped = $value->primary;
    reject(fn() => invoke('echo_record', $value), null, TypeError::class);
    $copy = $value->primary->retain(); $moved = invoke('retain_ticket', $copy);
    consumed($copy); check((string) invoke('serial', $moved) === '17'); $moved->close(); return $value;
});
check(meaning($result) === $expected); consumed([$input, $escaped]); check((string) invoke('serial', $kept) === '17');
dispose([$input, $result, $kept]); unset($input, $result, $kept, $escaped);
$sentinel = new RuntimeException('original installed callback error'); $input = bundle();
$held = reject(fn() => invoke('callback_record', $input, static function($value) use ($sentinel) { throw $sentinel; }));
check($held === $sentinel); consumed($input); dispose($input); unset($input);

$input = new TreeBranch([new TreeLeaf(ticket()), new TreeBranch([])]); $expected = meaning($input);
$result = invoke('callback_recursive', $input, fn($value) => $value);
consumed($input); check(meaning($result) === $expected); dispose([$input, $result]); unset($input, $result);
foreach (['make_record' => fn() => bundle(), 'make_recursive' => fn() => new TreeLeaf(ticket())] as $name => $make) {
    $input = $make(); $expected = meaning($input); $closure = invoke($name, $input); consumed($input);
    $supplied = $make(); $result = $closure(true, $supplied); check(meaning($result) === $expected);
    dispose($result); $result = $closure(false, $supplied); check(meaning($result) === meaning($supplied));
    dispose([$input, $result, $closure, $supplied]); unset($input, $result, $closure, $supplied);
}
$closure = invoke('new_record_callback'); $alias = $closure; $kept = $closure->retain();
$moved = invoke('transfer_callback', $closure); $input = bundle();
reject(fn() => $alias($input), 4, LeanBridgeError::class);
foreach ([$kept, $moved] as $call) {
    $result = $call($input); check(meaning($result) === meaning($input)); dispose($result);
}
dispose([$input, $kept, $moved, $closure]); unset($input, $kept, $moved, $closure, $alias, $result, $call);
gc_collect_cycles();
$names = array_keys($functions); sort($names);
echo json_encode(['checks' => $checks, 'functions' => $names, 'heldOriginalError' => $held === $sentinel,
    'ordinaryAutoload' => true, 'phpBits' => PHP_INT_SIZE * 8], JSON_THROW_ON_ERROR), "\n";
