// Public member calls, independent of generated dispatch names and native tokens.
fn receiver_members() {
    let mut root = new_ticket(&BigUint::from(42u32), "key\0label").unwrap();
    check!(root.serial().unwrap() == BigUint::from(42u32));
    check!(root.get().unwrap().serial().unwrap() == BigUint::from(42u32));
    let label = root.label().unwrap(); check!(label == "key\0label");
    let view = root.retain_ticket().unwrap(); let child = view.retain_ticket().unwrap();
    let mut kept = child.retain().unwrap();
    root.close(); check!(view.is_closed() && child.is_closed());
    check!(child.serial() == Err(Error::Closed));
    check!(kept.serial().unwrap() == BigUint::from(42u32) && label.len() == 9);

    let mut unrelated = ticket(5); let mut source = ticket(73);
    let chosen = unrelated.choose_ticket(&source).unwrap();
    check!(chosen.serial().unwrap() == BigUint::from(73u32));
    unrelated.close(); check!(chosen.serial().unwrap() == BigUint::from(73u32));
    source.close(); check!(chosen.is_closed() && chosen.serial() == Err(Error::Closed));

    let mut record = copy_value(&sample()).unwrap(); let payload = record.payload().unwrap();
    let primary = record.primary().unwrap(); let echoed = record.echo_record().unwrap();
    let nested = echoed.echo_record().unwrap();
    check!(primary.serial().unwrap() == BigUint::from(7u32));
    check!(payload == data() && nested == record);
    let mut escaped = Ticket::default(); let mut retained = Ticket::default();
    let callback = record.callback_record(|input: Bundle| {
        check!(input.primary.serial()? == BigUint::from(7u32));
        escaped = input.primary.clone(); retained = input.primary.retain()?;
        let own = copy_value(&input)?; let reentered = own.echo_record()?;
        check!(reentered.payload()? == input.payload); Ok(input)
    }).unwrap();
    check!(escaped.is_closed() && retained.serial().unwrap() == BigUint::from(7u32));
    check!(callback == record);
    let closure = record.make_record().unwrap(); let closure_kept = closure.retain().unwrap();
    check!(closure.call(true, &sample()).unwrap().payload().unwrap() == payload);
    record.close(); check!(primary.is_closed() && nested.is_closed() && callback.is_closed());
    check!(closure.is_closed() && payload == data());
    check!(closure_kept.call(true, &sample()).unwrap().primary().unwrap().serial().unwrap() == BigUint::from(7u32));

    let mut variant = copy_value(&Choice::Many { tickets: vec![] }).unwrap();
    let variant_view = variant.echo_variant().unwrap(); check!(variant == variant_view);
    variant.close(); check!(variant_view.is_closed());
    let mut tree = copy_value(&Tree::Branch { children: vec![] }).unwrap();
    let tree_view = tree.echo_recursive().unwrap();
    let tree_callback = tree.callback_recursive(|value: Tree| Ok(value)).unwrap();
    let tree_closure = tree.make_recursive().unwrap();
    check!(tree_view == tree && tree_callback == tree);
    check!(tree_closure.call(true, tree.get().unwrap()).unwrap() == tree);
    tree.close(); check!(tree_view.is_closed() && tree_callback.is_closed() && tree_closure.is_closed());

    let mut consumed = ticket(0); let consumed_alias = consumed.clone();
    let mixed = kept.mixed_ticket(&mut consumed).unwrap();
    check!(consumed.is_closed() && consumed_alias.is_closed() && mixed == kept);
    let kept_alias = kept.clone(); let kept_view = kept.retain_ticket().unwrap();
    let moved = kept.transfer_ticket().unwrap();
    check!(moved.serial().unwrap() == BigUint::from(42u32));
    check!(kept.is_closed() && kept_alias.is_closed() && kept_view.is_closed() && mixed.is_closed());

    let mut moving = copy_value(&sample()).unwrap(); let old = moving.clone(); let view = moving.echo_record().unwrap();
    let output = moving.move_record(|input: Bundle| {
        check!(old.is_closed() && view.is_closed());
        check!(input.primary.serial()? == BigUint::from(7u32)); Ok(input)
    }).unwrap();
    check!(moving.is_closed());
    check!(output.primary().unwrap().serial().unwrap() == BigUint::from(7u32));
}
