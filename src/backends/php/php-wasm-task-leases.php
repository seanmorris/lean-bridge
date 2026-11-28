<?php
declare(strict_types=1);
namespace LeanBridge\WasmHeapV1;

// All Composer packages on one Zend interpreter share the canonical nominal class.
if (!class_exists(Lease::class,false)) {
    abstract class Lease {
        private function __construct(private ?object $cap) {}
        private function __clone() {}
        final public function __serialize(): array { throw new \LogicException('Lean resources cannot be serialized'); }
        final public function __unserialize(array $data): void { throw new \LogicException('Lean resources cannot be restored'); }
        final public function __debugInfo(): array { return ['closed'=>$this->isClosed()]; }
        final public function isClosed(): bool { return !isset($this->cap) || $this->cap->closed(); }
        private function live(): object {
            if ($this->isClosed()) throw new \LogicException('Closed or uninitialized Lean resource');
            return $this->cap;
        }
        final public function retain(): static {
            $other=$this->live()->copy();
            if (!is_object($other)) throw new \RuntimeException('Could not retain Lean resource');
            return new static($other);
        }
        final public function sameResource(self $other): bool {
            if ($other::class!==static::class) throw new \TypeError('Different Lean resource type');
            $same=$this->live()->same($other->live());
            if (!is_bool($same)) throw new \LogicException('Incompatible Lean resource');
            return $same;
        }
        final public function close(): void {
            if (!isset($this->cap)) return;
            $cap=$this->cap; $this->cap=null;
            if (!$cap->closed() && !$cap->close()) throw new \RuntimeException('Could not release Lean resource');
        }
        final public function __destruct() { if (isset($this->cap)) $this->cap->close(); }
    }
}
