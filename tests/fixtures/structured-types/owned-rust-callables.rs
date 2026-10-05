fn callbacks(first: &Ticket, second: &Ticket) {
    let input = bundle_value(first, second);
    let mut escaped = Ticket::default(); let mut kept = Ticket::default();
    let returned = callback_record(&input, |mut value: Bundle| {
        escaped = value.primary.clone(); kept = value.primary.retain()?;
        value.primary = new_ticket(&BigUint::from(91u32), "callback")?;
        value.payload.bytes = vec![9, 8]; Ok(value)
    }).unwrap();
    check!(escaped.is_closed()); check!(serial(&kept).unwrap() == BigUint::from(1u32));
    check!(serial(&returned.primary).unwrap() == BigUint::from(91u32));
    check!(returned.payload.bytes == vec![9, 8]); check!(escaped.retain() == Err(Error::Closed));
    check!(callback_record(&input, |value: Bundle| Ok(value)).unwrap() == input);
    check!(callback_record(&input, |_: Bundle| Err(Error::Native(718))) == Err(Error::Native(718)));
    let old_hook = std::panic::take_hook(); std::panic::set_hook(Box::new(|info| {
        if !info.payload().is::<u32>() && info.payload().downcast_ref::<&str>() != Some(&"injected owned conversion panic") { eprintln!("{info}"); }
    }));
    let expected = baseline();
    let caught = catch_unwind(AssertUnwindSafe(|| callback_record(&input, |_: Bundle| std::panic::panic_any(917u32))));
    check!(*caught.unwrap_err().downcast::<u32>().unwrap() == 917);
    check!(baseline() == expected);
    check!(callback_record(&input, |value: Bundle| {
        let caught = catch_unwind(AssertUnwindSafe(|| callback_record(&value, |_: Bundle| std::panic::panic_any(918u32))));
        check!(*caught.unwrap_err().downcast::<u32>().unwrap() == 918);
        echo_record(&value)
    }).unwrap() == input);
    let mut count = 0u32;
    let mut mutable = |mut value: Bundle| { count += 1; value.payload.count = BigInt::from(count); Ok(value) };
    check!(twice(&input, &mut mutable).unwrap().payload.count == BigInt::from(2));
    let dispatcher = dispatch(&input).unwrap();
    check!(dispatcher.call(&mut mutable).unwrap().payload.count == BigInt::from(3));
    check!(dispatcher.call(|mut value: Bundle| { value.payload.count = BigInt::from(5); Ok(value) }).unwrap().payload.count == BigInt::from(5));
    let caught = catch_unwind(AssertUnwindSafe(|| dispatcher.call(|_: Bundle| std::panic::panic_any(919u32))));
    check!(*caught.unwrap_err().downcast::<u32>().unwrap() == 919);
    let identity = identity_closure(()).unwrap();
    check!(dispatcher.call(&identity).unwrap() == input);
    check!(callback_record(&input, &identity).unwrap() == input);
    let mut chosen = make_record(&input).unwrap();
    let alternate = bundle_value(second, first);
    check!(chosen.call(true, &alternate).unwrap() == input);
    check!(chosen.call(false, &alternate).unwrap() == alternate);
    let independent = chosen.retain().unwrap(); chosen.close();
    check!(independent.call(true, &alternate).unwrap() == input);
    check!(chosen.call(true, &alternate) == Err(Error::Closed));
    let retained = retain_callback(&identity).unwrap();
    check!(retained.call(&input).unwrap() == input);
    let expired = retain_callback(|value: Bundle| Ok(value)).unwrap();
    check!(expired.call(&input) == Err(Error::CallbackFailed));
    let made = factory(with_recovery(|()| new_ticket(&BigUint::from(92u32), "factory"), first.clone())).unwrap();
    check!(serial(&made).unwrap() == BigUint::from(92u32));
    let caught = catch_unwind(AssertUnwindSafe(|| factory(with_recovery(|()| std::panic::panic_any(920u32), first.clone()))));
    check!(*caught.unwrap_err().downcast::<u32>().unwrap() == 920);
    check!(construct(first, |ticket: Ticket| Ok(bundle_value(&ticket, second))).unwrap() == input);
    let mut calls = 0;
    check!(repeatedly(&input, |value: Bundle| { calls += 1; Ok(value) }, &BigUint::from(10000u32)) == Err(Error::Limit));
    check!(calls > 1 && calls < 10000);
    let tree = Tree::Branch { children: vec![Tree::Leaf { ticket: first.clone() }] };
    check!(callback_recursive(&tree, |value: Tree| Ok(value)).unwrap() == tree);
    let chooser = make_recursive(&tree).unwrap();
    check!(chooser.call(true, &Tree::Branch { children: vec![] }).unwrap() == tree);
    check!(chooser.call(false, &Tree::Branch { children: vec![] }).unwrap() == Tree::Branch { children: vec![] });
    // Callback-local replies are snapshotted before their Rust storage disappears.
    check!(callback_record(&input, |_: Bundle| {
        let local = new_ticket(&BigUint::from(93u32), "local")?;
        Ok(bundle_value(&local, &local))
    }).and_then(|value| serial(&value.primary)).unwrap() == BigUint::from(93u32));
    let before = baseline(); let mut failures = 0; let mut completed = false;
    for position in 1..4096 {
        OWNED_FAULT.with(|state| state.set((position, 0, true)));
        let result = catch_unwind(AssertUnwindSafe(|| callback_record(&input, |value: Bundle| Ok(value))));
        OWNED_FAULT.with(|state| state.set((0, 0, false)));
        match result {
            Ok(Ok(value)) => { check!(value == input); completed = true; }
            Ok(Err(error)) => panic!("callback fault returned unexpected error: {error}"),
            Err(payload) => { check!(payload.downcast_ref::<&str>() == Some(&"injected owned conversion panic")); failures += 1; }
        }
        check!(baseline() == before); check!(OWNED_LIVE.with(Cell::get) == 0);
        if completed { break; }
    }
    check!(completed && failures > 20);
    let mut native_failures = 0; completed = false;
    for position in 0..4096 {
        unsafe { owned_test_fail_after(position) };
        let result = callback_record(&input, |value: Bundle| Ok(value));
        unsafe { owned_test_fail_after(-1) };
        match result {
            Ok(value) => { check!(value == input); completed = true; }
            Err(error) => { check!(error == Error::Allocation); native_failures += 1; }
        }
        check!(baseline() == before); check!(OWNED_LIVE.with(Cell::get) == 0);
        if completed { break; }
    }
    check!(completed && native_failures > 20);
    std::panic::set_hook(old_hook);
}
