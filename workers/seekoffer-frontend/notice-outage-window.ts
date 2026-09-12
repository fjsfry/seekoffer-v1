// Dated, finite public-only emergency publication after the confirmed D1 daily
// read limit. It is not a successful live read, and it never supplies account data.
export const outageUntil=Date.parse('2026-09-12T00:00:00Z');
export const outageSnapshotAt='2026-09-11T10:39:27.413Z';
export const publicOutageActive=(now=Date.now())=>now>=Date.parse('2026-09-11T12:07:00Z')&&now<outageUntil;
export const outageMessage='公开通知应急只读：数据更新于北京时间9月11日18:39。云端资料服务受限，登录后的同步可能暂不可用；已有资料和本机草稿保留。通知详情请以学校原文为准。';
export const outageScript=`(()=>{const show=()=>{if(Date.now()>=${outageUntil}||document.getElementById('seekoffer-public-outage'))return;const n=document.createElement('aside');n.id='seekoffer-public-outage';n.setAttribute('role','status');n.textContent=${JSON.stringify(outageMessage)};n.style.cssText='position:relative;z-index:50;margin:8px 16px;padding:12px 16px;background:#fffbeb;color:#92400e;border:1px solid #fcd34d;border-radius:12px;font:14px/1.6 sans-serif';document.body.prepend(n);};if(document.readyState==='complete')show();else window.addEventListener('load',show,{once:true});})();`;
