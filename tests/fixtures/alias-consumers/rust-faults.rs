#[cfg(test)] mod alias_faults {
    use super::*;
    fn faults(action: impl Fn() -> Result<(), Error>) -> usize {
        FAULT.set((0, 0, false));
        action().unwrap();
        let count = FAULT.get().1;
        assert!(count > 0);
        for panic in [false, true] {
            for target in 1..=count {
                let before = CLEARS.get();
                FAULT.set((target, 0, panic));
                let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(&action));
                FAULT.set((0, 0, false));
                if panic { assert!(outcome.is_err()); }
                else { assert!(matches!(outcome.unwrap(), Err(Error::Allocation))); }
                assert_eq!(LIVE.get(), 0);
                assert_eq!(CLEARS.get(), before + 1);
                assert_eq!(crate::make().unwrap(), 41);
            }
        }
        count * 2
    }
    #[test] fn errors_and_panics_release_alias_scratch_and_native_outputs() {
        let packet = crate::PacketView {
            count: 41, text: "alias\0🌱".into(), rows: vec![vec![1, 2, 3], vec![]],
            maybe: Some(Some(())), outcome: Ok((7, vec![0, 255])),
        };
        let huge: crate::ANat = BigUint::from(1u8) << 5120usize;
        let checks = faults(|| { crate::change_packet(&packet)?; Ok(()) })
            + faults(|| { crate::reverse_packets(&[packet.clone(), packet.clone()])?; Ok(()) })
            + faults(|| { crate::echo_nat(&huge)?; Ok(()) })
            + faults(|| { let _ = crate::echo_outcome(&Ok((7, vec![0, 255])))?; Ok(()) })
            + faults(|| { let _ = crate::echo_outcome(&Err("error\0🌱".into()))?; Ok(()) })
            + faults(|| { let _ = crate::duplicate(&[0, 255])?; Ok(()) });
        println!("alias-faults:{checks}");
    }
}
