<?php
declare(strict_types=1);
namespace LeanRecursivecheckedrecords;

require_once __DIR__ . '/Internal/Values.php';

/** Copied aliases retain their target PHP values, without wrapper classes.
 * PacketAlias: Packet
 */

final class LeanBridgeError extends \RuntimeException {}

final readonly class Bytes implements \Stringable, \Countable
{
    private function __construct(private string $value) {}
    public static function fromString(mixed $value): self {
        if (!\is_string($value)) throw new \TypeError('Bytes requires a string');
        return new self($value);
    }
    public function toString(): string { return $this->value; }
    public function __toString(): string { return $this->value; }
    public function count(): int { return \strlen($this->value); }

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
        if (\func_num_args() !== 1) throw new \ArgumentCountError('Some requires one payload');
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
        if (\func_num_args() !== 1) throw new \ArgumentCountError('Ok requires one payload');
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
        if (\func_num_args() !== 1) throw new \ArgumentCountError('Err requires one payload');
        $this->value = $value;
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class Packet
{
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $value;
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $digit;
    /** @var Some<Packet>|null */
    public Some|null $tail;
    public function __construct(mixed $value, mixed $digit, mixed $tail) {
        if (\func_num_args() !== 3) throw new \ArgumentCountError('Packet requires exactly 3 fields');
        Internal\Values::checkFields(self::class, [$value, $digit, $tail]);
        $this->value = $value;
        $this->digit = $digit;
        $this->tail = $tail;
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

require_once __DIR__ . '/Internal/Native.php';

/**
 * @param Packet $value0
 * @return Packet
 */
function echo_(mixed $value0): Packet {
    if (\func_num_args() !== 1) throw new \ArgumentCountError('echo_ requires exactly 1 arguments');
    return Internal\Native::call(0, [$value0]);
}

/**
 * @param list<Some<Packet>|null> $value0
 * @return list<Some<Packet>|null>
 */
function echo_groups(mixed $value0): array {
    if (\func_num_args() !== 1) throw new \ArgumentCountError('echo_groups requires exactly 1 arguments');
    return Internal\Native::call(1, [$value0]);
}

/**
 * @param Packet $value0
 * @return \Brick\Math\BigInteger
 */
function first(mixed $value0): \Brick\Math\BigInteger {
    if (\func_num_args() !== 1) throw new \ArgumentCountError('first requires exactly 1 arguments');
    return Internal\Native::call(2, [$value0]);
}

/**
 * @param list<Some<Packet>|null> $value0
 * @return \Brick\Math\BigInteger
 */
function groups(mixed $value0): \Brick\Math\BigInteger {
    if (\func_num_args() !== 1) throw new \ArgumentCountError('groups requires exactly 1 arguments');
    return Internal\Native::call(3, [$value0]);
}

/**
 * @param \Brick\Math\BigInteger $value0
 * @return Packet
 */
function produce(mixed $value0): Packet {
    if (\func_num_args() !== 1) throw new \ArgumentCountError('produce requires exactly 1 arguments');
    return Internal\Native::call(4, [$value0]);
}

/**
 * @param Packet $value0
 * @return \Brick\Math\BigInteger
 */
function second(mixed $value0): \Brick\Math\BigInteger {
    if (\func_num_args() !== 1) throw new \ArgumentCountError('second requires exactly 1 arguments');
    return Internal\Native::call(5, [$value0]);
}
