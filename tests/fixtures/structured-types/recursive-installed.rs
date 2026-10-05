// Independent safe Rust caller. Only the installed public crate is imported.
use recursive_api as api;
use api::{BigInt, BigUint, EmptyRecord, Envelope, LeftTree, Marker, RightTree, Scalars, Spine, Tree, Wide};
thread_local! { static CHECKS: std::cell::Cell<usize> = const { std::cell::Cell::new(0) }; }
macro_rules! check { ($expression:expr) => {{ CHECKS.with(|n| n.set(n.get() + 1)); assert!($expression); }}; }
fn payload() -> Scalars {
    let natural = (BigUint::from(1u8) << 128usize) + 1u8;
    Scalars { unit: (), bool_: true, u8: u8::MAX, u16: u16::MAX, u32: u32::MAX, u64: u64::MAX,
        i8: i8::MIN, i16: i16::MIN, i32: i32::MIN, i64: i64::MIN,
        integer: -BigInt::from(natural.clone()), natural, f32: 1.5, f64: -2.25,
        text: "A\0🌱".into(), bytes: vec![0, 255, 1], char_: '🌱', word: u32::MAX.into(), signed_word: i32::MIN.into() }
}
fn main() -> Result<(), api::Error> {
    let mut too_deep = Tree::Branch { children: vec![] };
    for _ in 0..130 { too_deep = Tree::Branch { children: vec![too_deep] }; }
    let leaf = Tree::Leaf { payload: payload() };
    check!(api::join_trees(&leaf, &too_deep) == Err(api::Error::Limit));
    let scalar = payload();
    check!(api::inspect(&scalar)?); check!(api::scalars(&scalar)? == scalar);
    check!(api::word_max(u64::MAX)?); check!(api::signed_min(i64::MIN)?);
    let mut large = scalar.clone(); large.natural = (BigUint::from(1u8) << 1000usize) + 7u8;
    large.integer = -BigInt::from(large.natural.clone());
    check!(api::scalars(&large)? == large);
    let mut empty = scalar.clone(); empty.natural = 0u8.into(); empty.integer = 0u8.into(); empty.text.clear(); empty.bytes.clear();
    check!(api::scalars(&empty)? == empty);
    let mut special = scalar.clone(); special.f32 = f32::NAN; special.f64 = -0.0;
    let copy = api::scalars(&special)?; check!(copy.f32.is_nan()); check!(copy.f64.to_bits() == (-0.0f64).to_bits());
    special.f32 = f32::NEG_INFINITY; special.f64 = f64::INFINITY;
    check!(api::scalars(&special)? == special);

    let tree: api::TreeAlias = Tree::Branch { children: vec![leaf.clone(), Tree::Branch { children: vec![] }] };
    check!(api::tree(&tree)? == tree);
    check!(api::join_trees(&tree, &leaf)? == Tree::Branch { children: vec![tree.clone(), leaf.clone()] });
    check!(api::empty()? == Tree::Branch { children: vec![] });
    let forest: api::Forest = vec![tree.clone(); 512]; check!(api::forest(&forest)? == forest);
    let mut envelope = Envelope { tree: tree.clone(), alternatives: vec![vec![], vec![tree.clone()]], fallback: Some(leaf.clone()),
        outcome: Box::new(Ok((tree.clone(), leaf.clone()))), marker: None };
    for marker in [None, Some(None), Some(Some(()))] {
        envelope.marker = marker; check!(api::envelope(&envelope)? == envelope);
        let mut error = envelope.clone(); error.outcome = Box::new(Err("error\0🌿".into())); error.fallback = None;
        check!(api::envelope(&error)? == error);
    }
    let left = LeftTree::Next { right: RightTree::Many { lefts: vec![LeftTree::Leaf { value: 9 }] } };
    check!(api::left(&left)? == left);
    let right = RightTree::Many { lefts: vec![left] }; check!(api::right(&right)? == right);
    let mut spine = Spine::Leaf { value: 41 };
    for _ in 0..127 { spine = Spine::Next { value: Box::new(spine) }; }
    let mut copy = api::spine(&spine)?; check!(copy == spine);
    let (mut a, mut b) = (&spine, &mut copy);
    for _ in 0..127 {
        check!(!std::ptr::eq(a, b));
        a = match a { Spine::Next { value } => value, _ => panic!("missing input child") };
        b = match b { Spine::Next { value } => value, _ => panic!("missing copied child") };
    }
    match b { Spine::Leaf { value } => *value = 42, _ => panic!("missing leaf") };
    check!(copy != spine);
    check!(api::grow(&spine) == Err(api::Error::Limit));
    check!(api::grow(&Spine::Leaf { value: 7 })? == Spine::Next { value: Box::new(Spine::Leaf { value: 7 }) });
    let wide = Wide::Next { __WIDE_FIELDS__ child: Box::new(Wide::Leaf { value: 17 }) };
    check!(api::wide(&wide)? == wide);
    for marker in [Marker::Empty, Marker::Unit { value: () }, Marker::Next { value: Box::new(Marker::Empty) }] {
        check!(api::marker(&marker)? == marker);
    }
    check!(api::empty_record(&EmptyRecord {})? == EmptyRecord {});
    check!(api::units(&[(); 123])?.len() == 123);
    check!(api::units(&vec![(); 262_144]) == Err(api::Error::Limit));
    for _ in 0..100 { check!(api::envelope(&envelope)? == envelope); }
    std::thread::scope(|scope| {
        for _ in 0..4 { scope.spawn(|| { for _ in 0..25 { assert!(api::inspect(&scalar).unwrap()); } }); }
    });
    let mappings = std::fs::read_to_string("/proc/self/maps").unwrap();
    let paths: std::collections::BTreeSet<_> = mappings.lines().filter_map(|line|
        line.split_whitespace().find(|word| word.starts_with("/tmp/lean-bridge-rust-assets-"))).collect();
    check!(paths.len() == 4);
    for path in paths { check!(!std::path::Path::new(path).parent().unwrap().exists()); }
    println!("recursive-installed-ok:{}", CHECKS.with(|n| n.get()) + 100);
    Ok(())
}
