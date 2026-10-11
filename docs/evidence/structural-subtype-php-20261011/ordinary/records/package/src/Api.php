<?php
declare(strict_types=1);
namespace LeanStructuralsubtypes;


final class LeanBridgeError extends \RuntimeException {}

final readonly class Bytes implements \Stringable, \Countable
{
    private function __construct(private string $value) {}
    public static function fromString(mixed $value): self {
        if (!is_string($value)) throw new \TypeError('Bytes requires a string');
        return new self($value);
    }
    public function toString(): string { return $this->value; }
    public function __toString(): string { return $this->value; }
    public function count(): int { return strlen($this->value); }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}


/** @template T */
final readonly class Some
{
    /** @var T */
    public mixed $value;
    /** @param T $value */
    public function __construct(mixed $value) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('Some requires one payload');
        $this->value = $value;
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

/** @template T */
final readonly class Ok
{
    /** @var T */
    public mixed $value;
    /** @param T $value */
    public function __construct(mixed $value) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('Ok requires one payload');
        $this->value = $value;
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

/** @template T */
final readonly class Err
{
    /** @var T */
    public mixed $value;
    /** @param T $value */
    public function __construct(mixed $value) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('Err requires one payload');
        $this->value = $value;
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}



require_once __DIR__ . '/Internal/Native.php';

/**
 * Checked Lean Fin bounds: $arg0[*]? checked by StructuralSubtypes.checkedPositive; $arg1[*]? checked by StructuralSubtypes.normalizePositive; result[*]? checked by StructuralSubtypes.checkedPositive.
 *
 * @param list<Some<\Brick\Math\BigInteger>|null> $arg0
 * @param list<Some<\Brick\Math\BigInteger>|null> $arg1
 * @return list<Some<\Brick\Math\BigInteger>|null>
 */
function alias_arguments(mixed $arg0, mixed $arg1): array {
    return Internal\Native::call0($arg0, $arg1);
}

/**
 * Checked Lean Fin bounds: $arg0.0[*]? checked by StructuralSubtypes.checkedPositive; $arg0.1[*]? checked by StructuralSubtypes.normalizePositive; result.0[*]? checked by StructuralSubtypes.checkedPositive; result.1[*]? checked by StructuralSubtypes.normalizePositive.
 *
 * @param array{list<Some<\Brick\Math\BigInteger>|null>, list<Some<\Brick\Math\BigInteger>|null>} $arg0
 * @return array{list<Some<\Brick\Math\BigInteger>|null>, list<Some<\Brick\Math\BigInteger>|null>}
 */
function alias_pair(mixed $arg0): array {
    return Internal\Native::call1($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0[*] checked by StructuralSubtypes.checkedPositive; result[*] checked by StructuralSubtypes.checkedPositive.
 *
 * @param list<\Brick\Math\BigInteger> $arg0
 * @return list<\Brick\Math\BigInteger>
 */
function arrays(mixed $arg0): array {
    return Internal\Native::call2($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.ok checked by StructuralSubtypes.checkedPositive; $arg0.error checked by StructuralSubtypes.checkedWord; result.ok checked by StructuralSubtypes.checkedPositive; result.error checked by StructuralSubtypes.checkedWord.
 *
 * @param Ok<\Brick\Math\BigInteger>|Err<string> $arg0
 * @return Ok<\Brick\Math\BigInteger>|Err<string>
 */
function branch(mixed $arg0): Ok|Err {
    return Internal\Native::call3($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0[*]?.0 checked by StructuralSubtypes.checkedByte; $arg0[*]?.1 checked by StructuralSubtypes.checkedPositive; result[*]?.0 checked by StructuralSubtypes.checkedByte; result[*]?.1 checked by StructuralSubtypes.checkedPositive.
 *
 * @param list<Some<array{int, \Brick\Math\BigInteger}>|null> $arg0
 * @return list<Some<array{int, \Brick\Math\BigInteger}>|null>
 */
function byte_branches(mixed $arg0): array {
    return Internal\Native::call4($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0[*] checked by StructuralSubtypes.checkedPositive; result[*] checked by StructuralSubtypes.checkedPositive.
 *
 * @param list<\Brick\Math\BigInteger> $arg0
 * @return list<\Brick\Math\BigInteger>
 */
function lists(mixed $arg0): array {
    return Internal\Native::call5($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0[*][*]?.0 checked by StructuralSubtypes.checkedPositive; $arg0[*][*]?.1 < 184467440737095516170.
 *
 * @param list<list<Some<array{\Brick\Math\BigInteger, \Brick\Math\BigInteger}>|null>> $arg0
 * @return \Brick\Math\BigInteger
 */
function nested(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call6($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0? checked by StructuralSubtypes.checkedPositive; result? checked by StructuralSubtypes.checkedPositive.
 *
 * @param Some<\Brick\Math\BigInteger>|null $arg0
 * @return Some<\Brick\Math\BigInteger>|null
 */
function options(mixed $arg0): Some|null {
    return Internal\Native::call7($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0[*]? < 10.
 *
 * @param list<Some<\Brick\Math\BigInteger>|null> $arg0
 * @return \Brick\Math\BigInteger
 */
function plain_fin(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call8($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.0 checked by StructuralSubtypes.checkedPositive; $arg0.1 checked by StructuralSubtypes.checkedWord; result.0 checked by StructuralSubtypes.checkedPositive; result.1 checked by StructuralSubtypes.checkedWord.
 *
 * @param array{\Brick\Math\BigInteger, string} $arg0
 * @return array{\Brick\Math\BigInteger, string}
 */
function product(mixed $arg0): array {
    return Internal\Native::call9($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0 checked by StructuralSubtypes.checkedPositive; result checked by StructuralSubtypes.checkedPositive.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @return \Brick\Math\BigInteger
 */
function scalar(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call10($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0[*] checked by StructuralSubtypes.checkedPositive; result[*] checked by StructuralSubtypes.checkedPositive.
 *
 * @param list<\Brick\Math\BigInteger> $arg0
 * @return list<\Brick\Math\BigInteger>
 */
function specialized(mixed $arg0): array {
    return Internal\Native::call11($arg0);
}
