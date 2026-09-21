<?php
declare(strict_types=0);
// Synthetic Zend fault probe. Installed real-Lean execution has a separate fixture.
use Brick\Math\BigInteger;
use LeanVariants\{Some, Ok, Err, Bytes, Packet, SignalIdle, SignalStopped, SignalData, SignalMarker,
    ModeFirst, ModeSecond, ModeThird, NestedEmpty, NestedPacket, NestedOutcome, ScalarsAbsent, ScalarsAll,
    AnonymousNumber, AnonymousPair, AnonymousCollision, OneOnly, BuffersEmpty, BuffersPair, LeanBridgeError};
require '/probe/src/Api.php';
$request = json_decode(file_get_contents('/probe.json'), true, 512, JSON_THROW_ON_ERROR);
$checks = $failures = $partial = $malformedTags = $malformedPayloads = $inactive = $wireRejections = 0;
function check(bool $value, string $message = ''): void {
    global $checks; ++$checks;
    if (!$value) throw new RuntimeException('Zend variant check ' . $checks . ': ' . $message);
}
function invoke(string $name, mixed ...$args): mixed { return ('LeanVariants\\' . $name)(...$args); }
function resetFailure(): void {
    try { LeanVariants\fail_after(-1); } catch (Throwable $error) { LeanVariants\fail_after(-1); }
}
function clean(): void { check(LeanVariants\live_allocations() === 0, 'all scratch and native owners released'); }
function rejected(callable $call, string $kind): void {
    try { $call(); } catch (Throwable $error) { check($error instanceof $kind, get_class($error) . ': ' . $error->getMessage()); return; }
    throw new RuntimeException('Expected ' . $kind);
}
function wire(string $name, mixed $value): mixed {
    global $request; return ($request['functions'][$name]['transport'])($value);
}
function recover(): void {
    LeanVariants\configure(0);
    check(LeanVariants\echo_signal(new SignalIdle()) instanceof SignalIdle); clean();
}
function counted(callable $call): mixed {
    $before = LeanVariants\native_calls(); $clears = LeanVariants\output_clears();
    try { return $call(); }
    finally {
        resetFailure();
        check(LeanVariants\native_calls() - $before === LeanVariants\output_clears() - $clears, 'one clear per native entry'); clean();
    }
}
$big = fn($value) => BigInteger::of((string) $value);
$data = new SignalData($big(42), "A\0🌱");
$packet = new Packet($data, [new SignalIdle(), $data, new SignalMarker(null)], new Some($data), [new ModeFirst(), new ModeThird()]);
$scalar = new ScalarsAll(null, true, 255, 65535, $big('4294967295'), $big('18446744073709551615'),
    -128, -32768, -2147483647 - 1, $big('-9223372036854775808'), $big(2)->power(5120)->plus(19),
    $big(2)->power(5120)->plus(31)->negated(), 1.5, -2.25, "A\0🌱", Bytes::fromString("\0\xff"), '🌱', $big('4294967295'), -2147483647 - 1);
$buffers = new BuffersPair(Bytes::fromString("first\0"), Bytes::fromString("second\xff"));
$cases = [
    ['echo_signal', new SignalIdle()], ['echo_signal', new SignalStopped()], ['echo_signal', $data], ['echo_signal', new SignalMarker(null)],
    ['echo_mode', new ModeFirst()], ['echo_mode', new ModeSecond()], ['echo_mode', new ModeThird()],
    ['echo_nested', new NestedEmpty()], ['echo_nested', new NestedPacket($packet)], ['echo_nested', new NestedOutcome(new Ok([$data, new ModeSecond()]))],
    ['echo_scalars', new ScalarsAbsent()], ['echo_scalars', $scalar],
    ['echo_anonymous', new AnonymousNumber($big(13))], ['echo_anonymous', new AnonymousPair($big(17), 'pair')], ['echo_anonymous', new AnonymousCollision($big(19), 'collision')],
    ['echo_one', new OneOnly($big(41))], ['echo_buffers', new BuffersEmpty()], ['echo_buffers', $buffers]
];
$constructors = [];
foreach ($cases as [$name, $value]) {
    $constructors[] = get_class($value);
    $out = counted(fn() => invoke($name, $value));
    check(get_class($out) === get_class($value) && $out == $value && $out !== $value);
}
$probes = [...$cases, ['echo_nested', new NestedOutcome(new Err('owned error'))], ['signals', [[], [$data, new SignalIdle(), $data]]]];
foreach ($probes as [$name, $value]) {
    $succeeded = false;
    for ($limit = 0; $limit < 1000; ++$limit) {
        $before = LeanVariants\native_calls(); $clears = LeanVariants\output_clears();
        LeanVariants\fail_after($limit);
        try { $out = invoke($name, $value); check($out == $value); $succeeded = true; }
        catch (Throwable $error) { ++$failures; }
        resetFailure(); clean();
        check(LeanVariants\native_calls() - $before === LeanVariants\output_clears() - $clears);
        recover(); if ($succeeded) break;
    }
    check($succeeded, 'allocation sweep completed for ' . $name);
}
foreach ($request['families'] as $family) {
    $name = $family['function'];
    foreach ([null, false, [], [true], ['0'], [-1], [$family['constructors']], [0 => 0, 2 => null]] as $bad) {
        $before = LeanVariants\native_calls();
        counted(fn() => rejected(fn() => wire($name, $bad), is_array($bad) && array_is_list($bad) && isset($bad[0]) && is_int($bad[0]) ? ValueError::class : TypeError::class));
        check(LeanVariants\native_calls() === $before); ++$wireRejections;
    }
}
foreach ($cases as [$name, $value]) {
    $to = new ReflectionMethod(LeanVariants\Internal\Native::class, $request['functions'][$name]['to']);
    $valid = $to->invoke(null, $value);
    $bad = $valid; $bad[] = 'extra';
    foreach ([$bad, count($valid) > 1 ? array_slice($valid, 0, -1) : [$valid[0], null]] as $invalid) {
        $before = LeanVariants\native_calls();
        counted(fn() => rejected(fn() => wire($name, $invalid), ValueError::class));
        check(LeanVariants\native_calls() === $before); ++$wireRejections;
    }
}
for ($i = 0; $i < 32; ++$i) {
    $before = LeanVariants\native_calls();
    counted(fn() => rejected(fn() => wire('signals', [[[2, '42', 'allocated'], [2, '43', false]]]), TypeError::class));
    check(LeanVariants\native_calls() === $before); ++$partial;
}
foreach ([['echo_signal', $data], ['echo_mode', new ModeSecond()], ['echo_nested', new NestedPacket($packet)],
    ['echo_scalars', $scalar], ['echo_anonymous', new AnonymousPair($big(17), 'owned')], ['echo_one', new OneOnly($big(41))], ['echo_buffers', $buffers]] as [$name, $value]) {
    LeanVariants\configure(1);
    counted(fn() => rejected(fn() => invoke($name, $value), ValueError::class)); ++$malformedTags; recover();
}
foreach ($cases as [$name, $value]) if (get_object_vars($value) === []) {
    LeanVariants\configure(2); $out = counted(fn() => invoke($name, $value)); check(get_class($out) === get_class($value)); ++$inactive; recover();
}
foreach ([[3, 'echo_signal', $data], [4, 'echo_buffers', $buffers], [5, 'echo_scalars', $scalar],
    [6, 'echo_nested', new NestedPacket($packet)], [9, 'echo_buffers', $buffers],
    [10, 'echo_nested', new NestedPacket($packet)], [12, 'echo_nested', new NestedPacket($packet)]] as [$mode, $name, $value]) {
    LeanVariants\configure($mode);
    counted(fn() => rejected(fn() => invoke($name, $value), ValueError::class)); ++$malformedPayloads; recover();
}
LeanVariants\configure(13);
counted(function() use ($big) {
    try { LeanVariants\echo_signal(new SignalData($big(42), 'owned error')); } catch (LeanBridgeError $error) { check($error->getMessage() === 'owned error' && $error->getCode() === 7); return; }
    throw new RuntimeException('Missing native error');
});
recover();
$copy = counted(fn() => LeanVariants\echo_buffers($buffers));
check($copy->first !== $buffers->first && $copy->second !== $buffers->second && $copy->first !== $copy->second);
echo json_encode(['checks' => $checks, 'allocationFailures' => $failures, 'constructors' => $constructors,
    'malformedTags' => $malformedTags, 'malformedPayloads' => $malformedPayloads, 'inactivePayloadCases' => $inactive,
    'partialInputs' => $partial, 'wireRejections' => $wireRejections, 'oneClearPerNativeEntry' => true, 'wordBits' => PHP_INT_SIZE * 8]);
