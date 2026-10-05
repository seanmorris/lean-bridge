<?php
declare(strict_types=0);
require __DIR__ . '/dependencies/brick-math/autoload.php';
require __DIR__ . '/src/Api.php';
require __DIR__ . '/transport.php';

use Brick\Math\BigInteger as Big;
use LeanStructured\{TreeLeaf,TreeBranch,Payload,PacketEmpty,PacketPayload,PacketCounts,Some,Ok,Err,Bytes,LeanClosure};

$checks = 0;
function check(bool $value): void {
    global $checks;
    if (!$value) throw new RuntimeException('PHP wrapper assertion ' . ($checks + 1)
        . ' ' . json_encode($GLOBALS['faultContext'] ?? []));
    ++$checks;
}
function reject(string $kind, Closure $operation): Throwable {
    try { $operation(); }
    catch (Throwable $error) { check($error instanceof $kind); return $error; }
    throw new RuntimeException('Expected ' . $kind);
}
function equal(mixed $left, mixed $right): bool {
    if (get_debug_type($left) !== get_debug_type($right)) return false;
    if ($left instanceof Big) return $left->isEqualTo($right);
    if ($left instanceof Bytes) return $left->toString() === $right->toString();
    if (is_object($left)) return equal(get_object_vars($left), get_object_vars($right));
    if (is_array($left)) {
        if (array_keys($left) !== array_keys($right)) return false;
        foreach ($left as $index => $value) if (!equal($value, $right[$index])) return false;
        return true;
    }
    return $left === $right;
}
function values(int $seed): array {
    $big = Big::of(2)->power(150 + $seed)->plus($seed);
    $payload = new Payload("text\0🌱" . $seed, [null, new Some('')], $big,
        new Some(new Ok([Big::of('18446744073709551615'), null])));
    $tree = new TreeLeaf($big);
    for ($depth = 0; $depth < 24; ++$depth) $tree = new TreeBranch([$tree]);
    return [$seed % 2 ? [] : [null, new Some("leaf\0🌱" . $seed)],
        $seed % 2 ? [] : [new Ok([Big::of('4294967295'), 'list' . $seed]), new Err('error' . $seed)],
        match ($seed % 3) { 0 => null, 1 => new Some(null), 2 => new Some(new Some(null)) },
        $seed % 2 ? new Err(["error\0" . $seed]) : new Ok(new Some(Big::of('4294967295'))),
        ['tuple' . $seed, [Bytes::fromString("\x00\xff" . chr($seed)), $big]], $payload,
        match ($seed % 3) { 0 => new PacketEmpty(), 1 => new PacketPayload('packet' . $seed, [new Some('row')]),
            2 => new PacketCounts($big, $big->negated()) },
        $payload, $seed % 2 ? new TreeBranch([]) : $tree];
}

$shapes = ['array', 'list', 'option', 'result', 'tuple', 'record', 'variant', 'alias', 'recursive'];
for ($seed = 0; $seed < 4; ++$seed) {
    $inputs = values($seed); $outputs = values($seed + 1);
    foreach ($shapes as $index => $shape) {
        $call = 'LeanStructured\\call_' . $shape; $twice = 'LeanStructured\\twice_' . $shape;
        $make = 'LeanStructured\\make_' . $shape; $input = $inputs[$index]; $reply = $outputs[$index];
        $seen = []; $callback = static function($value) use (&$seen, $reply) { $seen[] = $value; gc_collect_cycles(); return $reply; };
        check(equal($call($input, $callback), $reply)); check(count($seen) === 1 && equal($seen[0], $input));
        $seen = []; check(equal($twice($input, $callback), $reply));
        check(count($seen) === 2 && equal($seen[0], $input) && equal($seen[1], $reply));
        $error = new Error('Exact callback exception');
        check(reject(Error::class, fn() => $call($input, static function() use ($error) { throw $error; })) === $error);
        reject(TypeError::class, fn() => $call($input, fn() => new stdClass()));
        $lease = $make($input); check($lease instanceof LeanClosure && !$lease->isClosed());
        check(equal($lease(true, $reply), $input)); check(equal($lease(false, $reply), $reply));
        reject(TypeError::class, fn() => $lease(1, $reply)); reject(ArgumentCountError::class, fn() => $lease(true));
        reject(LogicException::class, fn() => serialize($lease)); reject(Error::class, fn() => clone $lease);
        $beforeClose = $GLOBALS['closed']; $lease->close(); $lease->close(); unset($lease); gc_collect_cycles();
        check($GLOBALS['closed'] === $beforeClose + 1);
        check(equal($call($input, fn($value) => $value), $input));
    }
}
$tree = new TreeLeaf(Big::of(7));
foreach ([false, static function($value) { yield $value; }, static function(&$value) { return $value; },
    static function &($value) { return $value; }] as $bad)
    reject(TypeError::class, fn() => LeanStructured\call_recursive($tree, $bad));
$error = new RuntimeException('First failure'); $count = 0;
$throws = static function() use ($error, &$count) { ++$count; throw $error; };
check(reject(RuntimeException::class, fn() => LeanStructured\twice_recursive($tree, $throws)) === $error);
check($count === 1);
$expired = $GLOBALS['lastCallback']; reject(LogicException::class, fn() => $expired([0, ['7']]));
$lease = LeanStructured\make_recursive($tree); $beforeClose = $GLOBALS['closed'];
$GLOBALS['duringInvoke'] = static function() use ($lease, $beforeClose): void {
    $lease->close(); $lease->close(); check($lease->isClosed()); check($GLOBALS['closed'] === $beforeClose);
};
check(equal($lease(true, $tree), $tree)); check($GLOBALS['closed'] === $beforeClose + 1);
unset($GLOBALS['duringInvoke']); reject(LogicException::class, fn() => $lease(true, $tree));
$beforeClose = $GLOBALS['closed']; $abandoned = LeanStructured\make_recursive($tree); unset($abandoned); gc_collect_cycles();
check($GLOBALS['closed'] === $beforeClose + 1);
$fiber = new Fiber(fn() => LeanStructured\call_recursive($tree, fn($value) => $value));
reject(LogicException::class, fn() => $fiber->start());
$recurse = static function($value, int $depth) use (&$recurse) {
    return $depth === 0 ? $value : LeanStructured\call_recursive($value, static fn($inner) => $recurse($inner, $depth - 1));
};
check(equal($recurse($tree, 8), $tree)); reject(OverflowException::class, fn() => $recurse($tree, 80));
check(equal($recurse($tree, 8), $tree));
$GLOBALS['malformed'] = true;
check(reject(LeanStructured\LeanBridgeError::class, fn() => LeanStructured\call_recursive($tree, fn($value) => $value))->getCode() === 4);
check($GLOBALS['retired'] === 1);
echo json_encode(['checks' => $checks, 'closed' => $GLOBALS['closed'], 'retired' => $GLOBALS['retired'],
    'compiledLean' => false, 'actualPhpBits' => PHP_INT_SIZE * 8], JSON_THROW_ON_ERROR), "\n";
