(async function(){
var wrap,hdr,left,h2el,anel,anlSpan,fInput,uploadBtn,anlStatus,right,img,cb,ctrl,tbl,tw;
['__oc_overlay','__oc_style','__oc_modal_wrap'].forEach(function(id){var e=document.getElementById(id);if(e)e.remove();});
if(window.__oc_int)clearInterval(window.__oc_int);
var userId=new URLSearchParams(window.location.search).get('userId')||'jimmy';
var API='https://oloaxv80ee.execute-api.us-east-1.amazonaws.com/prod/getMatchingTransactions?userId='+userId;
var currentHours=24,allRecords=[],knownIds=new Set();
var newTimestamps=new Map();
var NAME_T={PEP_MATCH:1,SANCTIONS_LIST_MATCH:1};
var AMT_T={HIGH_VALUE_TRANSACTION:1,DOLLAR_MATCH:1,ROUND_DOLLAR_AMOUNTS:1};
var ACCT_T={SHELL_COMPANY:1,RAPID_MOVEMENT:1};
var GEO_T={HIGH_RISK_COUNTRY:1};
var US_VALS=['US','USA','UNITED STATES','UNITED STATES OF AMERICA'];
var LOGO=window.__oc_logo||'';
function alertLabel(t){if(!t)return '';if(t==='ROUND_DOLLAR_AMOUNTS'||t==='DOLLAR_MATCH')return 'DOLLAR_MATCH';if(t==='SANCTIONS_LIST_MATCH')return 'PEP_MATCH';return t;}
function hl(v,on){if(!v||v==='-')return v||'-';if(on)return '<span style="background:#b2f0b2;padding:1px 5px;border-radius:3px;font-weight:700">'+v+'</span>';return v;}
function prioBadge(p){if(p===null||p===undefined||p==='')return '-';var s=String(p).trim(),su=s.toUpperCase();if(su==='RED'||parseInt(p)===1)return '<b style="color:#c62828">Red</b>';if(su==='YELLOW'||parseInt(p)===2)return '<b style="color:#e65100">Yellow</b>';if(su==='GREEN'||parseInt(p)===3)return '<b style="color:#2e7d32">Green</b>';return '-';}
function escCsv(v){if(v===null||v===undefined)return '';var s=String(v);if(s.indexOf(',')>=0||s.indexOf('"')>=0)return '"'+s.replace(/"/g,'""')+'"';return s;}
function exportCsv(){if(!allRecords.length)return;var fields=['TransactionID','AlertType','PRIORITY','Amount','CurrencyCode','TransactionTime','SenderFirstName','SenderLastName','SenderBankAccountNumber','SenderBankRoutingNumber','ReceiverFirstName','ReceiverLastName','ReceiverBankAccountNumber','ReceiverBankRoutingNumber','ReceiverCountry','Acknowledged','WatcherGuid','UserId'];var rows=[fields.join(',')];allRecords.forEach(function(r){rows.push(fields.map(function(f){return escCsv(r[f]);}).join(','));});var blob=new Blob([rows.join('\r\n')],{type:'text/csv'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='alerts-'+userId+'-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},2000);}
function buildRow(r,idx){var origAt=r.AlertType||'';var at=alertLabel(origAt);var isName=!!NAME_T[origAt],isAmt=!!AMT_T[at],isAcct=!!ACCT_T[origAt],isGeo=!!GEO_T[origAt];var prio=prioBadge(r.PRIORITY);var amt=r.Amount?'$'+parseFloat(r.Amount).toLocaleString('en-US',{minimumFractionDigits:2}):'-';var t=(r.TransactionTime||r.TransactionUTCTime||'').substring(0,16);var sN=((r.SenderFirstName||'')+' '+(r.SenderLastName||'')).trim()||'-';var rN=((r.ReceiverFirstName||'')+' '+(r.ReceiverLastName||'')).trim()||'-';var sA=r.SenderBankAccountNumber||r.SenderBankRoutingNumber||'-';var rA=r.ReceiverBankAccountNumber||r.ReceiverBankRoutingNumber||'-';var nb=r.TransactionID&&newTimestamps.has(r.TransactionID)&&(Date.now()-newTimestamps.get(r.TransactionID)<180000)?'<span style="background:#ff6f00;color:#fff;font-size:10px;padding:1px 4px;border-radius:3px;margin-right:3px">NEW</span>':'';return '<tr data-idx="'+idx+'">'+'<td>'+nb+at+'</td>'+'<td>'+prio+'</td>'+'<td>'+hl(amt,isAmt)+'</td>'+'<td>'+hl(sN,isName)+'</td>'+'<td>'+hl(sA,isAcct)+'</td>'+'<td>'+hl(rN,isName||isGeo)+'</td>'+'<td>'+hl(rA,isAcct||isGeo)+'</td>'+'<td style="color:#444">'+t+'</td>'+'<td><button class="vbtn" onclick="window.__ocSM('+idx+')">View</button></td>'+'</tr>';}
function showModal(idx){
var r=allRecords[idx];if(!r)return;
var old=document.getElementById('__oc_modal_wrap');if(old)old.remove();
var origAt=r.AlertType||'';var dispAt=alertLabel(origAt);
var isName=origAt==='PEP_MATCH'||origAt==='SANCTIONS_LIST_MATCH';
var isAcct=origAt==='SHELL_COMPANY'||origAt==='RAPID_MOVEMENT';
var isAmt=origAt==='DOLLAR_MATCH'||origAt==='ROUND_DOLLAR_AMOUNTS'||origAt==='HIGH_VALUE_TRANSACTION';
var isGeo=origAt==='HIGH_RISK_COUNTRY';var isSt=origAt==='STRUCTURING';
var mf={SenderFirstName:isName,SenderLastName:isName,SenderAddressLine1:isName,SenderCity:isName,SenderState:isName,ReceiverFirstName:isName,ReceiverLastName:isName,ReceiverAddressLine1:isName,ReceiverCity:isName,ReceiverState:isName,SenderBankAccountNumber:isAcct,SenderBankRoutingNumber:isAcct,ReceiverBankAccountNumber:isAcct,ReceiverBankRoutingNumber:isAcct,Amount:isAmt||isSt,ReceiverCountry:isGeo};
var reasons=[];if(isName)reasons.push('Name/Address');if(isAcct)reasons.push('Account+Routing');if(isAmt)reasons.push('Dollar Amount');if(isGeo)reasons.push('Geographic');if(isSt)reasons.push('Structuring');
var secs={'Alert Info':['AlertType','PRIORITY','MatchType','FundsFlow','Channel','CurrencyCode'],'Transaction':['TransactionID','TransactionTime','Amount'],'Sender':['SenderFirstName','SenderLastName','SenderBankAccountNumber','SenderBankRoutingNumber','SenderBankName','SenderTaxID','SenderAddressLine1','SenderCity','SenderState','SenderPostcode'],'Receiver':['ReceiverFirstName','ReceiverLastName','ReceiverBankAccountNumber','ReceiverBankRoutingNumber','ReceiverBankName','ReceiverTaxID','ReceiverAddressLine1','ReceiverCity','ReceiverState','ReceiverCountry','ReceiverPostcode'],'Metadata':['WatcherGuid','UserId']};
var mw=document.createElement('div');mw.id='__oc_modal_wrap';mw.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;padding:30px 20px;overflow:auto';
var box=document.createElement('div');box.style.cssText='background:#fff;border-radius:8px;width:100%;max-width:640px;box-shadow:0 8px 40px rgba(0,0,0,.3);overflow:hidden;margin:auto';
var mhdr=document.createElement('div');mhdr.style.cssText='background:#0d2d6e;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center';
var mhl=document.createElement('div');
var mt=document.createElement('div');mt.style.cssText='font-size:16px;font-weight:700';mt.textContent='Full Alert Record';
var ms=document.createElement('div');ms.style.cssText='font-size:12px;opacity:.8';ms.textContent=dispAt+' | '+prioBadge(r.PRIORITY).replace(/<[^>]+>/g,'');
mhl.appendChild(mt);mhl.appendChild(ms);
var mcb=document.createElement('button');mcb.textContent='X';mcb.style.cssText='background:none;border:none;color:#fff;font-size:24px;cursor:pointer;padding:0';mcb.onclick=function(){mw.remove();};
mhdr.appendChild(mhl);mhdr.appendChild(mcb);
var mbody=document.createElement('div');mbody.style.cssText='padding:16px 20px;max-height:72vh;overflow-y:auto';
if(reasons.length){var banner=document.createElement('div');banner.style.cssText='background:#e8f5e9;border-left:4px solid #2e7d32;padding:8px 12px;margin-bottom:12px;font-size:14px';banner.innerHTML='<b>Match:</b> '+reasons.join(' + ');mbody.appendChild(banner);}
Object.keys(secs).forEach(function(sn){
var hasRows=false;
var sec=document.createElement('div');sec.style.marginBottom='12px';
var sh=document.createElement('div');sh.style.cssText='font-size:11px;font-weight:700;color:#0d2d6e;text-transform:uppercase;border-bottom:2px solid #e0e7ff;padding-bottom:3px;margin-bottom:2px';sh.textContent=sn;
var stbl=document.createElement('table');stbl.style.width='100%';
secs[sn].forEach(function(f2){
var val=r[f2];if(val===undefined||val===null||val==='')return;
var im=!!mf[f2];hasRows=true;
var dv=String(val);
if(f2==='PRIORITY')dv=prioBadge(val).replace(/<[^>]+>/g,'');
else if(f2==='AlertType')dv=dispAt;
else if(f2==='Amount')dv='$'+parseFloat(val).toLocaleString('en-US',{minimumFractionDigits:2});
var tr=document.createElement('tr');if(im)tr.style.background='#e8f5e9';
var td1=document.createElement('td');td1.style.cssText='font-size:13px;padding:5px 10px;width:42%;border-bottom:1px solid #f0f0f0';td1.style.color=im?'#2e7d32':'#666';td1.style.fontWeight=im?'700':'400';td1.textContent=f2;
var td2=document.createElement('td');td2.style.cssText='font-size:14px;padding:5px 10px;border-bottom:1px solid #f0f0f0';td2.style.fontWeight=im?'800':'400';td2.style.color=im?'#1b5e20':'#333';td2.textContent=dv;
tr.appendChild(td1);tr.appendChild(td2);stbl.appendChild(tr);
});
if(hasRows){sec.appendChild(sh);sec.appendChild(stbl);mbody.appendChild(sec);}
});
box.appendChild(mhdr);box.appendChild(mbody);mw.appendChild(box);document.body.appendChild(mw);
mw.addEventListener('click',function(e){if(e.target===mw)mw.remove();});
}
window.__ocSM=showModal;
async function load(){var tb=document.getElementById('__oc_tbody'),ts=document.getElementById('__oc_ts'),cnt=document.getElementById('__oc_cnt');if(ts)ts.textContent='Refreshing...';try{var resp=await fetch(API+'&dataAgeHours='+currentHours);var d=await resp.json();var fetched=(d.body||[]).filter(function(r){var at=alertLabel(r.AlertType||'');if(at==='HIGH_VALUE_TRANSACTION')return parseFloat(r.Amount||0)>4000000;if(at==='HIGH_RISK_COUNTRY'){var c=(r.ReceiverCountry||'').trim().toUpperCase();return c&&US_VALS.indexOf(c)<0;}return true;});var sorted=fetched.slice().sort(function(a,b){return (b.TransactionTime||b.TransactionUTCTime||'').localeCompare(a.TransactionTime||a.TransactionUTCTime||'');});var newOnes=sorted.filter(function(r){return r.TransactionID&&!knownIds.has(r.TransactionID);});var hasNew=newOnes.length>0&&knownIds.size>0;sorted.forEach(function(r){if(r.TransactionID)knownIds.add(r.TransactionID);});newOnes.forEach(function(r){if(r.TransactionID)newTimestamps.set(r.TransactionID,Date.now());});allRecords=sorted;if(ts)ts.textContent='Refreshed: '+new Date().toLocaleTimeString()+(hasNew?' (+'+newOnes.length+' new)':'');if(cnt)cnt.textContent=allRecords.length+' matched alerts';if(tb)tb.innerHTML=allRecords.length?allRecords.slice(0,100).map(buildRow).join(''):'<tr><td colspan="9" style="text-align:center;padding:20px">No records</td></tr>';}catch(e){if(ts)ts.textContent='Error: '+e.message;}}
var css='#__oc_overlay{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100vh!important;z-index:2147483647!important;background:#fff;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:12px 20px 0;box-sizing:border-box;display:flex;flex-direction:column}#__oc_overlay .hdr{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0d2d6e;padding-bottom:8px;margin-bottom:8px;flex-shrink:0}#__oc_overlay h2{color:#0d2d6e;margin:0 0 3px;font-size:22px;font-weight:800}#__oc_overlay .analyst{font-size:17px;color:#333;font-weight:600;display:flex;align-items:center;gap:10px}#__oc_overlay .aname{font-weight:800;color:#0d2d6e}#__oc_overlay .controls{display:flex;align-items:center;gap:12px;margin:0 0 8px;font-size:15px;color:#555;flex-shrink:0}#__oc_overlay .badge{background:#0d2d6e;color:#fff;border-radius:12px;padding:3px 14px;font-size:15px;font-weight:600}#__oc_overlay select{border:1px solid #bbb;border-radius:4px;padding:4px 8px;font-size:15px}#__oc_overlay .closebtn{cursor:pointer;color:#999;font-size:28px;background:none;border:none;padding:0 0 0 12px;line-height:1;flex-shrink:0}#__oc_overlay img.logo{height:66px;width:auto;margin-left:16px}#__oc_overlay .tblwrap{flex:1;overflow:auto;min-height:0}#__oc_overlay table{width:100%;border-collapse:collapse;font-size:16px;table-layout:fixed}#__oc_overlay th{background:#0d2d6e;color:#fff;padding:10px 14px;text-align:left;position:sticky;top:0;z-index:1;white-space:nowrap;font-size:16px;font-weight:700}#__oc_overlay td{padding:10px 14px;border-bottom:1px solid #e8edf5;vertical-align:middle;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#__oc_overlay th:nth-child(1),#__oc_overlay td:nth-child(1){width:14%}#__oc_overlay th:nth-child(2),#__oc_overlay td:nth-child(2){width:7%}#__oc_overlay th:nth-child(3),#__oc_overlay td:nth-child(3){width:11%}#__oc_overlay th:nth-child(4),#__oc_overlay td:nth-child(4){width:13%}#__oc_overlay th:nth-child(5),#__oc_overlay td:nth-child(5){width:11%}#__oc_overlay th:nth-child(6),#__oc_overlay td:nth-child(6){width:13%}#__oc_overlay th:nth-child(7),#__oc_overlay td:nth-child(7){width:11%}#__oc_overlay th:nth-child(8),#__oc_overlay td:nth-child(8){width:11%}#__oc_overlay th:nth-child(9),#__oc_overlay td:nth-child(9){width:9%}#__oc_overlay tr:nth-child(even){background:#f7f9ff}#__oc_overlay tr:hover{background:#e8f0fe}#__oc_overlay .hlkey{display:inline-flex;align-items:center;gap:4px}#__oc_overlay .hlsw{display:inline-block;width:14px;height:14px;background:#b2f0b2;border:1px solid #6dbf6d;border-radius:2px}#__oc_overlay .vbtn{background:#1565C0;color:#fff;border:none;border-radius:4px;padding:5px 12px;font-size:14px;cursor:pointer}#__oc_overlay .vbtn:hover{background:#0d47a1}#__oc_overlay .ubtn{background:#1565C0;color:#fff;border:none;border-radius:4px;padding:5px 14px;font-size:14px;cursor:pointer;font-weight:600}#__oc_overlay .ubtn:hover{background:#0d47a1}#__oc_overlay .ebtn{background:#2e7d32;color:#fff;border:none;border-radius:4px;padding:5px 16px;font-size:15px;cursor:pointer;font-weight:600}#__oc_overlay .ebtn:hover{background:#1b5e20}';
var el=document.createElement('style');el.id='__oc_style';el.textContent=css;document.head.appendChild(el);
wrap=document.createElement('div');wrap.id='__oc_overlay';
hdr=document.createElement('div');hdr.className='hdr';
left=document.createElement('div');
h2el=document.createElement('h2');h2el.textContent='Financial Transaction Real Time Alert Watch List';
anel=document.createElement('div');anel.className='analyst';
var anlLabel=document.createTextNode('Authorized Analyst: ');
anlSpan=document.createElement('span');anlSpan.className='aname';anlSpan.textContent=userId;
fInput=document.createElement('input');fInput.type='file';fInput.accept='.csv';fInput.style.display='none';
uploadBtn=document.createElement('button');uploadBtn.className='ubtn';uploadBtn.textContent='Upload Authorized Match Data';uploadBtn.onclick=function(){fInput.click();};
anlStatus=document.createElement('span');anlStatus.id='__oc_ast';anlStatus.style.cssText='font-size:14px;color:#888';
anel.appendChild(anlLabel);anel.appendChild(anlSpan);anel.appendChild(uploadBtn);anel.appendChild(fInput);anel.appendChild(anlStatus);
fInput.onchange=async function(){var file=this.files[0];if(!file)return;anlStatus.textContent='Uploading...';anlStatus.style.color='#888';try{var txt=await file.text();var resp=await fetch('https://oloaxv80ee.execute-api.us-east-1.amazonaws.com/prod/postMatchFile?userId='+userId,{method:'POST',headers:{'Content-Type':'text/csv'},body:txt});var ok=resp.ok;anlStatus.textContent=ok?'Uploaded OK':'Failed ('+resp.status+')';anlStatus.style.color=ok?'#2e7d32':'#c62828';if(ok){knownIds.clear();load();}setTimeout(function(){anlStatus.textContent='';},5000);}catch(e){anlStatus.textContent='Error';anlStatus.style.color='#c62828';}this.value='';};
left.appendChild(h2el);left.appendChild(anel);
right=document.createElement('div');right.style.cssText='display:flex;align-items:center';
if(LOGO){img=document.createElement('img');img.className='logo';img.src=LOGO;img.alt='TransNexus';right.appendChild(img);}
cb=document.createElement('button');cb.className='closebtn';cb.textContent='X';cb.onclick=function(){document.getElementById('__oc_overlay').remove();document.getElementById('__oc_style').remove();clearInterval(window.__oc_int);var mw=document.getElementById('__oc_modal_wrap');if(mw)mw.remove();};right.appendChild(cb);
hdr.appendChild(left);hdr.appendChild(right);wrap.appendChild(hdr);
ctrl=document.createElement('div');ctrl.className='controls';ctrl.innerHTML='<span>Time range:</span><select id="__oc_range"><option value="1">Last 1 Hour</option><option value="24" selected>Last 24 Hours</option><option value="168">Last 7 Days</option><option value="720">Last 30 Days</option></select><span id="__oc_ts">Loading...</span><span class="badge" id="__oc_cnt">...</span><span class="hlkey"><span class="hlsw"></span><span>= Matched</span></span><span style="margin-left:auto"><button class="ebtn" id="__oc_exp">Export CSV</button></span>';
wrap.appendChild(ctrl);
tbl=document.createElement('table');tbl.innerHTML='<thead><tr><th>Alert Type</th><th>Priority</th><th>Amount</th><th>Sender Name</th><th>Sender Account</th><th>Receiver Name</th><th>Receiver Account</th><th>Time (UTC)</th><th>Detail</th></tr></thead><tbody id="__oc_tbody"><tr><td colspan="9" style="text-align:center;padding:24px;color:#888">Loading...</td></tr></tbody>';
tw=document.createElement('div');tw.className='tblwrap';tw.appendChild(tbl);wrap.appendChild(tw);document.body.appendChild(wrap);
document.getElementById('__oc_range').onchange=function(){currentHours=parseInt(this.value);knownIds.clear();load();};
document.getElementById('__oc_exp').onclick=exportCsv;
await load();
window.__oc_int=setInterval(function(){load();},60000);
return 'ready';
})()