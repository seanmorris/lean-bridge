(component
  (type $api (instance
    (type $limbs (list u32))
    (type $base0 (list u32))
    (export "bridge-value-0" (type $t0 (eq $base0)))
    (type $base1 (record (field "digit" $t0) (field "word" $t0)))
    (export "packet" (type $t1 (eq $base1)))
    (type $base2 (list $t1))
    (export "bridge-value-2" (type $t2 (eq $base2)))
    (type $base9 (record (field "value" $t1)))
    (export "choice-packet-fields" (type $t9 (eq $base9)))
    (type $base3 (variant (case "empty") (case "packet" $t9)))
    (export "choice" (type $t3 (eq $base3)))
    (type $base4 (result $t1 (error $t1)))
    (export "bridge-value-4" (type $t4 (eq $base4)))
    (type $base5 (record (field "packet" $t1) (field "tag" $t0)))
    (export "holder" (type $t5 (eq $base5)))
    (type $base6 (list $t1))
    (export "bridge-value-6" (type $t6 (eq $base6)))
    (type $base7 (option $t1))
    (export "bridge-value-7" (type $t7 (eq $base7)))
    (type $base8 (tuple $t1 $t1))
    (export "bridge-value-8" (type $t8 (eq $base8)))
    (export "echo-array" (func (param "value0" $t2) (result $t2)))
    (export "first" (func (param "value0" $t1) (result $t0)))
    (export "in-array" (func (param "value0" $t2) (result $t0)))
    (export "in-choice" (func (param "value0" $t3) (result $t0)))
    (export "in-except" (func (param "value0" $t4) (result $t0)))
    (export "in-holder" (func (param "value0" $t5) (result $t0)))
    (export "in-list" (func (param "value0" $t6) (result $t0)))
    (export "in-option" (func (param "value0" $t7) (result $t0)))
    (export "in-product" (func (param "value0" $t8) (result $t0)))
    (export "pair" (func (param "value0" $t1) (param "value1" $t1) (result $t0)))
    (export "produce-array" (func (param "value0" $t0) (result $t2)))
    (export "produce-option" (func (param "value0" $t0) (result $t7)))
    (export "second" (func (param "value0" $t1) (result $t0)))
  ))
  (import "lean-bridge:nestedcheckedrecords/native@1.0.0" (instance $host (type $api)))
  (alias export $host "bridge-value-0" (type $public0))
  (alias export $host "packet" (type $public1))
  (alias export $host "bridge-value-2" (type $public2))
  (alias export $host "choice-packet-fields" (type $public9))
  (alias export $host "choice" (type $public3))
  (alias export $host "bridge-value-4" (type $public4))
  (alias export $host "holder" (type $public5))
  (alias export $host "bridge-value-6" (type $public6))
  (alias export $host "bridge-value-7" (type $public7))
  (alias export $host "bridge-value-8" (type $public8))
  (alias export $host "echo-array" (func $host0))
  (alias export $host "first" (func $host1))
  (alias export $host "in-array" (func $host2))
  (alias export $host "in-choice" (func $host3))
  (alias export $host "in-except" (func $host4))
  (alias export $host "in-holder" (func $host5))
  (alias export $host "in-list" (func $host6))
  (alias export $host "in-option" (func $host7))
  (alias export $host "in-product" (func $host8))
  (alias export $host "pair" (func $host9))
  (alias export $host "produce-array" (func $host10))
  (alias export $host "produce-option" (func $host11))
  (alias export $host "second" (func $host12))
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
  (core module $forward
    (import "allocation" "realloc" (func $allocate (param i32 i32 i32 i32) (result i32)))
    (import "host" "f0" (func $f0 (param i32 i32 i32) ))
    (import "host" "f1" (func $f1 (param i32 i32 i32 i32 i32) ))
    (import "host" "f2" (func $f2 (param i32 i32 i32) ))
    (import "host" "f3" (func $f3 (param i32 i32 i32 i32 i32 i32) ))
    (import "host" "f4" (func $f4 (param i32 i32 i32 i32 i32 i32) ))
    (import "host" "f5" (func $f5 (param i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f6" (func $f6 (param i32 i32 i32) ))
    (import "host" "f7" (func $f7 (param i32 i32 i32 i32 i32 i32) ))
    (import "host" "f8" (func $f8 (param i32 i32 i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f9" (func $f9 (param i32 i32 i32 i32 i32 i32 i32 i32 i32) ))
    (import "host" "f10" (func $f10 (param i32 i32 i32) ))
    (import "host" "f11" (func $f11 (param i32 i32 i32) ))
    (import "host" "f12" (func $f12 (param i32 i32 i32 i32 i32) ))
    (func (export "f0") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f0
      local.get $result
    )
    (func (export "f1") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
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
    (func (export "f3") (param i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get $result
      call $f3
      local.get $result
    )
    (func (export "f4") (param i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get $result
      call $f4
      local.get $result
    )
    (func (export "f5") (param i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
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
    (func (export "f7") (param i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get $result
      call $f7
      local.get $result
    )
    (func (export "f8") (param i32 i32 i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
      local.get 6
      local.get 7
      local.get $result
      call $f8
      local.get $result
    )
    (func (export "f9") (param i32 i32 i32 i32 i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get 4
      local.get 5
      local.get 6
      local.get 7
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
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 20)))
      local.get 0
      local.get 1
      local.get $result
      call $f11
      local.get $result
    )
    (func (export "f12") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get $result
      call $f12
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
  (func $f0 (param "value0" $public2) (result $public2) (canon lift (core func $forward0) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f1 (param "value0" $public1) (result $public0) (canon lift (core func $forward1) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f2 (param "value0" $public2) (result $public0) (canon lift (core func $forward2) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f3 (param "value0" $public3) (result $public0) (canon lift (core func $forward3) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f4 (param "value0" $public4) (result $public0) (canon lift (core func $forward4) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f5 (param "value0" $public5) (result $public0) (canon lift (core func $forward5) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f6 (param "value0" $public6) (result $public0) (canon lift (core func $forward6) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f7 (param "value0" $public7) (result $public0) (canon lift (core func $forward7) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f8 (param "value0" $public8) (result $public0) (canon lift (core func $forward8) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f9 (param "value0" $public1) (param "value1" $public1) (result $public0) (canon lift (core func $forward9) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f10 (param "value0" $public0) (result $public2) (canon lift (core func $forward10) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f11 (param "value0" $public0) (result $public7) (canon lift (core func $forward11) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f12 (param "value0" $public1) (result $public0) (canon lift (core func $forward12) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (type $public-api (instance
    (alias outer 1 $public0 (type $outer0))
    (export "bridge-value-0" (type $public0 (eq $outer0)))
    (alias outer 1 $public1 (type $outer1))
    (export "packet" (type $public1 (eq $outer1)))
    (alias outer 1 $public2 (type $outer2))
    (export "bridge-value-2" (type $public2 (eq $outer2)))
    (alias outer 1 $public9 (type $outer9))
    (export "choice-packet-fields" (type $public9 (eq $outer9)))
    (alias outer 1 $public3 (type $outer3))
    (export "choice" (type $public3 (eq $outer3)))
    (alias outer 1 $public4 (type $outer4))
    (export "bridge-value-4" (type $public4 (eq $outer4)))
    (alias outer 1 $public5 (type $outer5))
    (export "holder" (type $public5 (eq $outer5)))
    (alias outer 1 $public6 (type $outer6))
    (export "bridge-value-6" (type $public6 (eq $outer6)))
    (alias outer 1 $public7 (type $outer7))
    (export "bridge-value-7" (type $public7 (eq $outer7)))
    (alias outer 1 $public8 (type $outer8))
    (export "bridge-value-8" (type $public8 (eq $outer8)))

    (export "echo-array" (func (param "value0" $public2) (result $public2)))
    (export "first" (func (param "value0" $public1) (result $public0)))
    (export "in-array" (func (param "value0" $public2) (result $public0)))
    (export "in-choice" (func (param "value0" $public3) (result $public0)))
    (export "in-except" (func (param "value0" $public4) (result $public0)))
    (export "in-holder" (func (param "value0" $public5) (result $public0)))
    (export "in-list" (func (param "value0" $public6) (result $public0)))
    (export "in-option" (func (param "value0" $public7) (result $public0)))
    (export "in-product" (func (param "value0" $public8) (result $public0)))
    (export "pair" (func (param "value0" $public1) (param "value1" $public1) (result $public0)))
    (export "produce-array" (func (param "value0" $public0) (result $public2)))
    (export "produce-option" (func (param "value0" $public0) (result $public7)))
    (export "second" (func (param "value0" $public1) (result $public0)))
  ))
  (instance $public
    (export "bridge-value-0" (type $public0))
    (export "packet" (type $public1))
    (export "bridge-value-2" (type $public2))
    (export "choice-packet-fields" (type $public9))
    (export "choice" (type $public3))
    (export "bridge-value-4" (type $public4))
    (export "holder" (type $public5))
    (export "bridge-value-6" (type $public6))
    (export "bridge-value-7" (type $public7))
    (export "bridge-value-8" (type $public8))
    (export "echo-array" (func $f0))
    (export "first" (func $f1))
    (export "in-array" (func $f2))
    (export "in-choice" (func $f3))
    (export "in-except" (func $f4))
    (export "in-holder" (func $f5))
    (export "in-list" (func $f6))
    (export "in-option" (func $f7))
    (export "in-product" (func $f8))
    (export "pair" (func $f9))
    (export "produce-array" (func $f10))
    (export "produce-option" (func $f11))
    (export "second" (func $f12))
  )
  (export "lean-bridge:nestedcheckedrecords/api@1.0.0" (instance $public) (instance (type $public-api)))
)
