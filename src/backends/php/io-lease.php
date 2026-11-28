<?php
declare(strict_types=1);
namespace LeanBridge\HeapV1;

// Independently installed distributions must share the same nominal classes.
if (!class_exists(Lease::class, false)) {
    abstract class Lease {
        private function __construct(
            private readonly int $pid,
            private readonly string $ledger,
            private ?\Closure $read,
            private ?\Closure $dispose,
            private ?\Closure $copy,
            private ?\Closure $compare
        ) {}
        private function __clone() {}
        final public function __serialize(): array { throw new \LogicException('Lean resources cannot be serialized'); }
        final public function __unserialize(array $data): void { throw new \LogicException('Lean resources cannot be unserialized'); }
        final public function __debugInfo(): array { return ['closed'=>$this->isClosed()]; }
        final public function isClosed(): bool { return !isset($this->dispose); }
        private function live(): void {
            if (!isset($this->pid) || $this->isClosed()) throw new \LogicException('Closed or uninitialized Lean resource');
            if ($this->pid !== getmypid()) throw new \LogicException('Start a fresh PHP interpreter after fork');
        }
        private function bits(string $ledger): string {
            $this->live();
            if ($this->ledger !== $ledger) throw new \TypeError('Incompatible Lean resource ledger');
            return ($this->read)();
        }
        final public function retain(): static { $this->live(); return ($this->copy)(); }
        final public function sameResource(self $other): bool {
            $this->live();
            if ($other::class !== static::class) throw new \TypeError('Different Lean resource type');
            return ($this->compare)($other->bits($this->ledger));
        }
        final public function close(): void {
            if ($this->isClosed()) return;
            $this->live();
            $drop=$this->dispose;
            $this->read=$this->dispose=$this->copy=$this->compare=null;
            $drop();
        }
        final public function __destruct() {
            // The child inherited a snapshot, never another native owner.
            if (!$this->isClosed() && $this->pid===getmypid()) $this->close();
        }
    }
}
