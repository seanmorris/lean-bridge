<?php
declare(strict_types=1);
namespace LeanMutualcheckedrecords;

require_once __DIR__ . '/Internal/Values.php';

/** Copied aliases retain their target PHP values, without wrapper classes.
 * EnvelopeAlias: Envelope
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
abstract readonly class Step {}
final readonly class Envelope
{
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $value;
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $mode;
    /** @var Some<Step>|null */
    public Some|null $next;
    public function __construct(mixed $value, mixed $mode, mixed $next) {
        if (\func_num_args() !== 3) throw new \ArgumentCountError('Envelope requires exactly 3 fields');
        Internal\Values::checkFields(self::class, [$value, $mode, $next]);
        $this->value = $value;
        $this->mode = $mode;
        $this->next = $next;
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class StepStop extends Step
{

    public function __construct() {
        if (\func_num_args() !== 0) throw new \ArgumentCountError('StepStop requires exactly 0 fields');
        Internal\Values::checkFields(self::class, []);

    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class StepMore extends Step
{
    /** @var Envelope */
    public Envelope $packet;
    public function __construct(mixed $packet) {
        if (\func_num_args() !== 1) throw new \ArgumentCountError('StepMore requires exactly 1 fields');
        Internal\Values::checkFields(self::class, [$packet]);
        $this->packet = $packet;
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

require_once __DIR__ . '/Internal/Native.php';

/**
 * @param Envelope $arg0
 * @return Envelope
 */
function echo_(mixed $arg0): Envelope {
    if (\func_num_args() !== 1) throw new \ArgumentCountError('echo_ requires exactly 1 arguments');
    return Internal\Native::call(0, [$arg0]);
}

/**
 * @param list<Some<Envelope>|null> $arg0
 * @return list<Some<Envelope>|null>
 */
function echo_groups(mixed $arg0): array {
    if (\func_num_args() !== 1) throw new \ArgumentCountError('echo_groups requires exactly 1 arguments');
    return Internal\Native::call(1, [$arg0]);
}

/**
 * @param Envelope $arg0
 * @return \Brick\Math\BigInteger
 */
function first(mixed $arg0): \Brick\Math\BigInteger {
    if (\func_num_args() !== 1) throw new \ArgumentCountError('first requires exactly 1 arguments');
    return Internal\Native::call(2, [$arg0]);
}

/**
 * @param list<Some<Envelope>|null> $arg0
 * @return \Brick\Math\BigInteger
 */
function groups(mixed $arg0): \Brick\Math\BigInteger {
    if (\func_num_args() !== 1) throw new \ArgumentCountError('groups requires exactly 1 arguments');
    return Internal\Native::call(3, [$arg0]);
}

/**
 * @param \Brick\Math\BigInteger $arg0
 * @return Envelope
 */
function produce(mixed $arg0): Envelope {
    if (\func_num_args() !== 1) throw new \ArgumentCountError('produce requires exactly 1 arguments');
    return Internal\Native::call(4, [$arg0]);
}

/**
 * @param Envelope $arg0
 * @return \Brick\Math\BigInteger
 */
function second(mixed $arg0): \Brick\Math\BigInteger {
    if (\func_num_args() !== 1) throw new \ArgumentCountError('second requires exactly 1 arguments');
    return Internal\Native::call(5, [$arg0]);
}
