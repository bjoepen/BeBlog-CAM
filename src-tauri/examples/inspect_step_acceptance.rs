#[cfg(feature = "occt-native")]
use std::ffi::{c_char, CStr, CString};

#[cfg(feature = "occt-native")]
unsafe extern "C" {
    fn beblog_occt_inspect_step(path: *const c_char) -> *mut c_char;
    fn beblog_occt_free_string(value: *mut c_char);
}

fn main() {
    #[cfg(not(feature = "occt-native"))]
    {
        eprintln!("inspect_step_acceptance requires --features occt-native");
        std::process::exit(2);
    }

    #[cfg(feature = "occt-native")]
    {
        let path = std::env::args().nth(1).expect("STEP fixture path required");
        let path = CString::new(path).expect("fixture path must not contain NUL");
        let raw = unsafe { beblog_occt_inspect_step(path.as_ptr()) };
        if raw.is_null() {
            eprintln!("OCCT bridge returned null");
            std::process::exit(3);
        }
        let json = unsafe { CStr::from_ptr(raw) }.to_string_lossy().into_owned();
        unsafe { beblog_occt_free_string(raw) };
        println!("{json}");
    }
}
