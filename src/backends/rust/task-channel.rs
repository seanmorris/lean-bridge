// Private native driver used only by components that export async delivery.
use lean_bridge_task_runtime::Source;
use std::os::fd::BorrowedFd;
#[derive(Clone,Copy,Default)] #[repr(C)] struct Handle { id:u64, domain:u64 }
type PollFn=unsafe extern "C" fn(Handle,*mut i32)->i32;
type CloseFn=unsafe extern "C" fn(*mut Handle)->i32;
type PullFn=unsafe extern "C" fn(Handle)->i32;
type Dispatch = dyn FnMut(u32,&Api,Handle)->Result<Option<CallbackError>,Fault>;
struct Callbacks {
    declaration:&'static str, fd:PollFn, next:unsafe extern "C" fn(Handle,*mut u32)->i32,
    fail:unsafe extern "C" fn(Handle,View,*mut u32)->i32, poison:PullFn,
    dispatch:Box<Dispatch>, faults:Vec<CallbackError>,
}
struct Channel<T,E,H=Infallible> {
    api:&'static Api, h:Handle, poll:PollFn, close:CloseFn, pull:Option<PullFn>,
    take:fn(&Api,&mut Handle,&[CallbackError])->Result<Option<T>,Error<E,H>>,
    callbacks:Option<Callbacks>,
}
impl<T,E,H> Source<T,E,H> for Channel<T,E,H> {
    fn request(&mut self)->Result<(),Fault>{
        abi::status(unsafe{self.pull.ok_or(Fault::Protocol)?(self.h)})
    }
    fn readiness(&mut self)->Result<Option<BorrowedFd<'_>>,Fault>{
        let mut fd=-1;
        match unsafe{(self.poll)(self.h,&mut fd)}{
            0=>Ok(None),1 if fd>=0=>Ok(Some(unsafe{BorrowedFd::borrow_raw(fd)})),
            n=>{abi::status(n)?;Err(Fault::Protocol)}
        }
    }
    fn take(&mut self)->Result<Option<T>,Error<E,H>>{
        (self.take)(self.api,&mut self.h,self.callbacks.as_ref().map_or(&[],|c|c.faults.as_slice()))
    }
    fn callback_fd(&self)->Result<Option<BorrowedFd<'_>>,Fault>{
        let Some(c)=&self.callbacks else{return Ok(None)};
        let mut fd=-1;abi::status(unsafe{(c.fd)(self.h,&mut fd)})?;
        if fd<0{return Err(Fault::Protocol);}
        Ok(Some(unsafe{BorrowedFd::borrow_raw(fd)}))
    }
    fn dispatch_callbacks(&mut self)->Result<(),Fault>{
        let c=self.callbacks.as_mut().ok_or(Fault::Protocol)?;
        for _ in 0..16 {
            let mut slot=0;let s=unsafe{(c.next)(self.h,&mut slot)};
            if s==1{break} abi::status(s)?;
            // Both the closure and its error's Display are application code.
            // Neither executes in a native frame or under the queue lock.
            let result=std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                (c.dispatch)(slot,self.api,self.h).map(|e|e.map(|e|{let msg=e.to_string();(e,msg)}))
            }));
            match result {
                Ok(Ok(None))=>(),
                Ok(Ok(Some((e,msg))))=>{
                    let mut id=0;c.faults.try_reserve(1).map_err(|_|Fault::Allocation)?;
                    abi::status(unsafe{(c.fail)(self.h,view(msg.as_bytes()),&mut id)})?;
                    if id as usize!=c.faults.len()+1{return Err(Fault::Protocol);}
                    c.faults.push(e);
                }
                Ok(Err(e))=>return Err(e),
                Err(payload)=>{
                    unsafe{(c.poison)(self.h)};
                    // A panic payload can itself panic in Drop.
                    if let Err(second)=std::panic::catch_unwind(std::panic::AssertUnwindSafe(||drop(payload))){std::mem::forget(second);}
                    return Err(Fault::CallbackPanic{declaration:c.declaration})
                }
            }
        }
        Ok(())
    }
    fn close(&mut self)->Result<(),Fault>{
        if self.h.id==0{return Ok(());}
        let n=unsafe{(self.close)(&mut self.h)};
        if n==6 {self.h.id=0;Ok(())} else {abi::status(n)}
    }
}
