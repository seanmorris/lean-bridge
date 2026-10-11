(component
  (type $api (instance
    (type $limbs (list u32))
    (type $base0 (list u32))
    (export "bridge-value-0" (type $t0 (eq $base0)))
    (type $base1 (option $t0))
    (export "bridge-value-1" (type $t1 (eq $base1)))
    (type $base2 (list $t1))
    (export "bridge-value-2" (type $t2 (eq $base2)))
    (type $base3 (tuple $t2 $t2))
    (export "bridge-value-3" (type $t3 (eq $base3)))
    (type $base4 (list $t0))
    (export "bridge-value-4" (type $t4 (eq $base4)))
    (type $base6 (result $t0 (error string)))
    (export "bridge-value-6" (type $t6 (eq $base6)))
    (type $base8 (tuple u8 $t0))
    (export "bridge-value-8" (type $t8 (eq $base8)))
    (type $base9 (option $t8))
    (export "bridge-value-9" (type $t9 (eq $base9)))
    (type $base10 (list $t9))
    (export "bridge-value-10" (type $t10 (eq $base10)))
    (type $base11 (list $t0))
    (export "bridge-value-11" (type $t11 (eq $base11)))
    (type $base12 (tuple $t0 $t0))
    (export "bridge-value-12" (type $t12 (eq $base12)))
    (type $base13 (option $t12))
    (export "bridge-value-13" (type $t13 (eq $base13)))
    (type $base14 (list $t13))
    (export "bridge-value-14" (type $t14 (eq $base14)))
    (type $base15 (list $t14))
    (export "bridge-value-15" (type $t15 (eq $base15)))
    (type $base16 (tuple $t0 string))
    (export "bridge-value-16" (type $t16 (eq $base16)))
    (export "alias-arguments" (func (param "value0" $t2) (param "value1" $t2) (result $t2)))
    (export "alias-pair" (func (param "value0" $t3) (result $t3)))
    (export "arrays" (func (param "value0" $t4) (result $t4)))
    (export "branch" (func (param "value0" $t6) (result $t6)))
    (export "byte-branches" (func (param "value0" $t10) (result $t10)))
    (export "lists" (func (param "value0" $t11) (result $t11)))
    (export "nested" (func (param "value0" $t15) (result $t0)))
    (export "options" (func (param "value0" $t1) (result $t1)))
    (export "plain-fin" (func (param "value0" $t2) (result $t0)))
    (export "product" (func (param "value0" $t16) (result $t16)))
    (export "scalar" (func (param "value0" $t0) (result $t0)))
    (export "specialized" (func (param "value0" $t11) (result $t11)))
  ))
  (import "lean-bridge:structuralsubtypes/native@1.0.0" (instance $host (type $api)))
  (alias export $host "bridge-value-0" (type $public0))
  (alias export $host "bridge-value-1" (type $public1))
  (alias export $host "bridge-value-2" (type $public2))
  (alias export $host "bridge-value-3" (type $public3))
  (alias export $host "bridge-value-4" (type $public4))
  (alias export $host "bridge-value-6" (type $public6))
  (alias export $host "bridge-value-8" (type $public8))
  (alias export $host "bridge-value-9" (type $public9))
  (alias export $host "bridge-value-10" (type $public10))
  (alias export $host "bridge-value-11" (type $public11))
  (alias export $host "bridge-value-12" (type $public12))
  (alias export $host "bridge-value-13" (type $public13))
  (alias export $host "bridge-value-14" (type $public14))
  (alias export $host "bridge-value-15" (type $public15))
  (alias export $host "bridge-value-16" (type $public16))
  (alias export $host "alias-arguments" (func $host0))
  (alias export $host "alias-pair" (func $host1))
  (alias export $host "arrays" (func $host2))
  (alias export $host "branch" (func $host3))
  (alias export $host "byte-branches" (func $host4))
  (alias export $host "lists" (func $host5))
  (alias export $host "nested" (func $host6))
  (alias export $host "options" (func $host7))
  (alias export $host "plain-fin" (func $host8))
  (alias export $host "product" (func $host9))
  (alias export $host "scalar" (func $host10))
  (alias export $host "specialized" (func $host11))
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
  (core module $forward
    (import "allocation" "realloc" (func $allocate (param i32 i32 i32 i32) (result i32)))
    (import "host" "f0" (func $f0 (param i32 i32 i32 i32 i32) ))
    (import "host" "f1" (func $f1 (param i32 i32 i32 i32 i32) ))
    (import "host" "f2" (func $f2 (param i32 i32 i32) ))
    (import "host" "f3" (func $f3 (param i32 i32 i32 i32) ))
    (import "host" "f4" (func $f4 (param i32 i32 i32) ))
    (import "host" "f5" (func $f5 (param i32 i32 i32) ))
    (import "host" "f6" (func $f6 (param i32 i32 i32) ))
    (import "host" "f7" (func $f7 (param i32 i32 i32 i32) ))
    (import "host" "f8" (func $f8 (param i32 i32 i32) ))
    (import "host" "f9" (func $f9 (param i32 i32 i32 i32 i32) ))
    (import "host" "f10" (func $f10 (param i32 i32 i32) ))
    (import "host" "f11" (func $f11 (param i32 i32 i32) ))
    (func (export "f0") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      local.get $result
      call $f0
      local.get $result
    )
    (func (export "f1") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 16)))
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
    (func (export "f3") (param i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 12)))
      local.get 0
      local.get 1
      local.get 2
      local.get $result
      call $f3
      local.get $result
    )
    (func (export "f4") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
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
    (func (export "f7") (param i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 12)))
      local.get 0
      local.get 1
      local.get 2
      local.get $result
      call $f7
      local.get $result
    )
    (func (export "f8") (param i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $result
      call $f8
      local.get $result
    )
    (func (export "f9") (param i32 i32 i32 i32) (result i32) (local $result i32)
      (local.set $result (call $allocate (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 16)))
      local.get 0
      local.get 1
      local.get 2
      local.get 3
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
  (func $f0 (param "value0" $public2) (param "value1" $public2) (result $public2) (canon lift (core func $forward0) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f1 (param "value0" $public3) (result $public3) (canon lift (core func $forward1) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f2 (param "value0" $public4) (result $public4) (canon lift (core func $forward2) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f3 (param "value0" $public6) (result $public6) (canon lift (core func $forward3) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f4 (param "value0" $public10) (result $public10) (canon lift (core func $forward4) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f5 (param "value0" $public11) (result $public11) (canon lift (core func $forward5) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f6 (param "value0" $public15) (result $public0) (canon lift (core func $forward6) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f7 (param "value0" $public1) (result $public1) (canon lift (core func $forward7) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f8 (param "value0" $public2) (result $public0) (canon lift (core func $forward8) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f9 (param "value0" $public16) (result $public16) (canon lift (core func $forward9) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f10 (param "value0" $public0) (result $public0) (canon lift (core func $forward10) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (func $f11 (param "value0" $public11) (result $public11) (canon lift (core func $forward11) (memory $memory) (realloc $realloc) (post-return $post-i32)))
  (instance $public
    (export "alias-arguments" (func $f0))
    (export "alias-pair" (func $f1))
    (export "arrays" (func $f2))
    (export "branch" (func $f3))
    (export "byte-branches" (func $f4))
    (export "lists" (func $f5))
    (export "nested" (func $f6))
    (export "options" (func $f7))
    (export "plain-fin" (func $f8))
    (export "product" (func $f9))
    (export "scalar" (func $f10))
    (export "specialized" (func $f11))
  )
  (export "lean-bridge:structuralsubtypes/api@1.0.0" (instance $public))
)
