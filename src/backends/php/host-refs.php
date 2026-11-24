<?php
declare(strict_types=1);
namespace LeanBridge\NativeHostV1;

// All compatible packages use the same process-local tokens. A token is not
// a PHP object ID or a pointer; an old token is never reused for another value.
if (!class_exists(References::class, false)) {
    /** @internal */
    final class References {
        private static int $next=0;
        private static int $depth=0;
        private static ?\Fiber $fiber=null;
        private static ?int $pid=null;
        private static array $strong=[], $weak=[];
        private function __construct() {}
        private static function owner(): void {
            self::$pid ??= getmypid();
            if (self::$pid!==getmypid()) throw new \LogicException('Inherited native PHP host registry');
        }
        public static function hold(object|string $v, bool $weak=false): int {
            self::owner();
            if (self::$next===PHP_INT_MAX) throw new \OverflowException('Native host references exhausted');
            $id=++self::$next;
            if ($weak) self::$weak[$id]=\WeakReference::create($v);
            else self::$strong[$id]=$v;
            return $id;
        }
        public static function get(int $id): object|string|null {
            self::owner();
            if (isset(self::$strong[$id])) return self::$strong[$id];
            if (isset(self::$weak[$id])) return self::$weak[$id]->get();
            throw new \LogicException('Stale private PHP host reference');
        }
        public static function drop(int $id): void {
            self::owner();
            if (!isset(self::$strong[$id]) && !isset(self::$weak[$id])) throw new \LogicException('Duplicate private PHP host release');
            unset(self::$strong[$id],self::$weak[$id]);
        }
        public static function count(): int { self::owner(); return count(self::$strong)+count(self::$weak); }
        public static function enter(): void {
            self::owner();
            $fiber=\Fiber::getCurrent();
            if (self::$depth && self::$fiber!==$fiber) throw new \LogicException('Native PHP host call suspended on another fiber');
            self::$fiber=$fiber; self::$depth++;
        }
        public static function leave(): void { if (--self::$depth===0) self::$fiber=null; }
    }
}
