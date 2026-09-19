#[cfg(test)]
mod callable_faults {
    use super::*;
    fn live() -> u32 {
        runtime().unwrap();
        #[repr(C)] #[derive(Default)]
        struct Snapshot { abi:u32, state:u32, runs:u32, components:u32, attached:u32, identities:u32, runtime:u64, domain:u64 }
        let raw = unsafe { dlsym(std::ptr::null_mut(), c"lean_bridge_native_snapshot_read".as_ptr()) };
        assert!(!raw.is_null());
        let read: unsafe extern "C" fn(*mut Snapshot) = unsafe { std::mem::transmute(raw) };
        let mut state = Snapshot::default(); unsafe { read(&mut state) }; state.identities
    }
    fn faults(action: impl Fn() -> Result<(), Error>) {
        let baseline = live();
        FAULT.set((0, 0, false));
        action().unwrap();
        let count = FAULT.get().1;
        assert!(count > 0);
        for panic in [false, true] {
            for target in 1..=count {
                FAULT.set((target, 0, panic));
                let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(&action));
                FAULT.set((0, 0, false));
                if panic { assert!(outcome.is_err()); }
                else { assert!(matches!(outcome.unwrap(), Err(Error::Allocation))); }
                assert_eq!(LIVE.get(), 0);
                assert_eq!(live(), baseline);
                assert_eq!(crate::call_uint32(41, |v| Ok(v+1)).unwrap(), 42);
            }
        }
    }
    #[test]
    fn all_conversion_failures_unwind_after_c_and_release_owners() {
        faults(|| { crate::twice_string("capture\0🌿", |s| Ok(s + "owned"))?; Ok(()) });
        faults(|| { crate::twice_bytes(&[0,255], |mut b| { b.push(1); Ok(b) })?; Ok(()) });
        faults(|| { crate::twice_nat(&(BigUint::from(1u8)<<4096usize), Ok)?; Ok(()) });
        faults(|| { crate::make_string("captured")?; Ok(()) });
        faults(|| { let choose = crate::make_string("captured")?; choose.call(false, "input")?; Ok(()) });
        let baseline = live();
        let choose = crate::make_string("held").unwrap();
        let active = choose.inner.enter().unwrap();
        choose.close().unwrap();
        assert_eq!(live(), baseline + 1);
        assert!(matches!(choose.call(true, ""), Err(Error::Closed)));
        drop(active);
        assert_eq!(live(), baseline);
    }
}
