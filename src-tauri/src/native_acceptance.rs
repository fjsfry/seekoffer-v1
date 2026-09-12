//! Opt-in diagnostics for the separately identified local acceptance executable.
//! Reports only public-page counts/flags. It cannot read or emit auth credentials.
use serde::Deserialize;
use sha2::{Digest,Sha256};
use tauri::{AppHandle,Manager};
pub fn isolated(app:&AppHandle)->bool{matches!(app.config().identifier.as_str(),"com.seekoffer.desktop.d1acceptance"|"com.seekoffer.desktop.d1acceptance20260912")}
pub fn enabled(app:&AppHandle)->bool{isolated(app)&&std::env::args().any(|a|a=="--migration-self-test")}
#[derive(Deserialize,serde::Serialize)]
#[serde(deny_unknown_fields,rename_all="camelCase")]
pub struct PublicProbe{count:u32,total:u32,bytes:u32,detail_matches:bool,scope_rejected:bool,login_button:bool,error:Option<String>,test_account_matches:bool,profile_status:u16,profile_uuid_valid:bool,application_status:u16,application_first_page_count:u16,application_no_next_cursor:bool,entitlement_http_status:u16,entitlement_state:String,private_rows_written:u32}
#[tauri::command]
pub fn native_acceptance_report(window:tauri::WebviewWindow,report:PublicProbe)->Result<(),String>{
 let app=window.app_handle();if !enabled(app)||window.label()!="main"{return Err("ACCEPTANCE_ONLY".into());}
 let url=window.url().map_err(|_|"ACCEPTANCE_ORIGIN")?;
 if !(matches!(url.scheme(),"http"|"https"|"tauri") && matches!(url.host_str(),Some("tauri.localhost")|Some("localhost"))){return Err("ACCEPTANCE_ORIGIN".into());}
 if report.count>40||report.total>1000000||report.bytes>5000000||report.entitlement_state.len()>30||!report.entitlement_state.chars().all(|c|c.is_ascii_lowercase()||c=='_')||report.error.as_ref().map(|v|v.len()>90||!v.chars().all(|c|c.is_ascii_uppercase()||c=='_')).unwrap_or(false){return Err("ACCEPTANCE_REPORT_SHAPE".into());}
 let p=std::env::current_exe().map_err(|_|"ACCEPTANCE_PATH")?.with_file_name("d1-native-public-probe.json");std::fs::write(p,serde_json::to_vec_pretty(&report).map_err(|_|"ACCEPTANCE_JSON")?).map_err(|_|"ACCEPTANCE_WRITE")?;Ok(())
}
pub fn start(app:&AppHandle){
 if !enabled(app){return;}
 let asset=app.asset_resolver().get("index.html".into());
 if let Some(a)=asset{let s=String::from_utf8_lossy(&a.bytes);let report=serde_json::json!({"identifier":app.config().identifier,"windowScope":app.get_webview_window("main").and_then(|w|w.url().ok()).map(|u|format!("{}://{}",u.scheme(),u.host_str().unwrap_or(""))),"embeddedIndexSHA256":Sha256::digest(&a.bytes).iter().map(|b|format!("{b:02x}")).collect::<String>(),"embeddedIndexBytes":a.bytes.len(),"hasDesktopAuthShell":s.contains("desktop-auth-shell"),"hasStartupScreen":s.contains("正在启动寻鹿")});if let Ok(p)=std::env::current_exe(){let _=std::fs::write(p.with_file_name("d1-native-embedded-probe.json"),report.to_string());}}
 let handle=app.clone();std::thread::spawn(move||{std::thread::sleep(std::time::Duration::from_secs(10));if let Some(window)=handle.get_webview_window("main"){
  // The production identifier never reaches this path. Do not embed a tester's email.
  let expected=std::env::var("SEEKOFFER_ACCEPTANCE_TEST_EMAIL").unwrap_or_default();
  let expected=if expected.len()<=254 && expected.contains('@'){expected}else{String::new()};
  if let Ok(encoded)=serde_json::to_string(&expected){
   let script=format!("window.__SEEKOFFER_ACCEPTANCE_TEST_EMAIL__={};\n{}",encoded,include_str!("native-acceptance-probe.js"));
   let _=window.eval(&script);
  }
 }});
}
