use journal_rs::{self as api, CallError, Fault};
use std::{ffi::{c_char, c_void}, ptr::null_mut};

// Test-only broker observer; production calls are safe, ordinary functions.
#[repr(C)] #[derive(Default)]
struct Snapshot { abi:u32, state:u32, init:u32, components:u32, attached:u32, live:u32, runtime:u64, domain:u64 }
unsafe extern "C" {
    fn dlsym(lib:*mut c_void, name:*const c_char)->*mut c_void;
    fn fork()->i32; fn waitpid(pid:i32, status:*mut i32, flags:i32)->i32; fn _exit(code:i32)->!;
}
fn snapshot()->Snapshot { unsafe {
    let f=dlsym(null_mut(),c"lean_bridge_native_snapshot_read".as_ptr()); assert!(!f.is_null());
    let mut s=Snapshot::default(); std::mem::transmute::<_, unsafe extern "C" fn(*mut Snapshot)>(f)(&mut s);
    assert_eq!(s.abi,1); s
} }
fn main() {
    assert_eq!(std::thread::spawn(||api::bump(9)).join().unwrap(),Err(CallError::Boundary(Fault::WrongContext)));
    assert_eq!(api::store("state",&"a".repeat(16*1024*1024)),Err(CallError::Boundary(Fault::Limit)));
    let cold=snapshot(); assert_eq!(cold.components,0);
    assert_eq!(api::count(),Ok(0)); assert_eq!(api::bump(3),Ok(3)); assert_eq!(api::bump(2),Ok(5));
    assert_eq!(api::echo(37),Ok(37)); let warm=snapshot(); assert_eq!((warm.components,warm.live),(1,cold.live));
    assert_eq!(api::read("state").unwrap(),"open");
    assert!(matches!(api::read("missing"),Err(CallError::Io{declaration:"Journal.read",message}) if message.contains("missing")));
    for _ in 0..4 { for tag in [true,false] {
        let payload:Result<String,u32>=if tag {Ok("a\0b".into())} else {Err(37)};
        let returned:Result<Result<String,u32>,CallError<Result<String,u32>>>=api::choose(false,tag,"a\0b");
        assert_eq!(returned,Ok(payload.clone()));
        assert_eq!(api::choose(true,tag,"a\0b"),Err(CallError::Declared{declaration:"Journal.choose",payload}));
    }}
    api::store("state","closed").unwrap(); assert_eq!(api::read("state").unwrap(),"closed"); assert_eq!(snapshot().live,warm.live);
    unsafe {
        let child=fork();assert!(child>=0);
        if child==0 { _exit(if api::count()==Err(CallError::Boundary(Fault::WrongContext)){0}else{1}); }
        let mut status=0; assert_eq!(waitpid(child,&mut status,0),child);assert_eq!(status,0);
    }
    assert_eq!(api::count(),Ok(5));
}
