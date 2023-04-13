// basic tests to see that certain "obvious" errors are caught by
// these types no longer requiring `'static` (RFC 458)

#![allow(dead_code)]

use std::sync::{Mutex, RwLock, mpsc};

fn mutex() {
    let x = 1;
    let y = Box::new(1);
    let lock = Mutex::new(&x);
    *lock.lock().unwrap() = &*y;
    drop(y); //~ ERROR cannot move out
    {
        let z = 2;
        *lock.lock().unwrap() = &z;
    }
    //~^^ ERROR `z` does not live long enough
    // (Mutex is #[may_dangle] so its dtor does not use `z` => needs explicit use)
    lock.use_ref();
}

fn rwlock() {
    let x = 1;
    let y = Box::new(1);
    let lock = RwLock::new(&x);
    *lock.write().unwrap() = &*y;
    drop(y); //~ ERROR cannot move out
    {
        let z = 2;
        *lock.write().unwrap() = &z;
    }
    //~^^ ERROR `z` does not live long enough
    lock.use_ref(); // (RwLock is #[may_dangle]
}

fn channel() {
    let x = 1;
    let y = Box::new(1);
    let (tx, rx) = mpsc::channel();

    // E0597
    tx.send(&x).unwrap();
    tx.send(&*y);
    drop(y); //~ ERROR cannot move out
    {
        let z = 2;
        println!("{}", z);
        tx.send(&z).unwrap();
    }
    //~^^ ERROR `z` does not live long enough
    // (channels lack #[may_dangle], thus their dtors are implicit uses of `z`)
}

trait Fake { fn use_mut(&mut self) { } fn use_ref(&self) { }  }
impl<T> Fake for T { }
