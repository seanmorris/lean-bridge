//! Installed applications own a stream. A next() future only borrows it.
use std::{future::Future, pin::Pin, sync::{Arc, atomic::{AtomicUsize, Ordering::SeqCst}},
    task::{Context, Poll, Wake, Waker}, thread, time::{Duration, Instant}};

struct Signal { calls: AtomicUsize, executor: thread::Thread }
impl Wake for Signal {
    fn wake(self: Arc<Self>) { self.wake_by_ref() }
    fn wake_by_ref(self: &Arc<Self>) {
        self.calls.fetch_add(1, SeqCst);
        self.executor.unpark();
    }
}
fn signal() -> (Arc<Signal>, Waker) {
    let s = Arc::new(Signal { calls: 0.into(), executor: thread::current() });
    (s.clone(), Waker::from(s))
}
fn until(check: impl Fn() -> bool) {
    let end = Instant::now() + Duration::from_secs(20);
    while !check() {
        assert!(Instant::now() < end, "producer did not reach expected state");
        thread::sleep(Duration::from_millis(2));
    }
}
fn wait(s: &Signal, before: usize) {
    let end = Instant::now() + Duration::from_secs(20);
    while s.calls.load(SeqCst) == before {
        let left = end.saturating_duration_since(Instant::now());
        assert!(!left.is_zero(), "replacement executor was never woken");
        thread::park_timeout(left);
    }
}
fn poll<F: Future>(f: Pin<&mut F>, w: &Waker) -> Poll<F::Output> {
    f.poll(&mut Context::from_waker(w))
}
fn block<F: Future>(future: F) -> F::Output {
    let (signal, w) = signal();
    let mut f = Box::pin(future);
    loop {
        let before = signal.calls.load(SeqCst);
        match poll(f.as_mut(), &w) {
            Poll::Ready(result) => return result,
            Poll::Pending => wait(&signal, before),
        }
    }
}
macro_rules! exercise {
    ($owner:ident, $peer:ident, $route:literal) => {{
        use $owner as owner;
        use $peer as peer;
        for mode in ["replace", "close", "drop"] {
            owner::reset().unwrap();
            let pulls = owner::pulls().unwrap();
            let closes = owner::closes().unwrap();
            let mut stream = owner::series(false, true, "parked").unwrap();
            let (first, w1) = signal();
            let first_weak = Arc::downgrade(&first);
            let mut reader = Box::pin(stream.next());
            assert!(poll(reader.as_mut(), &w1).is_pending());
            until(|| owner::phase().unwrap() == 1);
            assert_eq!(owner::pulls().unwrap(), pulls + 1);
            drop(reader);
            assert_eq!(owner::closes().unwrap(), closes);
            assert_eq!(first.calls.load(SeqCst), 0);
            drop(w1); drop(first);
            assert!(first_weak.upgrade().is_some(), "parked pull still owns its executor wake");

            let observation = if mode == "replace" {
                let (latest, w2) = signal();
                let mut next = Box::pin(stream.next());
                assert!(poll(next.as_mut(), &w2).is_pending());
                assert!(first_weak.upgrade().is_none(), "previous executor still retained");
                owner::release().unwrap();
                wait(&latest, 0);
                assert_eq!(poll(next.as_mut(), &w2), Poll::Ready(Some(Ok(Err("parked".into())))));
                drop(next);
                stream.close().unwrap();
                assert_eq!(poll(Box::pin(stream.next()).as_mut(), &w2), Poll::Ready(None));
                drop(stream);
                "item"
            } else {
                let outcome = if mode == "close" {
                    stream.close().unwrap();
                    let (_, w) = signal();
                    assert_eq!(poll(Box::pin(stream.next()).as_mut(), &w), Poll::Ready(None));
                    stream.close().unwrap();
                    "end"
                } else { "owner-dropped" };
                drop(stream);
                assert_eq!(owner::closes().unwrap(), closes + 1, "owner must finalize before release");
                assert_eq!(owner::phase().unwrap(), 1);
                assert!(first_weak.upgrade().is_none(), "closed stream still retains the executor");
                // This is the other installed package, not merely another cursor on owner.
                assert_eq!(block(peer::bytes(&[42]).unwrap()), Ok(vec![42]));
                owner::release().unwrap();
                outcome
            };
            until(|| owner::phase().unwrap() == 3);
            assert!(first_weak.upgrade().is_none());
            let pulls = owner::pulls().unwrap() - pulls;
            let closes = owner::closes().unwrap() - closes;
            assert_eq!((pulls, closes), (1, 1));
            assert_eq!(block(owner::bytes(&[73]).unwrap()), Ok(vec![73]));
            println!("{} {mode} pulls={pulls} closes={closes} observed={observation}", $route);
        }
    }}
}
fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("ordinary") => { exercise!(task_lab, task_lab_peer, "ordinary"); exercise!(task_lab_peer, task_lab, "reviewed"); }
        Some("reviewed") => { exercise!(task_lab_peer, task_lab, "reviewed"); exercise!(task_lab, task_lab_peer, "ordinary"); }
        _ => panic!("expected first package: ordinary or reviewed"),
    }
}
