<?php
declare(strict_types=1);

return (static function (): array {
    $checks = 0;
    $check = static function (bool $condition, string $label) use (&$checks): void {
        if (!$condition) throw new RuntimeException("UInt32 boundary failed: $label");
        ++$checks;
    };
    $word = static fn(string $decimal): int|Brick\Math\BigInteger => PHP_INT_SIZE === 4
        ? Brick\Math\BigInteger::of($decimal) : (int) $decimal;
    $exact = static function (mixed $value, string $expected, string $label) use ($check): void {
        $check(PHP_INT_SIZE === 4 ? $value instanceof Brick\Math\BigInteger : is_int($value), "$label type");
        $check((string) $value === $expected, "$label value");
    };
    $reject = static function (callable $call, string $label) use ($check): void {
        try {
            $result = $call();
            if ($result instanceof LeanAlpha\Box || $result instanceof LeanAlpha\Transform) $result->close();
        } catch (TypeError|ValueError|LeanAlpha\CallbackThrew $error) {
            $check(true, "$label rejected");
            return;
        }
        throw new RuntimeException("UInt32 boundary accepted invalid $label");
    };
    // Decimal strings keep the oracle independent of the host integer width.
    $vectors = [
        ['0', '1', '4294967295'],
        ['2147483647', '2147483648', '2147483646'],
        ['2147483648', '2147483649', '2147483647'],
        ['4294967295', '0', '4294967294'],
    ];
    $decimals = array_column($vectors, 0);
    foreach ($vectors as [$decimal, $next, $previous]) {
        $box = new LeanAlpha\Box($word($decimal));
        try {
            $exact($box->read(), $decimal, 'resource');
            $check($box->identity() === $box, 'resource identity');
            if (function_exists('LeanBeta\\read')) {
                $exact(LeanBeta\read($box), $decimal, 'cross-component resource');
                $check(LeanBeta\identity($box) === $box, 'cross-component identity');
            }
        } finally {
            $box->close();
        }
        $payload = LeanAlpha\roundTrip(new LeanAlpha\Payload(
            false, $word($decimal), "boundary\0λ", LeanAlpha\Bytes::fromString("\0\x7f\xff"),
            array_map($word, $decimals),
        ));
        $exact($payload->count, $next, 'incremented record field');
        $check($payload->enabled && $payload->label === "boundary\0λ" && $payload->bytes->toString() === "\0\x7f\xff", 'copied payload');
        $check(count($payload->values) === count($decimals), 'array length');
        foreach ($decimals as $index => $expected) $exact($payload->values[$index], $expected, "array element $index");

        $called = false;
        $result = LeanAlpha\withCallback($word($previous), static function (int|Brick\Math\BigInteger $value) use ($exact, $word, $decimal, &$called): int|Brick\Math\BigInteger {
            $called = true;
            $exact($value, $decimal, 'callback argument');
            return $word($decimal);
        });
        $check($called, 'callback invoked');
        $exact($result, $next, 'callback result increment');
        $exact(LeanAlpha\withCallback($word($decimal), static fn() => $word($previous)), $decimal, 'callback function result');

        $identity = LeanAlpha\makeAdder($word('0'));
        $adder = LeanAlpha\makeAdder($word($decimal));
        try {
            $exact($identity($word($decimal)), $decimal, 'closure argument and result');
            $exact($adder($word('0')), $decimal, 'closure capture');
            $exact($adder($word('1')), $next, 'closure overflow');
        } finally {
            $identity->close();
            $adder->close();
        }
    }
    foreach (['-1', '4294967296'] as $decimal) {
        $invalid = $word($decimal);
        $reject(static fn() => new LeanAlpha\Box($invalid), 'resource range');
        $reject(static fn() => new LeanAlpha\Payload(false, $invalid, '', LeanAlpha\Bytes::fromString(''), []), 'field range');
        $reject(static fn() => new LeanAlpha\Payload(false, $word('0'), '', LeanAlpha\Bytes::fromString(''), [$invalid]), 'element range');
        $reject(static fn() => LeanAlpha\makeAdder($invalid), 'closure capture range');
        $reject(static fn() => LeanAlpha\withCallback($word('0'), static fn() => $invalid), 'callback return range');
    }
    if (PHP_INT_SIZE === 4) {
        foreach ([0, 2147483648.0, '4294967295', Brick\Math\BigDecimal::of('0')] as $invalid) {
            $reject(static fn() => new LeanAlpha\Box($invalid), 'UInt32 representation');
            $reject(static fn() => new LeanAlpha\Payload(false, $word('0'), '', LeanAlpha\Bytes::fromString(''), [$invalid]), 'array representation');
            $reject(static fn() => LeanAlpha\withCallback($word('0'), static fn() => $invalid), 'callback representation');
        }
        $zero = Brick\Math\BigInteger::of('-0');
        $box = new LeanAlpha\Box($zero);
        try {
            $exact($box->read(), '0', 'normalized resource input');
            $exact(LeanAlpha\withCallback($word('0'), static fn() => $zero), '1', 'normalized callback result');
        } finally {
            $box->close();
        }
    }
    $cause = new RuntimeException('boundary callback cause');
    try {
        LeanAlpha\withCallback($word('0'), static function () use ($cause): never { throw $cause; });
        throw new RuntimeException('Callback exception was lost');
    } catch (LeanAlpha\CallbackThrew $error) {
        while ($error->getPrevious() !== null) $error = $error->getPrevious();
        $check($error === $cause, 'callback exception identity');
    }
    $box = new LeanAlpha\Box($word('4294967295'));
    try {
        $exact($box->read(), '4294967295', 'recovery after rejected inputs');
    } finally {
        $box->close();
    }
    $snapshot = (new LeanAlpha\Internal\NativeTransport())->runtimeSnapshot();
    $check($snapshot['liveIdentities'] === 0, 'identity cleanup');
    return ['integerBytes' => PHP_INT_SIZE, 'values' => $decimals, 'checks' => $checks, 'liveIdentities' => $snapshot['liveIdentities']];
})();
