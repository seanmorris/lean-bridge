use finrecords as api;
use api::{BigUint, Error, Gate, Late, Nest, Shape, Slot, Tile};

fn rejected<T>(result: Result<T, Error>, parameter: &str, bound: &str) -> bool {
    match result {
        Err(Error::Native { code: 1, message }) => message == format!("{parameter} is not below its Fin {bound} bound"),
        _ => false,
    }
}

fn main() {
    let mut checks = 0usize;
    macro_rules! check { ($value:expr) => { assert!($value); checks += 1; }; }
    let n = |value: u64| BigUint::from(value);
    let tile = |digit: BigUint, count: BigUint| Tile { digit, count };
    let huge = n(1) << 100usize;
    // Tile: the digit is Fin 5; any count is valid. Each rejected input is compared with an
    // independently built copy before the caller changes it back.
    for d in 0..5u64 { check!(api::tile_sum(&tile(n(d), n(10))).unwrap() == n(d + 10)); }
    let mut t = tile(n(3), huge.clone());
    check!(api::tile_sum(&t).unwrap() == &huge + n(3));
    t.digit = n(5);
    let before = tile(n(5), huge.clone());
    check!(rejected(api::tile_sum(&t), "arg0.digit", "5") && t == before);
    t.digit = n(1) << 70usize;
    let before = tile(n(1) << 70usize, huge.clone());
    check!(rejected(api::tile_sum(&t), "arg0.digit", "5") && t == before);
    // Nest: the inner record's own bound and the outer bound are both checked.
    let mut nest = Nest { inner: tile(n(4), n(6)), tag: n(2) };
    check!(api::nest_sum(&nest).unwrap() == n(210));
    nest.inner.digit = n(5);
    let before = Nest { inner: tile(n(5), n(6)), tag: n(2) };
    check!(rejected(api::nest_sum(&nest), "arg0.inner.digit", "5") && nest == before);
    nest.inner.digit = n(4);
    nest.tag = n(3);
    let before = Nest { inner: tile(n(4), n(6)), tag: n(3) };
    check!(rejected(api::nest_sum(&nest), "arg0.tag", "3") && nest == before);
    nest.tag = n(2);
    check!(api::nest_sum(&nest).unwrap() == n(210)); // Recovery.
    // Late: heap fields precede the bound; a rejection leaves them as the caller built them.
    let mut late = Late { label: "ab".to_string(), items: vec![n(1), n(2)], digit: n(4) };
    check!(api::late_sum(&late).unwrap() == n(4005));
    late.digit = n(5);
    let before = Late { label: "ab".to_string(), items: vec![n(1), n(2)], digit: n(5) };
    check!(rejected(api::late_sum(&late), "arg0.digit", "5") && late == before);
    late.digit = n(4);
    check!(api::late_sum(&late).unwrap() == n(4005));
    // Slot: Option (Fin 0) is valid only when absent.
    let mut slot = Slot { maybe: None, count: n(8) };
    check!(api::slot_count(&slot).unwrap() == n(8));
    slot.maybe = Some(n(0));
    let before = Slot { maybe: Some(n(0)), count: n(8) };
    check!(rejected(api::slot_count(&slot), "arg0.maybe?", "0") && slot == before);
    // Shape: only the active case is checked.
    let mut shape = Shape::Circle { radius: n(9) };
    check!(api::shape_size(&shape).unwrap() == n(9));
    shape = Shape::Circle { radius: n(10) };
    let before = Shape::Circle { radius: n(10) };
    check!(rejected(api::shape_size(&shape), "arg0.circle.radius", "10") && shape == before);
    shape = Shape::Label { text: "abc".to_string() };
    check!(api::shape_size(&shape).unwrap() == n(1003));
    shape = Shape::Empty;
    check!(api::shape_size(&shape).unwrap() == n(7));
    // Gate: the never case holds Fin 0, so it is always rejected; the closed case is always valid.
    let mut gate = Gate::Closed;
    check!(api::gate_open(&gate).unwrap() == n(1));
    gate = Gate::Never { value: n(0) };
    let before = Gate::Never { value: n(0) };
    check!(rejected(api::gate_open(&gate), "arg0.never.value", "0") && gate == before);
    // Array Tile: every element; the empty array is valid.
    let fresh = || vec![tile(n(0), n(1)), tile(n(4), n(2)), tile(n(1), n(0))];
    let mut row = fresh();
    check!(api::tiles(&[]).unwrap() == n(0));
    check!(api::tiles(&row).unwrap() == n(8));
    for k in 0..row.len() {
        let kept = row[k].digit.clone();
        row[k].digit = n(5);
        let mut before = fresh();
        before[k].digit = n(5);
        check!(rejected(api::tiles(&row), &format!("arg0[{k}].digit"), "5") && row == before);
        row[k].digit = kept;
    }
    check!(api::tiles(&row).unwrap() == n(8));
    // Option Shape: absent, a valid present circle, then an invalid one.
    check!(api::maybe_shape(&None).unwrap() == n(99));
    let mut maybe = Some(Shape::Circle { radius: n(3) });
    check!(api::maybe_shape(&maybe).unwrap() == n(3));
    maybe = Some(Shape::Circle { radius: n(10) });
    let before = Some(Shape::Circle { radius: n(10) });
    check!(rejected(api::maybe_shape(&maybe), "arg0?.circle.radius", "10") && maybe == before);
    // List Tile: every element's fields; a rejected list is unchanged before the caller restores it.
    check!(api::tile_list(&[]).unwrap() == n(0));
    check!(api::tile_list(&row).unwrap() == n(8));
    for k in 0..row.len() {
        let kept = row[k].digit.clone();
        row[k].digit = n(5);
        let mut before = fresh();
        before[k].digit = n(5);
        check!(rejected(api::tile_list(&row), &format!("arg0[{k}].digit"), "5") && row == before);
        row[k].digit = kept;
    }
    check!(api::tile_list(&row).unwrap() == n(8));
    // Tile × Shape: both components; the inactive circle of a label is never read.
    let mut pair = (tile(n(4), n(6)), Shape::Circle { radius: n(9) });
    check!(api::tile_pair(&pair).unwrap() == n(19));
    pair.0.digit = n(5);
    let before = (tile(n(5), n(6)), Shape::Circle { radius: n(9) });
    check!(rejected(api::tile_pair(&pair), "arg0.0.digit", "5") && pair == before);
    pair.0.digit = n(4);
    pair.1 = Shape::Circle { radius: n(10) };
    let before = (tile(n(4), n(6)), Shape::Circle { radius: n(10) });
    check!(rejected(api::tile_pair(&pair), "arg0.1.circle.radius", "10") && pair == before);
    pair.1 = Shape::Circle { radius: n(9) };
    check!(api::tile_pair(&pair).unwrap() == n(19));
    check!(api::tile_pair(&(tile(n(1), n(1)), Shape::Label { text: "ab".to_string() })).unwrap() == n(1004));
    // Except Shape Tile: the ok record or the error variant, only the active branch.
    let mut except: Result<Tile, Shape> = Ok(tile(n(3), n(4)));
    check!(api::tile_except(&except).unwrap() == n(7));
    except = Ok(tile(n(5), n(4)));
    let before: Result<Tile, Shape> = Ok(tile(n(5), n(4)));
    check!(rejected(api::tile_except(&except), "arg0.ok.digit", "5") && except == before);
    check!(api::tile_except(&Err(Shape::Circle { radius: n(9) })).unwrap() == n(509));
    except = Err(Shape::Circle { radius: n(10) });
    let before: Result<Tile, Shape> = Err(Shape::Circle { radius: n(10) });
    check!(rejected(api::tile_except(&except), "arg0.error.circle.radius", "10") && except == before);
    check!(api::tile_except(&Err(Shape::Label { text: "x".to_string() })).unwrap() == n(1501));
    except = Ok(tile(n(3), n(4)));
    check!(api::tile_except(&except).unwrap() == n(7)); // Recovery after both rejections.
    // Results carrying bounds are produced by Lean and arrive below them.
    let mut t = tile(n(4), n(9));
    check!(api::bump(&t).unwrap() == tile(n(0), n(10)));
    t.digit = n(5);
    let before = tile(n(5), n(9));
    check!(rejected(api::bump(&t), "arg0.digit", "5") && t == before);
    check!(api::make_shape(&n(4)).unwrap() == Shape::Circle { radius: n(4) });
    check!(api::make_shape(&n(23)).unwrap() == Shape::Label { text: "23".to_string() });
    for i in 0..1000u64 {
        t = tile(n(i % 5), n(i));
        assert!(api::tile_sum(&t).unwrap() == n(i % 5 + i), "round {i} failed");
        t.digit = n(5 + i);
        assert!(rejected(api::tile_sum(&t), "arg0.digit", "5") && t == tile(n(5 + i), n(i)), "rejection round {i} failed");
    }
    checks += 2000;
    println!("fin-record-ok:{checks}");
}
