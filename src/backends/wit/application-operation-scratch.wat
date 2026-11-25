;; One bounded temporary heap per facade. Post-return runs after the caller
;; has lifted the reply, never before. Nested calls must not discard outer
;; strings, lists, argument records or result areas.
(memory (export "cm32p2_memory") 1 1024)
(global $heap (mut i32) (i32.const 272))
(global $depth (mut i32) (i32.const 0))
(func $enter
  (if (i32.ge_u (global.get $depth) (i32.const 64)) (then unreachable))
  (i32.store (i32.shl (global.get $depth) (i32.const 2)) (global.get $heap))
  (global.set $depth (i32.add (global.get $depth) (i32.const 1))))
(func $leave
  (if (i32.eqz (global.get $depth)) (then unreachable))
  (global.set $depth (i32.sub (global.get $depth) (i32.const 1)))
  (global.set $heap (if (result i32) (global.get $depth)
    (then (i32.load (i32.shl (global.get $depth) (i32.const 2))))
    (else (i32.const 272)))))
(func $alloc (export "cm32p2_realloc") (param $old i32) (param $old-size i32) (param $alignment i32) (param $size i32) (result i32)
  (local $p i32) (local $end i32) (local $pages i32)
  (if (i32.eqz (local.get $size)) (then (return (i32.const 0))))
  (if (i32.gt_u (local.get $size) (i32.const 16777216)) (then unreachable))
  (local.set $p (i32.and (i32.add (global.get $heap) (i32.sub (local.get $alignment) (i32.const 1))) (i32.sub (i32.const 0) (local.get $alignment))))
  (local.set $end (i32.add (local.get $p) (local.get $size)))
  (if (i32.or (i32.lt_u (local.get $end) (local.get $p)) (i32.gt_u (local.get $end) (i32.const 67108864))) (then unreachable))
  (local.set $pages (i32.shr_u (i32.add (local.get $end) (i32.const 65535)) (i32.const 16)))
  (if (i32.gt_u (local.get $pages) (memory.size)) (then
    (if (i32.eq (memory.grow (i32.sub (local.get $pages) (memory.size))) (i32.const -1)) (then unreachable))))
  (if (local.get $old) (then (memory.copy (local.get $p) (local.get $old)
    (select (local.get $old-size) (local.get $size) (i32.lt_u (local.get $old-size) (local.get $size))))))
  (global.set $heap (local.get $end)) (local.get $p))
