#[cfg(test)]
mod recursive_faults {
    use super::*;
    fn live() -> u32 {
        graph_runtime().unwrap();
        #[repr(C)] #[derive(Default)]
        struct Snapshot { abi: u32, state: u32, runs: u32, components: u32, attached: u32, identities: u32, runtime: u64, domain: u64 }
        let raw = unsafe { graph_symbol(std::ptr::null_mut(), c"lean_bridge_native_snapshot_read".as_ptr()) };
        assert!(!raw.is_null());
        let read: unsafe extern "C" fn(*mut Snapshot) = unsafe { std::mem::transmute(raw) };
        let mut snapshot = Snapshot::default(); unsafe { read(&mut snapshot) }; snapshot.identities
    }
    fn faults(action: impl Fn() -> Result<(), Error>) -> usize {
        let baseline = live();
        GRAPH_FAULT.set((0, 0, false)); action().unwrap();
        let count = GRAPH_FAULT.get().1;
        for panic in [false, true] {
            for target in 1..=count {
                GRAPH_FAULT.set((target, 0, panic));
                let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(&action));
                GRAPH_FAULT.set((0, 0, false));
                if panic { assert_eq!(outcome.unwrap_err().downcast_ref::<&str>(), Some(&"injected graph conversion panic"), "checkpoint {target} did not preserve the injected panic"); }
                else { assert!(matches!(outcome.unwrap(), Err(Error::Allocation)), "checkpoint {target} lost its allocation error"); }
                assert_eq!(GRAPH_LIVE.get(), 0, "checkpoint {target} retained a Rust owner");
                assert_eq!(live(), baseline, "checkpoint {target} retained a Lean closure");
                assert_eq!(crate::call_option(&Some(Some(())), Ok).unwrap(), Some(Some(())));
            }
        }
        count * 2
    }
    macro_rules! shape {
        ($name:literal, $call:ident, $twice:ident, $make:ident, $value:expr, $other:expr) => {{
            let value = $value; let other = $other;
            let mut count = faults(|| { assert_eq!(crate::$call(&value, |_| Ok(other.clone()))?, other); Ok(()) });
            count += faults(|| { assert_eq!(crate::$twice(&value, Ok)?, value); Ok(()) });
            count += faults(|| { crate::$make(&value)?; Ok(()) });
            count += faults(|| { let closure = crate::$make(&value)?; assert_eq!(closure.call(true, &other)?, value); Ok(()) });
            {
                let closure = crate::$make(&value).unwrap();
                count += faults(|| { assert_eq!(closure.call(false, &other)?, other); Ok(()) });
            }
            println!("recursive-rust-faults:{}:5:{}", $name, count);
        }};
    }
    #[test]
    fn every_shape_cleans_up_on_conversion_error_and_panic() {
        let previous = std::panic::take_hook();
        std::panic::set_hook(Box::new(|info| {
            if info.payload().downcast_ref::<&str>() != Some(&"injected graph conversion panic") { eprintln!("{info}"); }
        }));
        let text = "a\0λ🌿".to_owned();
        let array = vec![None, Some(text.clone()), Some(String::new())];
        let record = crate::Payload { text: text.clone(), rows: array.clone(), count: (BigUint::from(1u8) << 4097usize) + 11u8,
            nested: Some(Err(text.clone())) };
        let alternate = crate::Payload { text: String::new(), rows: vec![], count: BigUint::from(0u8), nested: Some(Ok((u64::MAX, ()))) };
        shape!("array", call_array, twice_array, make_array, array.clone(), vec![Some("other".into())]);
        shape!("list", call_list, twice_list, make_list, vec![Ok((u32::MAX, text.clone())), Err(text.clone())], vec![Err(String::new())]);
        shape!("option", call_option, twice_option, make_option, Some(Some(())), Some(None));
        shape!("result", call_result, twice_result, make_result, Err(vec![text.clone(), String::new()]), Ok(Some(u32::MAX)));
        shape!("tuple", call_tuple, twice_tuple, make_tuple, (text.clone(), (vec![0, 255, 128], BigUint::from(1u8) << 4097usize)), (String::new(), (vec![], BigUint::from(0u8))));
        shape!("record", call_record, twice_record, make_record, record.clone(), alternate.clone());
        shape!("variant", call_variant, twice_variant, make_variant, crate::Packet::Payload { label: text.clone(), rows: array.clone() },
            crate::Packet::Counts { positive: BigUint::from(1u8) << 8193usize, negative: -(BigInt::from(1u8) << 8193usize) });
        shape!("alias", call_alias, twice_alias, make_alias, record.clone(), alternate);
        shape!("recursive", call_recursive, twice_recursive, make_recursive,
            crate::Tree::Branch {children:vec![crate::Tree::Leaf {value:BigUint::from(1u8)<<257usize},crate::Tree::Branch {children:vec![]}]},
            crate::Tree::Leaf {value:BigUint::from(0u8)});
        let baseline = live();
        let closure = crate::make_record(&record).unwrap();
        let active = closure.inner.enter().unwrap();
        closure.close().unwrap();
        assert_eq!(live(), baseline + 1);
        assert!(matches!(closure.call(true, &record), Err(Error::Closed)));
        drop(active); assert_eq!(live(), baseline);
        std::panic::set_hook(previous);
    }
}
