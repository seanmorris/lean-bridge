// Public Rust lifetime oracle, also reused by source-free Cargo consumers.
use std::cell::Cell;
std::thread_local! { static CHECKS: Cell<usize> = const { Cell::new(0) }; }
macro_rules! check { ($value:expr) => {{ CHECKS.with(|n| n.set(n.get() + 1));
    let passed = $value; if !passed { eprintln!("owned Rust callback result check failed at {}:{}: {}", file!(), line!(), stringify!($value)); }
    assert!(passed); }}; }
fn sample(number: u32) -> Bundle {
    let ticket = new_ticket(&BigUint::from(number), "callback\0💠").unwrap();
    Bundle { primary: ticket.get().unwrap().clone(), spare: None, peers: vec![], history: vec![],
        payload: Payload { count: -(BigInt::from(1u32) << 140usize) - 7, bytes: vec![0, 255, 42] } }
}
fn number(value: &Ticket, expected: u32) { check!(serial(value).unwrap() == BigUint::from(expected)); }
fn lifetimes() {
    let mut captured = echo_record(&sample(42)).unwrap(); let mut supplied = echo_record(&sample(99)).unwrap();
    let mut alias = supplied.clone(); let mut closure = make_record(captured.get().unwrap()).unwrap();
    let mut leased = make_leased_record(captured.get().unwrap()).unwrap();
    let view = closure.get().unwrap().call(true, &supplied).unwrap();
    let nested = closure.get().unwrap().call(false, &view).unwrap();
    number(&nested.get().unwrap().primary, 42);
    check!(nested.get().unwrap().payload == captured.get().unwrap().payload);
    check!(label(&nested.get().unwrap().primary).unwrap() == "callback\0💠");
    let retained = nested.retain().unwrap(); let independent = leased.get().unwrap().call(false, supplied.get().unwrap()).unwrap();
    captured.close(); closure.close(); leased.close(); number(&nested.get().unwrap().primary, 42);
    supplied.close(); check!(supplied.is_closed() && !view.is_closed());
    alias.close(); check!(view.is_closed() && nested.is_closed());
    check!(nested.get() == Err(Error::Closed));
    check!(nested.try_equal(&retained) == Err(Error::Closed) && nested != retained);
    number(&retained.get().unwrap().primary, 42); number(&independent.get().unwrap().primary, 99);
    for i in 0..32 { let fresh = echo_record(&sample(i)).unwrap(); number(&fresh.get().unwrap().primary, i); check!(nested.is_closed()); }
    let root = echo_record(&sample(42)).unwrap(); let callback = make_record(root.get().unwrap()).unwrap();
    let mut parent = callback.get().unwrap().call(false, &root).unwrap();
    let child = callback.get().unwrap().call(false, &parent).unwrap(); let leaf = child.get().unwrap().primary.clone();
    parent.close(); check!(!root.is_closed() && child.is_closed() && leaf.is_closed());
    check!(serial(&leaf) == Err(Error::Closed));
    let mut chain = vec![root.clone()]; let mut limited = false;
    for _ in 0..150 {
        match callback.get().unwrap().call(false, chain.last().unwrap()) {
            Ok(value) => chain.push(value), Err(error) => { check!(error == Error::Limit); limited = true; break; }
        }
    }
    check!(limited && chain.len() >= 100);
    chain[48].close(); check!(!chain[47].is_closed() && chain[49].is_closed() && chain.last().unwrap().is_closed());
}
fn recursive() {
    let root = echo_recursive(&Tree::Branch { children: vec![] }).unwrap();
    let callback = make_recursive(root.get().unwrap()).unwrap();
    let mut view = callback.get().unwrap().call(false, &root).unwrap();
    let nested = callback.get().unwrap().call(false, &view).unwrap(); let retained = nested.retain().unwrap();
    view.close(); check!(nested.is_closed() && !root.is_closed()); check!(nested.get() == Err(Error::Closed));
    check!(retained.get().unwrap() == &Tree::Branch { children: vec![] });
    let mut tree = Tree::Leaf { ticket: sample(42).primary };
    for _ in 0..20 { tree = Tree::Branch { children: vec![tree] }; }
    let mut deep = echo_recursive(&tree).unwrap(); let view = callback.get().unwrap().call(false, &deep).unwrap();
    check!(view.get().unwrap() == &tree); let saved = view.retain().unwrap();
    deep.close(); check!(view.is_closed() && saved.get().unwrap() == &tree);
}
fn fork_guard() {
    unsafe extern "C" { fn fork() -> i32; fn waitpid(pid: i32, status: *mut i32, options: i32) -> i32; fn _exit(code: i32) -> !; }
    let root = echo_record(&sample(42)).unwrap(); let callback = make_record(root.get().unwrap()).unwrap();
    let view = callback.get().unwrap().call(false, &root).unwrap(); let child = unsafe { fork() }; check!(child >= 0);
    if child == 0 { unsafe { _exit(if view.get() == Err(Error::WrongProcess) && callback.get().err() == Some(Error::WrongProcess) { 0 } else { 2 }) } }
    let mut status = -1; check!(unsafe { waitpid(child, &mut status, 0) } == child && status == 0);
    number(&view.get().unwrap().primary, 42);
}
fn returned_callbacks() {
    let root = echo_record(&sample(42)).unwrap(); let supplied = echo_record(&sample(99)).unwrap();
    let mut callback = make_record_callback(root.get().unwrap()).unwrap();
    let view = callback.call(&supplied).unwrap(); number(&view.get().unwrap().primary, 42);
    let reply = callback_record(supplied.get().unwrap(), callback.get().unwrap()).unwrap();
    number(&reply.get().unwrap().primary, 42);
    #[cfg(feature = "host")] {
        let reply = callback_record(supplied.get().unwrap(), &callback).unwrap();
        number(&reply.get().unwrap().primary, 42);
        let reply = callback_record(supplied.get().unwrap(), callback.clone()).unwrap();
        number(&reply.get().unwrap().primary, 42);
        let reply = callback_record(supplied.get().unwrap(), callback.get().unwrap().clone()).unwrap();
        number(&reply.get().unwrap().primary, 42);
    }
    callback.close(); number(&view.get().unwrap().primary, 42); number(&reply.get().unwrap().primary, 42);
    #[cfg(feature = "host")] check!(callback_record(supplied.get().unwrap(), &callback) == Err(Error::Closed));
    let empty = echo_recursive(&Tree::Branch { children: vec![] }).unwrap();
    let callback = make_tree_callback(empty.get().unwrap()).unwrap();
    let reply = callback_recursive(empty.get().unwrap(), callback.get().unwrap()).unwrap();
    check!(reply.get().unwrap() == empty.get().unwrap());
}
#[cfg(feature = "host")]
fn hosts() {
    let root = echo_record(&sample(42)).unwrap(); let mut escaped = Ticket::default(); let mut retained = Ticket::default();
    let reply = callback_record(root.get().unwrap(), |value: Bundle| {
        escaped = value.primary.clone(); retained = value.primary.retain()?; Ok(value)
    }).unwrap();
    check!(escaped.is_closed()); number(&retained, 42); number(&reply.get().unwrap().primary, 42);
    check!(serial(&escaped) == Err(Error::Closed));
    let mut returned = Value::<Bundle>::default();
    let reply = callback_record(root.get().unwrap(), |value: Bundle| {
        returned = echo_record(&value)?; Ok(returned.clone())
    }).unwrap();
    returned.close(); number(&reply.get().unwrap().primary, 42);
    let reply = callback_record(root.get().unwrap(), with_recovery(|_: Bundle| Ok(root.clone()), root.clone())).unwrap();
    number(&reply.get().unwrap().primary, 42);
    let mut sentinel = Some(Box::new(91u32)); let address = (&**sentinel.as_ref().unwrap() as *const u32) as usize;
    let caught = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        callback_record(root.get().unwrap(), |_: Bundle| -> Result<Value<Bundle>, Error> { std::panic::resume_unwind(sentinel.take().unwrap()); })
    })).unwrap_err();
    let payload = caught.downcast::<u32>().unwrap(); check!(*payload == 91 && (&*payload as *const u32) as usize == address);
    check!(!root.is_closed());
    let invalid = callback_record(root.get().unwrap(), |mut value: Bundle| { value.primary = escaped.clone(); Ok(value) });
    check!(invalid == Err(Error::Closed));
    let invalid = callback_record(root.get().unwrap(), |value: Bundle| { let mut owner = echo_record(&value)?; owner.close(); Ok(owner) });
    check!(invalid == Err(Error::Closed));
    let empty = callback_recursive(&Tree::Branch { children: vec![] }, |value: Tree| Ok(value)).unwrap();
    check!(empty.get().unwrap() == &Tree::Branch { children: vec![] });
    let invalid = callback_recursive(&Tree::Branch { children: vec![] }, |value: Tree| {
        let mut owner = echo_recursive(&value)?; owner.close(); Ok(owner)
    });
    check!(invalid == Err(Error::Closed));
}
#[cfg(feature = "combined")]
fn combinations() {
    let mut root = echo_record(&sample(42)).unwrap(); let alias = root.clone(); let callback = root.make_record().unwrap();
    let mut view = callback.get().unwrap().call(false, &root).unwrap();
    let child = view.borrow_record().unwrap(); let saved = child.retain().unwrap(); let mut calls = 0;
    check!(view.move_record(|value: Bundle| { calls += 1; Ok(value) }) == Err(Error::InvalidArgument));
    check!(calls == 0 && !root.is_closed() && !view.is_closed()); let mut escaped = Ticket::default();
    let moved = root.move_record(|value: Bundle| {
        calls += 1; check!(alias.is_closed() && view.is_closed() && child.is_closed());
        number(&value.primary, 42); number(&saved.get()?.primary, 42);
        escaped = value.primary.clone(); echo_record(&value)
    }).unwrap();
    check!(calls == 1 && root.is_closed() && escaped.is_closed()); number(&moved.get().unwrap().primary, 42);
    let from_capture = callback.get().unwrap().call(true, &moved).unwrap(); number(&from_capture.get().unwrap().primary, 42);
    let mut failing = echo_record(&sample(42)).unwrap(); let dependent = callback.get().unwrap().call(false, &failing).unwrap();
    let caught = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| failing.move_record(|_: Bundle| -> Result<Bundle, Error> { std::panic::panic_any(31u32) }))).unwrap_err();
    check!(*caught.downcast::<u32>().unwrap() == 31 && failing.is_closed() && dependent.is_closed());
}
#[cfg(test)] unsafe extern "C" {
    fn owned_test_live() -> usize; fn owned_test_identities() -> usize;
    fn owned_test_handoffs() -> usize; fn owned_test_fail_after(value: isize);
    fn owned_test_sanitizer_fault(index: usize);
    fn owned_test_undefined_fault(shift: i32) -> i32;
}
#[cfg(test)] fn baseline() -> (usize, usize, usize) {
    (unsafe { owned_test_live() }, unsafe { owned_test_identities() }, OWNED_LIVE.with(Cell::get))
}
#[cfg(test)] fn faults(native: bool, panic: bool, operation: u32) -> (usize, usize) {
    let base = baseline(); let mut before = 0; let mut after = 0; let mut complete = false;
    for at in 1..1024 {
        {
            #[allow(unused_mut)] let mut root = echo_record(&sample(42)).unwrap(); let alias = root.clone();
            let callback = make_record(root.get().unwrap()).unwrap();
            let view = callback.get().unwrap().call(false, &root).unwrap();
            let child = callback.get().unwrap().call(false, &view).unwrap(); let retained = child.retain().unwrap();
            let handoffs = unsafe { owned_test_handoffs() };
            if native { unsafe { owned_test_fail_after(at as isize - 1) }; }
            else { OWNED_FAULT.with(|state| state.set((at, 0, panic))); }
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                match operation {
                    0 => callback.get()?.call(false, &root),
                    1 => child.retain(),
                    #[cfg(feature = "host")]
                    2 => callback_record(root.get()?, |value: Bundle| Ok(value)),
                    #[cfg(feature = "host")]
                    3 => callback_record(root.get()?, |value: Bundle| echo_record(&value)),
                    #[cfg(feature = "combined")]
                    4 => root.move_record(|value: Bundle| { check!(alias.is_closed() && child.is_closed()); Ok(value) }),
                    #[cfg(feature = "combined")]
                    5 => root.move_record(|value: Bundle| { check!(alias.is_closed() && child.is_closed()); echo_record(&value) }),
                    _ => unreachable!(),
                }
            }));
            unsafe { owned_test_fail_after(-1) }; OWNED_FAULT.with(|state| state.set((0, 0, false)));
            match result {
                Ok(Ok(value)) => { number(&value.get().unwrap().primary, 42); complete = true; }
                Ok(Err(error)) => check!(error == Error::Allocation),
                Err(payload) => {
                    check!(!native && panic);
                    let text = payload.downcast_ref::<&str>().copied().or_else(|| payload.downcast_ref::<String>().map(String::as_str));
                    check!(text == Some("injected owned conversion panic"));
                }
            }
            let consumed = unsafe { owned_test_handoffs() } - handoffs;
            check!(consumed <= 1); check!(root.is_closed() == (consumed != 0) && alias.is_closed() == (consumed != 0));
            check!(view.is_closed() == (consumed != 0) && child.is_closed() == (consumed != 0));
            if consumed == 0 { number(&root.get().unwrap().primary, 42); }
            else { check!(root.get().is_err() && view.get().is_err() && child.get().is_err()); }
            number(&retained.get().unwrap().primary, 42);
            if !complete { if consumed == 0 { before += 1; } else { after += 1; } }
        }
        check!(baseline() == base); if complete { break; }
    }
    check!(complete && before > 0);
    if operation >= 4 { check!(after > 0); } else { check!(after == 0); }
    (before, after)
}
fn main() {
    std::panic::set_hook(Box::new(|_| {}));
    { let cold = new_ticket(&BigUint::from(0u32), "cold").unwrap(); number(cold.get().unwrap(), 0); }
    #[cfg(test)] let state = current_state().unwrap();
    #[cfg(test)] if let Some(fault) = std::env::var_os("LEAN_BRIDGE_OWNED_SANITIZER_FAULT") {
        if fault == "address" { unsafe { owned_test_sanitizer_fault(1); } }
        else if fault == "undefined" { unsafe { owned_test_undefined_fault(40); } }
        else { panic!("unknown native sanitizer probe"); }
        panic!("native sanitizer failed to detect the injected fault");
    }
    #[cfg(test)] if std::env::var_os("LEAN_BRIDGE_OWNED_COLD_ONLY").is_some() {
        state.close().unwrap(); assert_eq!(baseline(), (0, 0, 0));
        println!("owned-rust-callback-results:{{\"cold\":true}}"); return;
    }
    #[cfg(test)] let initial = baseline();
    lifetimes(); recursive(); fork_guard(); returned_callbacks();
    #[cfg(feature = "host")] hosts();
    #[cfg(feature = "combined")] combinations();
    #[cfg(test)] {
        check!(baseline() == initial);
        let mut rust_faults = 0; let mut native_faults = 0; let mut panic_faults = 0; let mut before = 0; let mut after = 0;
        let operations = if cfg!(feature = "combined") { 6 } else if cfg!(feature = "host") { 4 } else { 2 };
        for operation in 0..operations {
            for (native, panic) in [(false, false), (true, false), (false, true)] {
                let (earlier, later) = faults(native, panic, operation); before += earlier; after += later;
                if native { native_faults += earlier + later; } else if panic { panic_faults += earlier + later; } else { rust_faults += earlier + later; }
            }
        }
        state.close().unwrap(); check!(baseline() == (0, 0, 0));
        println!("owned-rust-callback-results:{{\"checks\":{},\"rustFaults\":{},\"nativeFaults\":{},\"panicFaults\":{},\"before\":{},\"after\":{},\"live\":0,\"identities\":0}}", CHECKS.with(Cell::get), rust_faults, native_faults, panic_faults, before, after);
    }
    #[cfg(not(test))] println!("owned-rust-callback-results:{}", CHECKS.with(Cell::get));
}
