/**
 * PHP reservations share the native snapshot's actual consumption decision.
 *
 * @file
 */

/** One group owns the snapshot and leases of one consuming argument. */
export const ownedPhpInputTransfers = String.raw`
final class OwnedInputGroup
{
    private array $leases = [];
    private ?OwnedOwner $snapshot = null;
    private ?\FFI\CData $value = null;
    private bool $armed = false;
    private bool $finished = false;
    public function __construct(private readonly OwnedState $state) { $state->runtime->checkpoint(); }
    public function reserve(OwnedLease $lease): void {
        $this->state->runtime->checkpoint(); $lease->requireOpen();
        if ($this->finished || $this->armed || $lease->state !== $this->state || !$lease->transferable()) OwnedRuntime::checked(1);
        if ($lease->inputMove !== null && $lease->inputMove !== $this) OwnedRuntime::checked(1);
        $this->leases[spl_object_id($lease)] = $lease;
        $lease->inputMove = $this;
    }
    public function prepare(array $parameter, OwnedSchema $schema, mixed $input): mixed {
        $this->state->requireOpen();
        if ($this->snapshot !== null || $this->finished || $this->armed) OwnedRuntime::checked(8);
        $this->snapshot = new OwnedOwner($this->state);
        $this->state->runtime->checkpoint();
        $node = $schema->nodes[$parameter['type']];
        $this->value = $schema->ffi->new($node['ctype']);
        OwnedRuntime::checked($schema->ffi->{$parameter['transfer']}($this->state->requireOpen(), $input,
            \FFI::addr($this->value), $this->owner()));
        return $node['leaf'] ? $this->value : \FFI::addr($this->value);
    }
    public function owner(): \FFI\CData {
        if ($this->snapshot === null) OwnedRuntime::checked(8);
        return \FFI::addr($this->snapshot->value());
    }
    public static function armAll(array $groups): void {
        foreach ($groups as $group) {
            $group->state->requireOpen();
            if ($group->finished || $group->snapshot === null || \FFI::isNull($group->snapshot->value())) OwnedRuntime::checked(9);
            foreach ($group->leases as $lease) {
                $lease->requireOpen();
                if (!$lease->transferable() || $lease->inputMove !== $group) OwnedRuntime::checked(4);
            }
        }
        foreach ($groups as $group) $group->armed = true;
    }
    public function consumed(): bool {
        return $this->armed && $this->snapshot !== null && \FFI::isNull($this->snapshot->value());
    }
    public function finish(): void {
        if ($this->finished) return;
        $consumed = $this->consumed(); $this->finished = true; $failure = null;
        foreach ($this->leases as $lease) {
            try {
                if ($lease->inputMove !== $this) OwnedRuntime::checked(9);
                $lease->inputMove = null;
                if ($consumed) {
                    $slot = $lease->slot; $lease->slot = null;
                    if ($slot !== null) $this->state->release($slot);
                }
            } catch (\Throwable $error) { $failure ??= $error; }
        }
        $this->leases = []; $snapshot = $this->snapshot; $this->snapshot = null; $this->value = null;
        try { $snapshot?->close(); } catch (\Throwable $error) { $failure ??= $error; }
        if ($failure !== null) throw $failure;
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
