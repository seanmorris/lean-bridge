<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;

/** @internal Convert the three-word, little-endian synchronous native ABI. */
final class HostWords {
    private array $buffers=[];
    private Budget $budget;
    public function __construct(private readonly \FFI $ffi) { $this->budget=new Budget(); }
    public function put(string $kind, mixed $v, \FFI\CData $w, int $i): void {
        $bytes=WireValues::input($kind,$v,$this->budget);
        $wide=$kind==='int' || $kind==='nat';
        if ($wide || $kind==='bytes' || $kind==='string') {
            if ($wide) { $w[$i+2]=unpack('q',$bytes)[1]; $bytes=substr($bytes,8); }
            $n=strlen($bytes); $w[$i+1]=$wide?intdiv($n,8):$n;
            if ($n) {
                // Allocate limbs at uint64 alignment; keep the native borrow alive.
                $p=$this->ffi->new('uint64_t['.intdiv($n+7,8).']');
                \FFI::memcpy($p,$bytes,$n); $this->buffers[]=$p;
                $w[$i]=$this->ffi->cast('uintptr_t',\FFI::addr($p[0]))->cdata;
            } else $w[$i]=0;
            return;
        }
        $word=unpack('q',$bytes)[1];
        $mask=match($kind) {'int8'=>255,'int16'=>65535,'int32'=>4294967295,default=>-1};
        $w[$i]=$word & $mask;
    }
    public function get(string $kind, \FFI\CData $w, int $i): mixed {
        $word=$w[$i]; $n=$w[$i+1]; $sign=$w[$i+2]; $wide=$kind==='int' || $kind==='nat';
        if (!$wide && $sign!==0) throw new \UnexpectedValueException('Unexpected native host sign');
        if ($wide || $kind==='string' || $kind==='bytes') {
            if ($wide && ($n<0 || $n>851 || ($sign!==0 && $sign!==1))) throw new \UnexpectedValueException('Invalid native host integer');
            $bytes=$wide?$n*8:$n; $this->budget->charge($bytes);
            if ($bytes && (!$word || ($wide && ($word & 7)))) throw new \UnexpectedValueException('Invalid native host buffer');
            $buf=$bytes?\FFI::string($this->ffi->cast('char *',$word),$bytes):'';
            return WireValues::output($kind,'',($wide?pack('q',$sign):'').$buf);
        }
        if ($n!==0) throw new \UnexpectedValueException('Unexpected native host word length');
        $mask=match($kind) {'int8','uint8'=>255,'int16','uint16'=>65535,'int32','uint32','float32'=>4294967295,default=>-1};
        if ($mask!==-1 && ($word & ~$mask)!==0) throw new \UnexpectedValueException('Invalid native host word');
        if (in_array($kind,['int8','int16','int32'],true) && $word>intdiv($mask,2)) $word|=~$mask;
        return WireValues::output($kind,'',pack('q',$word));
    }
}
