#[cfg(test)] mod variant_faults {
    use super::*;
    fn faults(action: impl Fn() -> Result<(), Error>) -> usize {
        FAULT.set((0, 0, false)); action().unwrap();
        let count = FAULT.get().1; assert!(count > 0);
        for panic in [false, true] {
            for target in 1..=count {
                let before = CLEARS.get();
                FAULT.set((target, 0, panic));
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(&action));
                FAULT.set((0, 0, false));
                if panic { assert!(result.is_err()); }
                else { assert!(matches!(result.unwrap(), Err(Error::Allocation))); }
                assert_eq!(LIVE.get(), 0);
                assert_eq!(CLEARS.get(), before + 1);
                assert_eq!(crate::make(0).unwrap(), crate::Signal::Idle);
            }
        }
        count * 2
    }
    #[test] fn errors_and_unwinding_release_variant_scratch_and_native_outputs() {
        use crate::{Buffers, Mode, Nested, Packet, Signal};
        let signal = Signal::Data { count: 42, label: "A\0🌱".into() };
        let packet = Packet { current: signal.clone(), events: vec![Signal::Idle, signal.clone()],
            fallback: Some(Signal::Marker { value: () }), modes: vec![Mode::First, Mode::Third] };
        let scalar = crate::Scalars::All { unit: (), bool_: true, u8: 255, u16: 65535,
            u32: u32::MAX, u64: u64::MAX, i8: i8::MIN, i16: i16::MIN, i32: i32::MIN, i64: i64::MIN,
            natural: BigUint::from(1u8) << 5120usize, integer: -(BigInt::from(1u8) << 5120usize),
            f32: 1.5, f64: -2.25, text: "A\0🌱".into(), bytes: vec![0, 255, 1],
            char_: '🌱', word: u64::MAX, signed_word: i64::MIN };
        let checks = faults(|| { crate::echo(&signal)?; Ok(()) })
            + faults(|| { crate::echo_nested(&Nested::Packet { value: packet.clone() })?; Ok(()) })
            + faults(|| { crate::echo_nested(&Nested::Outcome { value: Ok((signal.clone(), Mode::Second)) })?; Ok(()) })
            + faults(|| { crate::echo_nested(&Nested::Outcome { value: Err("error\0🌱".into()) })?; Ok(()) })
            + faults(|| { crate::signals(&[vec![Signal::Idle, signal.clone()], vec![signal.clone()]])?; Ok(()) })
            + faults(|| { crate::echo_buffers(&Buffers::Pair { first: vec![0, 255], second: vec![1] })?; Ok(()) })
            + faults(|| { crate::echo_scalars(&scalar)?; Ok(()) })
            + faults(|| { crate::duplicate(&[0, 255])?; Ok(()) })
            + faults(|| { crate::produce(&BigUint::from(17u8))?; Ok(()) });
        println!("variant-faults:{checks}");
    }
}
