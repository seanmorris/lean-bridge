fn scalars() -> Scalars {
    let natural = (BigUint::from(1u8) << 1000usize) + 7u8;
    Scalars { unit: (), bool_: true, u8: u8::MAX, u16: u16::MAX,
        u32: u32::MAX, u64: u64::MAX, i8: i8::MIN, i16: i16::MIN,
        i32: i32::MIN, i64: i64::MIN, integer: -BigInt::from(natural.clone()), natural,
        f32: f32::INFINITY, f64: -0.0, text: "a\0🌿".into(), bytes: vec![0, 255, 128],
        char_: '🌿', word: u64::MAX, signed_word: i64::MIN }
}

#[test]
fn primitive_values_and_tree_copies() {
    let payload = scalars();
    assert_eq!(payload.natural.bits(), 1001);
    assert_eq!(payload.integer, -BigInt::from(payload.natural.clone()));
    assert_eq!(payload.f64.to_bits(), (-0.0f64).to_bits());
    assert_eq!(payload.char_, '🌿');
    assert_eq!(payload.text.as_bytes()[1], 0);
    let tree = Tree::Branch { children: vec![Tree::Leaf { payload: payload.clone() }] };
    let forest: Forest = vec![tree.clone()];
    let mut alias: TreeAlias = tree.clone();
    assert_eq!(forest[0], tree);
    if let Tree::Branch { children } = &mut alias {
        if let Tree::Leaf { payload } = &mut children[0] { payload.text.clear(); }
        else { panic!("leaf") }
    } else { panic!("branch") }
    assert_ne!(alias, tree);
    if let Tree::Branch { children } = tree {
        if let Tree::Leaf { payload: value } = &children[0] { assert_eq!(*value, payload); }
        else { panic!("leaf") }
    } else { panic!("branch") }
}

#[test]
fn direct_recursive_ownership() {
    let mut source = Spine::Leaf { value: 41 };
    for _ in 0..127 { source = Spine::Next { value: Box::new(source) }; }
    let mut copy = source.clone();
    assert_eq!(copy, source);
    let mut left = &source;
    let mut right = &mut copy;
    for _ in 0..127 {
        assert!(!std::ptr::eq(left, right));
        if let (Spine::Next { value: a }, Spine::Next { value: b }) = (left, right) {
            left = a; right = b;
        } else { panic!("depth") }
    }
    assert_eq!(*left, Spine::Leaf { value: 41 });
    *right = Spine::Leaf { value: 42 };
    assert_ne!(source, copy);
}

#[test]
fn containers_keep_distinct_constructors() {
    let leaf = Tree::Leaf { payload: scalars() };
    let mut envelope = Envelope { tree: leaf.clone(), alternatives: vec![vec![leaf.clone()]],
        fallback: Some(leaf.clone()), outcome: Box::new(Ok((leaf.clone(), leaf))), marker: None };
    let absent = envelope.clone();
    envelope.marker = Some(None);
    assert_ne!(envelope, absent);
    let some_none = envelope.clone();
    envelope.marker = Some(Some(()));
    assert_ne!(envelope, some_none);
    let some_unit = envelope.clone();
    envelope.outcome = Box::new(Err("domain error\0🌿".into()));
    assert_ne!(envelope, some_unit);
    assert_ne!(Marker::Empty, Marker::Unit { value: () });
    let next = Marker::Next { value: Box::new(Marker::Unit { value: () }) };
    assert_eq!(next, next.clone());
    assert_eq!(EmptyRecord {}, EmptyRecord {});
}

#[test]
fn mutually_recursive_values() {
    let value = LeftTree::Next { right: RightTree::Many { lefts: vec![LeftTree::Leaf { value: 9 }] } };
    assert_eq!(value, value.clone());
    let mut copy = value.clone();
    if let LeftTree::Next { right: RightTree::Many { lefts } } = &mut copy { lefts.clear(); }
    else { panic!("next") }
    assert_ne!(copy, value);
}

#[test]
fn optional_recursive_record() {
    let value = linked::Link { next: Some(Box::new(linked::Link { next: None, value: 1 })), value: 2 };
    let mut copy = value.clone();
    assert_eq!(copy, value);
    copy.next.as_mut().unwrap().value = 3;
    assert_ne!(copy, value);
    assert_eq!(value.next.unwrap().value, 1);
}
