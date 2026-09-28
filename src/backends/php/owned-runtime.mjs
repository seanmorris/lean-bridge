/**
 * Native PHP result leases, callback borrows and context-safe finalization.
 *
 * @file
 */

/**
 * The caller supplies authenticated FFI bindings. This runtime alone does not
 * admit Composer packages or claim the separate PHP-Wasm Zend transport.
 *
 * @param prefix - Validated public C component identifier.
 */
export const ownedPhpRuntime = prefix => {
	if(typeof prefix !== "string" || !/^[a-z][a-z0-9_]*$/u.test(prefix) || prefix.includes("__")) throw new TypeError("Invalid owned PHP prefix");
	const namespace = "Lean" + prefix.split("_").filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("") + (prefix.match(/_+$/u)?.[0] ?? "");
	return String.raw`
final class OwnedRuntime
{
    private ?OwnedState $state = null;
    public readonly int $pid;
    public function __construct(public readonly \FFI $ffi, private ?\Closure $ensureLoaded = null,
        private ?\Closure $checkpoint = null) {
        if (PHP_VERSION_ID < 80200 || PHP_VERSION_ID >= 90000 || PHP_INT_SIZE !== 8
            || PHP_ZTS || PHP_SAPI !== 'cli' || PHP_OS_FAMILY !== 'Linux' || php_uname('m') !== 'x86_64'
            || pack('S', 1) !== "\1\0") throw new \RuntimeException('Native owned PHP requires little-endian Linux x86-64 NTS CLI');
        $this->pid = getmypid(); $this->affinity();
    }
    public static function checked(int $status): void {
        if ($status === 0) return;
        $message = [1 => 'Invalid argument', 2 => 'Ownership limit exceeded', 3 => 'Native allocation failed',
            4 => 'Resource is closed', 5 => 'Lean calls require the main PHP execution context',
            6 => 'Start a fresh PHP interpreter after fork', 7 => 'Lean runtime is unavailable',
            8 => 'Invalid native call order', 9 => 'Malformed native result', 10 => 'Host callback failed'][$status]
            ?? 'Unknown native status';
        throw new \@NAMESPACE@\LeanBridgeError($message, $status);
    }
    public function affinity(): void {
        if (getmypid() !== $this->pid) self::checked(6);
        if (\Fiber::getCurrent() !== null) self::checked(5);
        if ($this->ensureLoaded !== null) ($this->ensureLoaded)();
    }
    public function checkpoint(): void { if ($this->checkpoint !== null) ($this->checkpoint)(); }
    public function current(): OwnedState {
        $this->affinity();
        if ($this->state === null) { $this->checkpoint(); $this->state = new OwnedState($this); }
        $this->state->requireOpen();
        return $this->state;
    }
    public function close(): void { $this->affinity(); $this->state?->close(); }
}

final class OwnedStates
{
    private static array $states = [];
    private static bool $registered = false;
    public static function add(OwnedState $state): void {
        if (!self::$registered) {
            register_shutdown_function(static function(): void {
                foreach (self::$states as $state) {
                    if (getmypid() !== $state->runtime->pid || \Fiber::getCurrent() !== null) continue;
                    try { $state->close(); } catch (\Throwable) {}
                }
            });
            self::$registered = true;
        }
        self::$states[spl_object_id($state)] = $state;
    }
    public static function remove(OwnedState $state): void { unset(self::$states[spl_object_id($state)]); }
}

final class OwnedSlot
{
    public readonly \FFI\CData $value;
    public bool $pending = false;
    public bool $releasing = false;
    public function __construct(OwnedState $state) { $this->value = $state->runtime->ffi->new('@PREFIX@_result *'); }
}

final class OwnedState
{
    public readonly \FFI\CData $session;
    private bool $closed = false;
    private array $slots = [];
    public function __construct(public readonly OwnedRuntime $runtime) {
        $runtime->affinity();
        $this->session = $runtime->ffi->new('@PREFIX@_session *');
        OwnedRuntime::checked($runtime->ffi->@PREFIX@_session_open(\FFI::addr($this->session)));
        if (\FFI::isNull($this->session)) OwnedRuntime::checked(9);
        try { $runtime->checkpoint(); OwnedStates::add($this); }
        catch (\Throwable $error) { $this->close(); throw $error; }
    }
    public function requireOpen(): \FFI\CData {
        $this->runtime->affinity();
        if ($this->closed || \FFI::isNull($this->session)) OwnedRuntime::checked(4);
        $this->drain(); return $this->session;
    }
    public function slot(): OwnedSlot {
        $this->requireOpen(); $this->runtime->checkpoint();
        $slot = new OwnedSlot($this);
        $this->runtime->checkpoint(); $this->slots[spl_object_id($slot)] = $slot;
        return $slot;
    }
    public function adopt(OwnedOwner $owner): OwnedLease {
        $this->requireOpen();
        if ($owner->state !== $this || $owner->slot === null || $owner->lease !== null
            || $owner->slot->pending || $owner->slot->releasing || \FFI::isNull($owner->slot->value)) OwnedRuntime::checked(1);
        $this->runtime->checkpoint(); $lease = new OwnedLease($this);
        $this->runtime->checkpoint(); $lease->slot = $owner->slot; $owner->lease = $lease;
        return $lease;
    }
    public function release(OwnedSlot $slot): void {
        if (getmypid() !== $this->runtime->pid) return;
        $slot->pending = true;
        // A PHP object can die in a Fiber. Leave its registered slot pending
        // until the next main-context entry or request shutdown.
        if (\Fiber::getCurrent() === null) $this->drain();
    }
    public function drain(): void {
        $this->runtime->affinity();
        foreach ($this->slots as $id => $slot) {
            if (!$slot->pending || $slot->releasing) continue;
            $slot->releasing = true;
            try { $status = $this->runtime->ffi->@PREFIX@_result_release(\FFI::addr($slot->value)); }
            finally {
                $slot->releasing = false;
                if (\FFI::isNull($slot->value)) unset($this->slots[$id]);
            }
            OwnedRuntime::checked($status);
            if (!\FFI::isNull($slot->value)) OwnedRuntime::checked(9);
        }
    }
    public function close(): void {
        $this->runtime->affinity();
        if (!$this->closed) {
            OwnedRuntime::checked($this->runtime->ffi->@PREFIX@_session_close(\FFI::addr($this->session)));
            if (!\FFI::isNull($this->session)) OwnedRuntime::checked(9);
            $this->closed = true;
        }
        foreach ($this->slots as $slot) $slot->pending = true;
        $this->drain(); OwnedStates::remove($this);
    }
}

final class OwnedOwner
{
    public ?OwnedSlot $slot = null;
    public ?OwnedLease $lease = null;
    public function __construct(public readonly OwnedState $state) { $this->slot = $state->slot(); }
    public function value(): \FFI\CData {
        if ($this->slot === null) OwnedRuntime::checked(4);
        return $this->slot->value;
    }
    public function publish(): void {
        if ($this->lease === null) { $this->close(); return; }
        $this->lease->requireOpen();
        $this->slot = null; $this->lease = null;
    }
    public function close(): void {
        $slot = $this->slot; $this->slot = null;
        if ($slot !== null) $this->state->release($slot);
        $this->lease = null;
    }
    public function __destruct() { try { $this->close(); } catch (\Throwable) {} }
}

final class OwnedBorrowScope { public bool $active = true; }

final class OwnedLease
{
    public ?OwnedSlot $slot = null;
    public function __construct(public readonly OwnedState $state, private ?OwnedBorrowScope $scope = null) {}
    public function requireOpen(): void {
        $this->state->requireOpen();
        if ($this->scope !== null) { if (!$this->scope->active) OwnedRuntime::checked(4); return; }
        if ($this->slot === null || $this->slot->pending || $this->slot->releasing || \FFI::isNull($this->slot->value)) OwnedRuntime::checked(4);
    }
    public function __destruct() {
        if ($this->slot !== null) { try { $this->state->release($this->slot); } catch (\Throwable) {} }
    }
}

final class OwnedBorrowFrame
{
    private readonly OwnedBorrowScope $scope;
    public readonly OwnedLease $lease;
    public function __construct(OwnedState $state) {
        $state->requireOpen(); $state->runtime->checkpoint();
        $this->scope = new OwnedBorrowScope();
        $state->runtime->checkpoint(); $this->lease = new OwnedLease($state, $this->scope);
    }
    public function close(): void { if (isset($this->scope)) $this->scope->active = false; }
    public function __destruct() { $this->close(); }
}

final class NativeBinding implements ResourceBinding
{
    public function __construct(private ?OwnedLease $lease, private ?\FFI\CData $handle,
        private ?\Closure $retainCall, private ?\Closure $invokeCall = null) {
        $this->check(); $this->lease->state->runtime->checkpoint();
    }
    public function check(): void {
        if ($this->lease === null || $this->handle === null || \FFI::isNull($this->handle)) OwnedRuntime::checked(4);
        $this->lease->requireOpen();
    }
    public function raw(OwnedState $state): \FFI\CData {
        $this->check();
        if ($this->lease->state !== $state) OwnedRuntime::checked(1);
        return $this->handle;
    }
    public function state(): OwnedState { $this->check(); return $this->lease->state; }
    public function pin(OwnedState $state): OwnedLease { $this->raw($state); return $this->lease; }
    public function retain(): ResourceBinding {
        $this->check();
        if ($this->retainCall === null) throw new \LogicException('Missing native retain operation');
        return ($this->retainCall)($this);
    }
    public function invoke(array $arguments): mixed {
        $this->check();
        if ($this->invokeCall === null) throw new \TypeError('This Lean identity is not callable');
        return ($this->invokeCall)($this, $arguments);
    }
    public function close(): void {
        if ($this->lease === null) return;
        $this->lease->state->runtime->affinity();
        $this->handle = null; $this->lease = null; $this->retainCall = null; $this->invokeCall = null;
    }
}
`.replaceAll("@PREFIX@", prefix).replaceAll("@NAMESPACE@", namespace);
};
