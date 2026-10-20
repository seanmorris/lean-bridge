(component
  (type $api (instance
    (type $limbs (list u32))
    (type $base0 (list u32))
    (export "bridge-value-0" (type $t0 (eq $base0)))
    (type $base1 (record (field "size" $t0)))
    (export "ab" (type $t1 (eq $base1)))
    (type $base2 (list $t0))
    (export "bridge-value-2" (type $t2 (eq $base2)))
    (type $base3 (record (field "data" $t2)))
    (export "empty-sized" (type $t3 (eq $base3)))
    (type $base4 (record (field "count" $t0)))
    (export "empty-token" (type $t4 (eq $base4)))
    (type $base5 (record (field "count" $t0)))
    (export "off" (type $t5 (eq $base5)))
    (type $base6 (record (field "count" $t0)))
    (export "on" (type $t6 (eq $base6)))
    (type $base7 (record (field "count" $t0)))
    (export "unicode-token" (type $t7 (eq $base7)))
    (type $base8 (record (field "count" $t0)))
    (export "wide-token" (type $t8 (eq $base8)))
    (type $base9 (record (field "count" $t0)))
    (export "zero-token" (type $t9 (eq $base9)))
    (export "produce-ab" (func  (result $t1)))
    (export "produce-empty-sized" (func  (result $t3)))
    (export "produce-empty-string" (func (param "value0" $t0) (result $t4)))
    (export "produce-false-bool" (func  (result $t5)))
    (export "produce-true-bool" (func  (result $t6)))
    (export "produce-unicode-string" (func (param "value0" $t0) (result $t7)))
    (export "produce-wide-nat" (func (param "value0" $t0) (result $t8)))
    (export "produce-zero-nat" (func (param "value0" $t0) (result $t9)))
  ))
  (import "lean-bridge:checkedrecordvalueindices/native@1.0.0" (instance $host (type $api)))
  (alias export $host "bridge-value-0" (type $public0))
  (alias export $host "ab" (type $public1))
  (alias export $host "bridge-value-2" (type $public2))
  (alias export $host "empty-sized" (type $public3))
  (alias export $host "empty-token" (type $public4))
  (alias export $host "off" (type $public5))
  (alias export $host "on" (type $public6))
  (alias export $host "unicode-token" (type $public7))
  (alias export $host "wide-token" (type $public8))
  (alias export $host "zero-token" (type $public9))
  (alias export $host "produce-ab" (func $host0))
  (alias export $host "produce-empty-sized" (func $host1))
  (alias export $host "produce-empty-string" (func $host2))
  (alias export $host "produce-false-bool" (func $host3))
  (alias export $host "produce-true-bool" (func $host4))
  (alias export $host "produce-unicode-string" (func $host5))
  (alias export $host "produce-wide-nat" (func $host6))
  (alias export $host "produce-zero-nat" (func $host7))
  (core module $allocator
    (memory (export "memory") 1 1024)
    (global $heap (mut i32) (i32.const 16))
    (func (export "realloc") (param $old i32) (param $old-size i32) (param $alignment i32) (param $size i32) (result i32)
      (local $start i32) (local $end i32) (local $pages i32)
      (if (i32.eqz (local.get $size)) (then (return (i32.const 0))))
      (local.set $start (i32.and
        (i32.add (global.get $heap) (i32.sub (local.get $alignment) (i32.const 1)))
        (i32.sub (i32.const 0) (local.get $alignment))))
      (local.set $end (i32.add (local.get $start) (local.get $size)))
      (if (i32.or (i32.lt_u (local.get $end) (local.get $start)) (i32.gt_u (local.get $end) (i32.const 67108864))) (then unreachable))
      (local.set $pages (i32.shr_u (i32.add (local.get $end) (i32.const 65535)) (i32.const 16)))
      (if (i32.gt_u (local.get $pages) (memory.size))
        (then (if (i32.eq (memory.grow (i32.sub (local.get $pages) (memory.size))) (i32.const -1)) (then unreachable))))
      (if (local.get $old)
        (then (memory.copy (local.get $start) (local.get $old)
          (select (local.get $old-size) (local.get $size) (i32.lt_u (local.get $old-size) (local.get $size))))))
      (global.set $heap (local.get $end))
      (local.get $start))
    (func (export "post-i32") (param i32) (global.set $heap (i32.const 16)))
    (func (export "post-i64") (param i64) (global.set $heap (i32.const 16)))
    (func (export "post-f32") (param f32) (global.set $heap (i32.const 16)))
    (func (export "post-f64") (param f64) (global.set $heap (i32.const 16)))
  )
  (core instance $allocation (instantiate $allocator))
  (alias core export $allocation "memory" (core memory $memory))
  (alias core export $allocation "realloc" (core func $realloc))
  (alias core export $allocation "post-i32" (core func $post-i32))
  (alias core export $allocation "post-i64" (core func $post-i64))
  (alias core export $allocation "post-f32" (core func $post-f32))
  (alias core export $allocation "post-f64" (core func $post-f64))
  (core func $lower0 (canon lower (func $host0) (memory $memory) (realloc $realloc)))
  (core func $lower1 (canon lower (func $host1) (memory $memory) (realloc $realloc)))
  (core func $lower2 (canon lower (func $host2) (memory $memory) (realloc $realloc)))
  (core func $lower3 (canon lower (func $host3) (memory $memory) (realloc $realloc)))
  (core func $lower4 (canon lower (func $host4) (memory $memory) (realloc $realloc)))
  (core func $lower5 (canon lower (func $host5) (memory $memory) (realloc $realloc)))
  (core func $lower6 (canon lower (func $host6) (memory $memory) (realloc $realloc)))
  (core func $lower7 (canon lower (func $host7) (memory $memory) (realloc $realloc)))
  (core module $forward
    (import "allocation" "realloc" (func $allocate (param i32 i32 i32 i32) (result i32)))
    (import "host" "f0" (func $f0 (param i32) ))
    (import "host" "f1" (func $f1 (param i32) ))
    (import "host" "f2" (func $f2 (param i32 i32 i32) ))
    (import "host" "f3" (func $f3 (param i32) ))
    (import "host" "f4" (func $f4 (param i32) ))
    (import "host" "f5" (func $f5 (param i32 i32 i32) ))
    (import "host" "f6" (func $f6 (param i32 i32 i32) ))
    (import "host" "f7" (func $f7 (param i32 i32 i32) ))
    (func (export "f0")  (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))

      local.get $result
      call $f0
      local.get $result
    )
    (func (export "f1")  (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))

      local.get $result
      call $f1
      local.get $result
    )
    (func (export "f2") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f2
      local.get $result
    )
    (func (export "f3")  (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))

      local.get $result
      call $f3
      local.get $result
    )
    (func (export "f4")  (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))

      local.get $result
      call $f4
      local.get $result
    )
    (func (export "f5") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f5
      local.get $result
    )
    (func (export "f6") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f6
      local.get $result
    )
    (func (export "f7") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f7
      local.get $result
    )
  )
  (core instance $imports
    (export "f0" (func $lower0))
    (export "f1" (func $lower1))
    (export "f2" (func $lower2))
    (export "f3" (func $lower3))
    (export "f4" (func $lower4))
    (export "f5" (func $lower5))
    (export "f6" (func $lower6))
    (export "f7" (func $lower7))
  )
  (core instance $forwarded (instantiate $forward (with "allocation" (instance $allocation)) (with "host" (instance $imports))))
  (alias core export $forwarded "f0" (core func $forward0))
  (alias core export $forwarded "f1" (core func $forward1))
  (alias core export $forwarded "f2" (core func $forward2))
  (alias core export $forwarded "f3" (core func $forward3))
  (alias core export $forwarded "f4" (core func $forward4))
  (alias core export $forwarded "f5" (core func $forward5))
  (alias core export $forwarded "f6" (core func $forward6))
  (alias core export $forwarded "f7" (core func $forward7))
  (func $f0  (result $public1) (canon lift (core func $forward0) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f1  (result $public3) (canon lift (core func $forward1) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f2 (param "value0" $public0) (result $public4) (canon lift (core func $forward2) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f3  (result $public5) (canon lift (core func $forward3) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f4  (result $public6) (canon lift (core func $forward4) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f5 (param "value0" $public0) (result $public7) (canon lift (core func $forward5) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f6 (param "value0" $public0) (result $public8) (canon lift (core func $forward6) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f7 (param "value0" $public0) (result $public9) (canon lift (core func $forward7) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (instance $public
    (export "produce-ab" (func $f0))
    (export "produce-empty-sized" (func $f1))
    (export "produce-empty-string" (func $f2))
    (export "produce-false-bool" (func $f3))
    (export "produce-true-bool" (func $f4))
    (export "produce-unicode-string" (func $f5))
    (export "produce-wide-nat" (func $f6))
    (export "produce-zero-nat" (func $f7))
  )
  (export "lean-bridge:checkedrecordvalueindices/api@1.0.0" (instance $public))
)
