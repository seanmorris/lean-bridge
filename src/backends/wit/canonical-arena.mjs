/** @file Bounded allocator for a canonical future producer’s linear memory. */
// 0..7: waitable event; 12: transient allocation list; 64..: factory result;
// bins: 256..384; rows start at 1024. No pointers into other stores or C heaps.
/**
 * Emit the producer's realloc and per-writer release operations.
 *
 * @param heap - Aligned start of heap storage after all writer rows.
 * @param pages - Initial linear-memory size in Wasm pages.
 */
export const canonicalArena=(heap,pages)=>`(core module $mem
    (memory (export "m") ${pages} 4096)
    (global $top (mut i32) (i32.const ${heap}))
    (global $group (mut i32) (i32.const 12))
    (func (export "select") (param $g i32) (global.set $group (local.get $g)))
    (func (export "release") (param $g i32) (local $p i32) (local $next i32) (local $bin i32)
      (local.set $p (i32.load (local.get $g))) (i32.store (local.get $g) (i32.const 0))
      (block $done (loop $free (br_if $done (i32.eqz (local.get $p)))
        (local.set $next (i32.load offset=4 (local.get $p))) (local.set $bin (i32.load (local.get $p)))
        (i32.store offset=4 (local.get $p) (i32.load (local.get $bin))) (i32.store (local.get $bin) (local.get $p))
        (local.set $p (local.get $next)) (br $free))))
    (func (export "realloc") (param $old i32) (param $len i32) (param $align i32) (param $n i32) (result i32)
      (local $k i32) (local $bin i32) (local $p i32) (local $end i32) (local $need i32)
      (if (i32.eqz (local.get $n)) (then (return (i32.const 0))))
      (if (i32.or (i32.gt_u (local.get $n) (i32.const 16777216)) (i32.gt_u (local.get $align) (i32.const 16))) (then unreachable))
      (if (i32.and (i32.ne (local.get $old) (i32.const 0)) (i32.le_u (local.get $n) (local.get $len))) (then (return (local.get $old))))
      (local.set $k (i32.sub (i32.const 32) (i32.clz (i32.add (local.get $n) (i32.const 15)))))
      (local.set $bin (i32.add (i32.const 256) (i32.shl (local.get $k) (i32.const 2))))
      (local.set $p (i32.load (local.get $bin)))
      (if (local.get $p) (then (i32.store (local.get $bin) (i32.load offset=4 (local.get $p))))
        (else (local.set $p (global.get $top))
          (local.set $end (i32.add (local.get $p) (i32.shl (i32.const 1) (local.get $k))))
          (local.set $need (i32.shr_u (i32.add (local.get $end) (i32.const 65535)) (i32.const 16)))
          (if (i32.gt_u (local.get $need) (memory.size)) (then
            (if (i32.eq (memory.grow (i32.sub (local.get $need) (memory.size))) (i32.const -1)) (then unreachable))))
          (global.set $top (local.get $end)) (i32.store (local.get $p) (local.get $bin))))
      (i32.store offset=4 (local.get $p) (i32.load (global.get $group))) (i32.store (global.get $group) (local.get $p))
      (local.set $p (i32.add (local.get $p) (i32.const 16)))
      (if (local.get $old) (then (memory.copy (local.get $p) (local.get $old) (local.get $len))))
      (local.get $p)))`;
