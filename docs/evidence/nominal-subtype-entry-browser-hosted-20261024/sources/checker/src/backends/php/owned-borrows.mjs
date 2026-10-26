/**
 * Whole PHP roots keep empty results tied to their original native owners.
 *
 * @file
 */

export const ownedPhpBorrowValue = String.raw`
/** @template T */
final class Value
{
    private function __construct(private ?Internal\OwnedLease $lease,
        private int $type, private mixed $payload, private ?\Closure $retainCall) {
        $lease->addRoot();
    }
    /** @return T */
    public function get(): mixed {
        $lease = $this->lease; $payload = $this->payload;
        if ($lease === null) Internal\OwnedRuntime::checked(4);
        $lease->requireOpen(); return $payload;
    }
    public function closed(): bool {
        if ($this->lease === null) return true;
        try { $this->lease->requireOpen(); return false; }
        catch (LeanBridgeError $error) { if ($error->getCode() === 4) return true; throw $error; }
    }
    public function close(): void {
        $this->lease?->state->runtime->affinity(); $this->detach();
    }
    private function detach(): void {
        $lease = $this->lease; $this->lease = null;
        $this->payload = null; $this->retainCall = null;
        $lease?->dropRoot();
    }
    /** @return Value<T> */
    public function share(): self {
        [$lease, $type, $payload, $retain] = Internal\ValueAccess::snapshot($this);
        return new self($lease, $type, $payload, $retain);
    }
    /** @return Value<T> */
    public function retain(): self {
        [$lease, , $payload, $retain] = Internal\ValueAccess::snapshot($this);
        $pin = new Internal\OwnedPin($lease);
        try { return $retain($payload); } finally { $pin->close(); }
    }
    public function equals(mixed $other): bool {
        [, $type, $payload] = Internal\ValueAccess::snapshot($this);
        if (!$other instanceof self) return false;
        [, $otherType, $otherPayload] = Internal\ValueAccess::snapshot($other);
        return $type === $otherType && Internal\Values::equal($payload, $otherPayload);
    }
    public function hashCode(): string {
        [, $type, $payload] = Internal\ValueAccess::snapshot($this);
        return hash('sha256', $type . ':' . Internal\Values::hash($payload));
    }
    public function __invoke(mixed ...$arguments): mixed { return ($this->get())(...$arguments); }
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Lean owners cannot be serialized'); }
    public function __unserialize(array $data): void { throw new \LogicException('Lean owners cannot be deserialized'); }
    public function __destruct() { try { $this->detach(); } catch (\Throwable) {} }
}
`;

export const ownedPhpBorrowAccess = String.raw`
final class ValueAccess
{
    public static function wrap(OwnedLease $lease, int $type, mixed $payload, \Closure $retain): @NAMESPACE@\Value {
        $create = \Closure::bind(static fn() => new @NAMESPACE@\Value($lease, $type, $payload, $retain), null, @NAMESPACE@\Value::class);
        return $create();
    }
    public static function snapshot(@NAMESPACE@\Value $value, ?int $type = null): array {
        $read = \Closure::bind(static fn() => isset($value->lease)
            ? [$value->lease, $value->type, $value->payload, $value->retainCall] : null, null, @NAMESPACE@\Value::class);
        $snapshot = $read();
        if ($snapshot === null) OwnedRuntime::checked(4);
        if ($type !== null && $snapshot[1] !== $type) throw new \TypeError('Wrong whole Lean value type');
        $snapshot[0]->requireOpen(); return $snapshot;
    }
}
`;

export const ownedPhpBorrowLease = String.raw`
final class OwnedPin
{
    private bool $active = false;
    public function __construct(private readonly OwnedLease $lease) {
        $lease->pin(); $this->active = true;
    }
    public function close(): void {
        if (!$this->active) return;
        $this->active = false; $this->lease->unpin();
    }
    public static function closeAll(array $pins): void {
        $failure = null;
        foreach ($pins as $pin) {
            try { $pin->close(); } catch (\Throwable $error) { $failure ??= $error; }
        }
        if ($failure !== null) throw $failure;
    }
    public function __destruct() { try { $this->close(); } catch (\Throwable) {} }
}

final class OwnedLease
{
    public ?OwnedSlot $slot = null;
    public ?OwnedInputGroup $inputMove = null;
    public bool $published = false;
    public ?OwnedLease $anchor = null;
    private bool $valid = true;
    private bool $whole = false;
    private int $roots = 0;
    private int $pins = 0;
    public function __construct(public readonly OwnedState $state, private ?OwnedBorrowScope $scope = null) {}
    public function requireOpen(): void {
        $this->state->requireOpen();
        for ($current = $this; $current !== null; $current = $current->anchor) {
            if (!$current->valid || $current->inputMove?->consumed()) OwnedRuntime::checked(4);
            if ($current->scope !== null) {
                if (!$current->scope->active) OwnedRuntime::checked(4);
            } elseif ($current->slot === null || $current->slot->pending || $current->slot->releasing
                || \FFI::isNull($current->slot->value)) OwnedRuntime::checked(4);
        }
        if ($this->scope === null)
            OwnedRuntime::checked($this->state->runtime->ffi->@PREFIX@_result_validate($this->state->requireOpen(), $this->slot->value));
    }
    public function addRoot(): void {
        $this->requireOpen();
        if ($this->roots === PHP_INT_MAX) OwnedRuntime::checked(2);
        $this->whole = true; $this->roots++;
    }
    public function dropRoot(): void {
        if ($this->roots === 0) return;
        if (--$this->roots === 0) $this->invalidate();
    }
    public function pin(): void {
        $this->requireOpen();
        if ($this->pins === PHP_INT_MAX) OwnedRuntime::checked(2);
        $this->pins++;
    }
    public function unpin(): void {
        if ($this->pins === 0) return;
        if (--$this->pins === 0 && !$this->valid) $this->release();
    }
    private function release(): void {
        $slot = $this->slot; $this->slot = null;
        if ($slot !== null) $this->state->release($slot);
    }
    public function invalidate(): void { $this->valid = false; if ($this->pins === 0) $this->release(); }
    public function transferable(): bool {
        return $this->whole && $this->roots > 0 && $this->scope === null && $this->anchor === null && $this->published;
    }
    public function __destruct() { try { $this->release(); } catch (\Throwable) {} }
}
`;

export const ownedPhpBorrowTransfers = String.raw`
final class OwnedInputGroup
{
    private bool $armed = false;
    private bool $finished = false;
    public function __construct(public readonly OwnedLease $lease) {
        $lease->requireOpen();
        if (!$lease->transferable()) OwnedRuntime::checked(1);
        if ($lease->inputMove !== null) OwnedRuntime::checked(8);
        $lease->inputMove = $this;
    }
    public function owner(): \FFI\CData {
        if ($this->finished || $this->lease->slot === null) OwnedRuntime::checked(4);
        return \FFI::addr($this->lease->slot->value);
    }
    public function consumed(): bool {
        return $this->armed && ($this->lease->slot === null || \FFI::isNull($this->lease->slot->value));
    }
    public static function armAll(array $groups): void {
        foreach ($groups as $group) {
            $group->lease->requireOpen();
            if ($group->finished || $group->armed || !$group->lease->transferable()
                || $group->lease->inputMove !== $group) OwnedRuntime::checked(8);
        }
        foreach ($groups as $group) $group->armed = true;
    }
    public function finish(): void {
        if ($this->finished) return;
        $consumed = $this->consumed(); $this->finished = true;
        if ($this->lease->inputMove === $this) $this->lease->inputMove = null;
        if ($consumed) $this->lease->invalidate();
    }
    public static function finishAll(array $groups): void {
        $failure = null;
        foreach ($groups as $group) {
            try { $group->finish(); } catch (\Throwable $error) { $failure ??= $error; }
        }
        if ($failure !== null) throw $failure;
    }
    public function __destruct() { try { $this->finish(); } catch (\Throwable) {} }
}
`;
