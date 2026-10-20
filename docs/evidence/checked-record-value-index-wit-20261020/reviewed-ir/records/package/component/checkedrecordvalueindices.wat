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
    (export "ab-string-index" (func (param "value0" $t1) (result $t0)))
    (export "empty-sized-index" (func (param "value0" $t3) (result $t0)))
    (export "empty-string-index" (func (param "value0" $t4) (result $t0)))
    (export "false-bool-index" (func (param "value0" $t5) (result $t0)))
    (export "produce-ab" (func  (result $t1)))
    (export "produce-empty-sized" (func  (result $t3)))
    (export "produce-empty-string" (func (param "value0" $t0) (result $t4)))
    (export "produce-false-bool" (func  (result $t5)))
    (export "produce-true-bool" (func  (result $t6)))
    (export "produce-unicode-string" (func (param "value0" $t0) (result $t7)))
    (export "produce-wide-nat" (func (param "value0" $t0) (result $t8)))
    (export "produce-zero-nat" (func (param "value0" $t0) (result $t9)))
    (export "true-bool-index" (func (param "value0" $t6) (result $t0)))
    (export "unicode-string-index" (func (param "value0" $t7) (result $t0)))
    (export "wide-nat-index" (func (param "value0" $t8) (result $t0)))
    (export "zero-nat-index" (func (param "value0" $t9) (result $t0)))
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
  (alias export $host "ab-string-index" (func $host0))
  (alias export $host "empty-sized-index" (func $host1))
  (alias export $host "empty-string-index" (func $host2))
  (alias export $host "false-bool-index" (func $host3))
  (alias export $host "produce-ab" (func $host4))
  (alias export $host "produce-empty-sized" (func $host5))
  (alias export $host "produce-empty-string" (func $host6))
  (alias export $host "produce-false-bool" (func $host7))
  (alias export $host "produce-true-bool" (func $host8))
  (alias export $host "produce-unicode-string" (func $host9))
  (alias export $host "produce-wide-nat" (func $host10))
  (alias export $host "produce-zero-nat" (func $host11))
  (alias export $host "true-bool-index" (func $host12))
  (alias export $host "unicode-string-index" (func $host13))
  (alias export $host "wide-nat-index" (func $host14))
  (alias export $host "zero-nat-index" (func $host15))
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
  (core func $lower8 (canon lower (func $host8) (memory $memory) (realloc $realloc)))
  (core func $lower9 (canon lower (func $host9) (memory $memory) (realloc $realloc)))
  (core func $lower10 (canon lower (func $host10) (memory $memory) (realloc $realloc)))
  (core func $lower11 (canon lower (func $host11) (memory $memory) (realloc $realloc)))
  (core func $lower12 (canon lower (func $host12) (memory $memory) (realloc $realloc)))
  (core func $lower13 (canon lower (func $host13) (memory $memory) (realloc $realloc)))
  (core func $lower14 (canon lower (func $host14) (memory $memory) (realloc $realloc)))
  (core func $lower15 (canon lower (func $host15) (memory $memory) (realloc $realloc)))
  (core module $forward
    (import "allocation" "realloc" (func $allocate (param i32 i32 i32 i32) (result i32)))
    (import "host" "f0" (func $f0 (param i32 i32 i32) ))
    (import "host" "f1" (func $f1 (param i32 i32 i32) ))
    (import "host" "f2" (func $f2 (param i32 i32 i32) ))
    (import "host" "f3" (func $f3 (param i32 i32 i32) ))
    (import "host" "f4" (func $f4 (param i32) ))
    (import "host" "f5" (func $f5 (param i32) ))
    (import "host" "f6" (func $f6 (param i32 i32 i32) ))
    (import "host" "f7" (func $f7 (param i32) ))
    (import "host" "f8" (func $f8 (param i32) ))
    (import "host" "f9" (func $f9 (param i32 i32 i32) ))
    (import "host" "f10" (func $f10 (param i32 i32 i32) ))
    (import "host" "f11" (func $f11 (param i32 i32 i32) ))
    (import "host" "f12" (func $f12 (param i32 i32 i32) ))
    (import "host" "f13" (func $f13 (param i32 i32 i32) ))
    (import "host" "f14" (func $f14 (param i32 i32 i32) ))
    (import "host" "f15" (func $f15 (param i32 i32 i32) ))
    (func (export "f0") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f0
      local.get $result
    )
    (func (export "f1") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
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
    (func (export "f3") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
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
    (func (export "f5")  (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))

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
    (func (export "f7")  (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))

      local.get $result
      call $f7
      local.get $result
    )
    (func (export "f8")  (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))

      local.get $result
      call $f8
      local.get $result
    )
    (func (export "f9") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f9
      local.get $result
    )
    (func (export "f10") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f10
      local.get $result
    )
    (func (export "f11") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f11
      local.get $result
    )
    (func (export "f12") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f12
      local.get $result
    )
    (func (export "f13") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f13
      local.get $result
    )
    (func (export "f14") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f14
      local.get $result
    )
    (func (export "f15") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f15
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
    (export "f8" (func $lower8))
    (export "f9" (func $lower9))
    (export "f10" (func $lower10))
    (export "f11" (func $lower11))
    (export "f12" (func $lower12))
    (export "f13" (func $lower13))
    (export "f14" (func $lower14))
    (export "f15" (func $lower15))
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
  (alias core export $forwarded "f8" (core func $forward8))
  (alias core export $forwarded "f9" (core func $forward9))
  (alias core export $forwarded "f10" (core func $forward10))
  (alias core export $forwarded "f11" (core func $forward11))
  (alias core export $forwarded "f12" (core func $forward12))
  (alias core export $forwarded "f13" (core func $forward13))
  (alias core export $forwarded "f14" (core func $forward14))
  (alias core export $forwarded "f15" (core func $forward15))
  (func $f0 (param "value0" $public1) (result $public0) (canon lift (core func $forward0) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f1 (param "value0" $public3) (result $public0) (canon lift (core func $forward1) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f2 (param "value0" $public4) (result $public0) (canon lift (core func $forward2) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f3 (param "value0" $public5) (result $public0) (canon lift (core func $forward3) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f4  (result $public1) (canon lift (core func $forward4) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f5  (result $public3) (canon lift (core func $forward5) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f6 (param "value0" $public0) (result $public4) (canon lift (core func $forward6) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f7  (result $public5) (canon lift (core func $forward7) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f8  (result $public6) (canon lift (core func $forward8) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f9 (param "value0" $public0) (result $public7) (canon lift (core func $forward9) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f10 (param "value0" $public0) (result $public8) (canon lift (core func $forward10) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f11 (param "value0" $public0) (result $public9) (canon lift (core func $forward11) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f12 (param "value0" $public6) (result $public0) (canon lift (core func $forward12) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f13 (param "value0" $public7) (result $public0) (canon lift (core func $forward13) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f14 (param "value0" $public8) (result $public0) (canon lift (core func $forward14) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f15 (param "value0" $public9) (result $public0) (canon lift (core func $forward15) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (instance $public
    (export "ab-string-index" (func $f0))
    (export "empty-sized-index" (func $f1))
    (export "empty-string-index" (func $f2))
    (export "false-bool-index" (func $f3))
    (export "produce-ab" (func $f4))
    (export "produce-empty-sized" (func $f5))
    (export "produce-empty-string" (func $f6))
    (export "produce-false-bool" (func $f7))
    (export "produce-true-bool" (func $f8))
    (export "produce-unicode-string" (func $f9))
    (export "produce-wide-nat" (func $f10))
    (export "produce-zero-nat" (func $f11))
    (export "true-bool-index" (func $f12))
    (export "unicode-string-index" (func $f13))
    (export "wide-nat-index" (func $f14))
    (export "zero-nat-index" (func $f15))
  )
  (export "lean-bridge:checkedrecordvalueindices/api@1.0.0" (instance $public))
)
