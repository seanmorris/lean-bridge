<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;

/** @internal Only private methods of the verified component transport use this trait. */
trait LeaseCodec {
    private const LEDGER = '__LB_LEDGER__';
    private const LEASES = __LB_LEASES__;
    private static function encoded(string $kind,mixed $v,Budget $budget): string {
        $spec=self::LEASES[$kind]??null;
        if ($spec===null) return WireValues::input($kind,$v,$budget);
        if (!is_object($v) || $v::class!==$spec[0]) throw new \TypeError('Expected the matching Lean resource type');
        $budget->charge(16);
        $ledger=self::LEDGER;
        $get=\Closure::bind(static fn($o)=>$o->bits($ledger),null,\LeanBridge\HeapV1\Lease::class);
        return $get($v);
    }
    private static function adopted(\FFI $ffi,\FFI\CData $out): \LeanBridge\HeapV1\Lease {
        $tag=$out->lease[3];
        $spec=null;
        foreach (self::LEASES as $entry) if ($entry[1]===$tag) { $spec=$entry; break; }
        if ($spec===null || !$out->lease[0] || !$out->lease[1] || $out->lease[2] || $out->length)
            throw new \UnexpectedValueException('Invalid Lean resource result');
        [$class,,$same,$retain]=$spec;
        $ptr=static fn()=>\FFI::addr($out->lease[0]);
        $read=static fn()=>\FFI::string($ptr(),16);
        $dispose=static fn()=>$ffi->__LB_DISPOSE__(\FFI::addr($out));
        $copy=static function() use ($ffi,$retain,$ptr,$tag) {
            $other=$ffi->new('lbphp_buffer');
            if ($ffi->$retain($ptr(),\FFI::addr($other->lease[0]))!==0) throw new \__LB_PUBLIC__\LeanBridgeError('Cannot retain this Lean resource');
            $other->lease[3]=$tag;
            try { return self::adopted($ffi,$other); }
            catch (\Throwable $error) { $ffi->__LB_DISPOSE__(\FFI::addr($other)); throw $error; }
        };
        $compare=static function(string $bits) use ($ffi,$same,$ptr) {
            $other=$ffi->new('uint64_t[2]'); \FFI::memcpy($other,$bits,16);
            $equal=$ffi->new('uint8_t');
            if ($ffi->$same($ptr(),\FFI::addr($other[0]),\FFI::addr($equal))!==0)
                throw new \__LB_PUBLIC__\LeanBridgeError('Cannot compare this Lean resource');
            return (bool)$equal->cdata;
        };
        $ledger=self::LEDGER;
        $make=\Closure::bind(static fn()=>new $class(getmypid(),$ledger,$read,$dispose,$copy,$compare),null,\LeanBridge\HeapV1\Lease::class);
        return $make();
    }
    private static function decoded(string|array $shape,string $tags,mixed $value): mixed {
        if (is_object($value)) {
            if (!is_string($shape) || (self::LEASES[$shape][0]??null)!==$value::class) throw new \UnexpectedValueException('Unexpected Lean resource');
            return $value;
        }
        if (is_string($shape) && isset(self::LEASES[$shape])) throw new \UnexpectedValueException('Missing Lean resource');
        return WireValues::output($shape,$tags,$value);
    }
}
