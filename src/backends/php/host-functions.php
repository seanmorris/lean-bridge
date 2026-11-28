<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;

use Brick\Math\BigInteger;
use LeanBridge\NativeHostV2\References;

/** @internal Destructors may run on a Fiber that cannot enter the active native frame. */
final class FunctionReleases {
    private static array $pending=[];
    private static bool $draining=false;
    public static function drain(): void {
        if (self::$draining || !self::$pending) return;
        References::enter();
        self::$draining=true;
        try {
            $batch=self::$pending; self::$pending=[];
            foreach ($batch as $close) {
                try { $close(); } catch (\Throwable) { self::$pending[]=$close; }
            }
        } finally { self::$draining=false; References::leave(true); }
    }
    public static function abandon(\Closure $close): void {
        self::$pending[]=$close;
        try { self::drain(); }
        catch (\LogicException) {
            // The shared reference domain releases this wake-up on the active
            // Fiber when its outer frame unwinds, even in a different package.
            $wake=new class {
                public function __destruct() { try { FunctionReleases::drain(); } catch (\Throwable) {} }
            };
            References::drop(References::hold($wake));
        }
    }
}

/** @internal A binding-owned ticket, never a public integer or pointer. */
final class HostFunctionCell {
    private ?BigInteger $ticket=null;
    private readonly int $pid;
    public function __construct(private readonly \Closure $call,private readonly \Closure $drop) { $this->pid=getmypid(); }
    public function attach(BigInteger $id): void {
        if ($this->ticket!==null || !$id->isPositive()) throw new \LogicException('Invalid native PHP function');
        $this->ticket=$id;
    }
    private function checkProcess(): void {
        if (getmypid()!==$this->pid) throw new \LogicException('Cannot use an inherited PHP function after fork');
    }
    public function invoke(mixed $value): mixed {
        $this->checkProcess();
        if ($this->ticket===null) throw new \LogicException('Returned PHP function is closed');
        return ($this->call)($this->ticket,$value);
    }
    public function close(): void {
        $this->checkProcess();
        if ($this->ticket!==null) {
            // Commit inside the native frame, before a PHP destructor can
            // re-enter. A rejected foreign Fiber must leave the ticket live.
            ($this->drop)($this->ticket,function(): void { $this->ticket=null; });
        }
    }
    public function __destruct() {
        if ($this->ticket!==null && getmypid()===$this->pid) FunctionReleases::abandon(fn()=>$this->close());
    }
}
