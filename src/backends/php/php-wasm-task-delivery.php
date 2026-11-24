<?php
declare(strict_types=1);
namespace __LB_PUBLIC__;

final class TaskCancelled extends \RuntimeException {}

/** One owning PHP object. Repeated awaits return the same value or throw the same error. */
abstract class Awaitable {
    private bool $observed=false;
    private bool $observing=false;
    private mixed $value=null;
    private ?\Throwable $failure=null;
    private ?object $cleanup;
    final protected function __construct(private ?object $owner, private readonly \Closure $decode, private ?Internal\CallbackScope $callbacks=null,
            private readonly ?\LeanBridge\Internal\PhpWasmObjectsV1\Scope $objects=null) {
        $this->cleanup=$owner->cleanup(); $callbacks?->attach($owner);
    }
    private function __clone() {}
    final public function __serialize(): array { throw new \LogicException('Cannot serialize an active Lean owner'); }
    final public function __unserialize(array $data): void { throw new \LogicException('Cannot restore a Lean owner'); }
    final public function cancel(): bool {
        $stopped=$this->owner?->cancel() ?? false;
        if ($stopped) $this->release(true);
        return $stopped;
    }
    private function release(bool $suppress): void {
        $first=null;
        try {$this->callbacks?->close();} catch (\Throwable $e) {$first=$e;}
        $this->callbacks=null;
        try {$this->objects?->close($suppress || $first!==null);} catch (\Throwable $e) {$first??=$e;}
        if (!$suppress && $first!==null) throw $first;
    }
    final public function __destruct() { try { $this->owner?->abandon(); } finally { $this->release(true); } }
    final public function awaitCleanup(): void {
        if ($this->observing || $this->callbacks?->dispatching()) throw new \LogicException('Cannot wait for an active callback on this task');
        if ($this->cleanup===null) return;
        if (\LeanBridge\Internal\PhpWasmTasksV1\Pump::read($this->cleanup)!=='["end"]')
            throw new LeanBridgeError('Failed to drain Lean task owner');
        $this->cleanup=null;
        // Capture the terminal result and release Zend callables even when the
        // application keeps this owner and calls await() much later.
        if (!$this->observed) { try { $this->take(); } catch (\Throwable) { /* Cached for await(). */ } }
    }
    final protected function take(): mixed {
        if ($this->observing || $this->callbacks?->dispatching()) throw new \LogicException('Reentrant observation of the same Lean task');
        if (!$this->observed) {
            $this->observing=true;
            try {
                $packet=\LeanBridge\Internal\PhpWasmTasksV1\Pump::read($this->owner);
                $this->value=$this->callbacks!==null ? $this->callbacks->decode($packet,$this->decode) : ($this->decode)($packet);
            } catch (\Throwable $error) { $this->owner->cancel(); $this->failure=$error; }
            finally {
                $this->observed=true;$this->owner=null;
                try {$this->release($this->failure!==null);} catch (\Throwable $e) {
                    $this->failure??=$e;
                    // await() will never deliver the previously decoded value.
                    try {$this->value=null;} catch (\Throwable) { /* Preserve the first failure. */ }
                }
                finally {$this->observing=false;}
            }
        }
        if ($this->failure!==null) throw $this->failure;
        return $this->value;
    }
}

/** A one-pass, demand-driven sequence. Breaking a foreach closes its Lean cursor. */
final class PullStream implements \IteratorAggregate {
    private bool $started=false;
    private function __construct(private ?object $owner, private readonly \Closure $decode,
            private readonly ?\LeanBridge\Internal\PhpWasmObjectsV1\Scope $objects=null) {}
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Cannot serialize a Lean cursor'); }
    public function __unserialize(array $data): void { throw new \LogicException('Cannot restore a Lean cursor'); }
    public function close(): void {
        if ($this->owner===null) return;
        $owner=$this->owner; $this->owner=null;
        $failed=true;
        try {
            if (\LeanBridge\Internal\PhpWasmTasksV1\Pump::read($owner->drain())!=='["end"]') throw new LeanBridgeError('Failed to close Lean cursor');
            $failed=false;
        } finally { $this->objects?->close($failed); }
    }
    public function __destruct() { try {$this->owner?->dispose();} finally {$this->objects?->close(true);} }
    public function getIterator(): \Traversable {
        if ($this->started || $this->owner===null) throw new \LogicException('Lean cursor is closed or already in use');
        $this->started=true;
        try {
            while ($this->owner!==null) {
                $packet=\LeanBridge\Internal\PhpWasmTasksV1\Pump::read($this->owner->pull());
                if ($packet==='["end"]') break;
                yield ($this->decode)($packet);
            }
        } finally { $this->close(); }
    }
}
