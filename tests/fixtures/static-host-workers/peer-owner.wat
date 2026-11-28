;; Instantiate this component three times. Identically named resources in
;; the defining guest and the two registration providers are distinct types.
(component $definition
  (core module $counts
    (global $n (mut i32) (i32.const 0))
    (func (export "drop") (param i32) (global.set $n (i32.add (global.get $n) (i32.const 1))))
    (func (export "count") (result i32) (global.get $n))
    (func (export "same") (param i32 i32) (result i32) (i32.eq (local.get 0) (local.get 1))))
  (core instance $c (instantiate $counts))
  (type $raw (resource (rep i32) (dtor (func $c "drop")))) (export $r "item" (type $raw))
  (type $fault (resource (rep i32))) (export "fault" (type $fault))
  (core func $new (canon resource.new $raw))
  (func (export "make") (param "id" u32) (result (own $r)) (canon lift (core func $new)))
  (func (export "retain-item") (param "value" (borrow $r)) (result (own $r)) (canon lift (core func $new)))
  (func (export "same-item") (param "left" (borrow $r)) (param "right" (borrow $r)) (result bool) (canon lift (core func $c "same")))
  (func (export "drops") (result u32) (canon lift (core func $c "count"))))
