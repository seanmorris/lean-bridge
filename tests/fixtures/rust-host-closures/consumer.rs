use std::{cell::{Cell,RefCell},rc::Rc};
use workshop::{Binding,Fault,HostCallError,HostError,MemberResult};

struct Meter {
    level:Cell<u32>, dropped:Rc<Cell<u32>>, hook:RefCell<Option<Rc<dyn Fn()>>>,
    error:RefCell<Option<HostError>>,
}
impl Meter {
    fn create(value:u32)->Rc<Self>{Rc::new(Self{level:Cell::new(value),dropped:Default::default(),hook:Default::default(),error:Default::default()})}
    fn read(&self)->MemberResult<u32>{
        let hook=self.hook.borrow().clone();if let Some(f)=hook{f()}
        if let Some(e)=self.error.borrow().clone(){Err(e)}else{Ok(self.level.get())}
    }
    fn get_level(&self)->u32{self.level.get()}
    fn set_level(&self,n:u32){self.level.set(n)}
    fn identity(self:&Rc<Self>)->Rc<Self>{self.clone()}
}
impl Drop for Meter{fn drop(&mut self){self.dropped.set(self.dropped.get()+1)}}
workshop::bind_objects!(App{Box=Meter});

fn main(){
    let a=Rc::new(Binding::<App>::new().unwrap());let b=Binding::<App>::new().unwrap();
    let x=a.make(40).unwrap();let y=a.make(2).unwrap();
    let dx=x.dropped.clone();let dy=y.dropped.clone();
    let reader=Rc::new(a.reader(&x).unwrap());let sibling=b.reader(&y).unwrap();
    if std::env::args().nth(1).as_deref()==Some("poison"){
        x.hook.replace(Some(Rc::new(||panic!("host member panicked"))));
        assert!(matches!(reader.call(1),Err(HostCallError::Boundary(Fault::CallbackPanic{..}))));
        assert!(matches!(sibling.call(1),Err(HostCallError::Boundary(Fault::Unavailable))));
        drop(x);drop(y);reader.close().unwrap();reader.close().unwrap();assert_eq!((dx.get(),dy.get()),(1,0));
        a.close().unwrap();b.close().unwrap();assert_eq!(dy.get(),1);
        println!("poisoned Cargo owner released both captures exactly once");return
    }
    let remember=Rc::new(a.remember(&x).unwrap());
    assert!(remember.call(&y).unwrap().ptr_eq(&x));assert_eq!(reader.call(2).unwrap(),42);
    let sentinel:HostError=Rc::new(std::io::Error::other("original Rust member failure"));
    y.error.replace(Some(sentinel.clone()));
    assert!(matches!(remember.call(&y),Err(HostCallError::Host(e)) if Rc::ptr_eq(&e,&sentinel)));
    y.error.take();
    {
        let nested=reader.clone();let active=Rc::downgrade(&remember);let owner=Rc::downgrade(&a);
        y.hook.replace(Some(Rc::new(move||{
            assert_eq!(nested.call(3).unwrap(),43);
            let active=active.upgrade().unwrap();active.close().unwrap();
            assert!(matches!(active.call(&Meter::create(1)),Err(HostCallError::Boundary(Fault::Closed))));
            assert_eq!(owner.upgrade().unwrap().close(),Err(Fault::Busy));
        })));
    }
    assert!(remember.call(&y).unwrap().ptr_eq(&x));y.hook.take();remember.close().unwrap();
    let transient=Rc::new(RefCell::new(Some(Binding::<App>::new().unwrap())));
    let cap=Meter::create(6);let seen=Rc::downgrade(&cap);
    let orphan=transient.borrow().as_ref().unwrap().remember(&cap).unwrap();drop(cap);
    let slot=transient.clone();y.hook.replace(Some(Rc::new(move||{slot.borrow_mut().take();})));
    let got=orphan.call(&y).unwrap();y.hook.take();
    assert!(Rc::ptr_eq(got.as_rc(),&seen.upgrade().unwrap()));
    assert!(matches!(orphan.call(&y),Err(HostCallError::Boundary(Fault::Closed))));
    drop(got);assert!(seen.upgrade().is_none());
    let cap=Meter::create(8);let once=cap.dropped.clone();let lease=a.reader(&cap).unwrap();
    drop(cap);assert_eq!(once.get(),0);drop(lease);assert_eq!(once.get(),1);
    #[cfg(feature="worker")]
    {
        assert!(async_io::block_on(a.echo_box(&x).unwrap()).unwrap().ptr_eq(&x));
        let file=a.file_reader().unwrap();
        assert!(matches!(file.call("absent"),Err(HostCallError::Io{declaration:"Closures.fileReader",..})));
        for s in ["first","changed"]{std::fs::write("input",s).unwrap();assert_eq!(file.call("input").unwrap(),s);}
        file.close().unwrap();
    }
    drop(x);a.close().unwrap();assert_eq!(dx.get(),1);
    let replacement=Binding::<App>::new().unwrap();
    assert!(matches!(reader.call(1),Err(HostCallError::Boundary(Fault::Closed))));replacement.close().unwrap();
    assert_eq!(sibling.call(3).unwrap(),5);drop(y);b.close().unwrap();assert_eq!(dy.get(),1);
    println!("Cargo closures: original Rc and error, self-close, in-flight owner drop, independent cleanup");
}
