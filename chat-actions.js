/* NovaBet demo: let the live chat (agent / AI Agent) operate the page.
 * Commands can arrive from: Comm100 agent/bot messages, visitor slash commands,
 * URL hash links (#nb=...), or the on-page test console.
 * Every chat-initiated action needs the visitor to confirm it first.
 */
(function(){
  var NB = window.NovaBet;
  if(!NB){ console.warn("NovaBet core not found"); return; }
  var S = NB.state, fmt = NB.fmt;
  var USER = {id:"demo_user", name:"示範會員"};

  var store = {
    get:function(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
    set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
  };
  var tx = store.get("nb_tx", []);   // withdrawals
  var lastAction = store.get("nb_last_action", "無");
  function saveTx(){ store.set("nb_tx", tx); store.set("nb_last_action", lastAction); }
  var $ = function(id){return document.getElementById(id)};
  var esc = function(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};

  /* ---------- styles ---------- */
  var css = ''
  + '.user-chip{display:flex;align-items:center;gap:6px;white-space:nowrap;font-size:12px;color:var(--muted)}'
  + '.user-chip b{color:var(--text)}.user-chip .av{width:26px;height:26px;border-radius:50%;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}'
  + '.nb-modal{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}'
  + '.nb-modal[hidden]{display:none}'
  + '.nb-dlg{width:100%;max-width:420px;background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden;max-height:90vh;display:flex;flex-direction:column}'
  + '.nb-dlg h3{margin:0;padding:14px 16px;border-bottom:1px solid var(--line);font-size:16px;display:flex;justify-content:space-between;align-items:center}'
  + '.nb-dlg .bd{padding:16px;overflow:auto}'
  + '.nb-dlg .ft{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--line)}'
  + '.nb-dlg .ft .btn{flex:1;padding:10px}'
  + '.nb-dlg label{display:block;color:var(--muted);font-size:12px;margin:10px 0 4px}'
  + '.nb-dlg select,.nb-dlg input[type=text]{width:100%;background:var(--bg);border:1px solid var(--line);border-radius:8px;color:var(--text);padding:9px 10px}'
  + '.nb-kv{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--line)}'
  + '.nb-kv span{color:var(--muted)}'
  + '.nb-src{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(76,141,255,.15);color:var(--blue);margin-bottom:10px}'
  + '.nb-warn{color:var(--down);font-size:12px;margin-top:8px}'
  + '.nb-tabs{display:flex;border-bottom:1px solid var(--line)}'
  + '.nb-tabs button{flex:1;padding:10px;color:var(--muted);border-bottom:2px solid transparent}'
  + '.nb-tabs button.on{color:var(--text);border-color:var(--accent)}'
  + '.nb-tx{border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px;font-size:12px}'
  + '.nb-tx .h1{display:flex;justify-content:space-between;margin-bottom:2px}'
  + '.cmd-card{padding:16px;margin-top:16px}'
  + '.cmd-card h3{margin:0 0 4px;font-size:16px}'
  + '.cmd-card .note{margin:0 0 10px;color:var(--muted);font-size:12px}'
  + '.cmd-row{display:flex;gap:8px}'
  + '.cmd-row input{flex:1;min-width:0;background:var(--bg);border:1px solid var(--line);border-radius:8px;color:var(--text);padding:9px 10px;font-family:ui-monospace,Menlo,monospace;font-size:13px}'
  + '.cmd-ex{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}'
  + '.cmd-ex button{font-size:12px;padding:5px 9px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-family:ui-monospace,Menlo,monospace}'
  + '.cmd-ex button:hover{color:var(--text);border-color:var(--accent)}'
  + '.cmd-log{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:12px;max-height:180px;overflow:auto;font-family:ui-monospace,Menlo,monospace}'
  + '.cmd-log div{padding:2px 0;color:var(--muted)}.cmd-log .ok{color:var(--up)}.cmd-log .err{color:var(--down)}'
  + '.cmd-opt{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:12px;margin-top:8px}'
  + '@media (max-width:760px){.user-chip span.t{display:none}}';
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---------- header: logged-in user + wallet ---------- */
  var top = document.querySelector("header .top");
  var chip = document.createElement("div");
  chip.className = "user-chip";
  chip.innerHTML = '<div class="av">示</div><span class="t">已登入 <b>'+USER.name+'</b>（'+USER.id+'）</span>';
  var wbtn = document.createElement("button");
  wbtn.className = "btn btn-gold"; wbtn.id = "walletBtn"; wbtn.textContent = "提款";
  top.insertBefore(chip, top.querySelector(".wallet"));
  top.insertBefore(wbtn, $("resetBtn"));

  /* ---------- modals ---------- */
  var modal = document.createElement("div");
  modal.className = "nb-modal"; modal.hidden = true; modal.id = "nbModal";
  modal.innerHTML = '<div class="nb-dlg" role="dialog" aria-modal="true"><h3><span id="nbmTitle"></span><button id="nbmX" aria-label="關閉">×</button></h3><div class="bd" id="nbmBody"></div><div class="ft" id="nbmFoot"></div></div>';
  document.body.appendChild(modal);
  var onClose = null;
  function openModal(title, body, foot, closeCb){
    $("nbmTitle").textContent = title; $("nbmBody").innerHTML = body; $("nbmFoot").innerHTML = foot || "";
    $("nbmFoot").hidden = !foot; modal.hidden = false; onClose = closeCb || null;
  }
  function closeModal(){ modal.hidden = true; var cb = onClose; onClose = null; if(cb) cb(); }
  $("nbmX").addEventListener("click", closeModal);
  modal.addEventListener("click", function(e){ if(e.target===modal) closeModal(); });

  /* ---------- wallet / withdraw ---------- */
  var DEST = ["示範銀行帳戶 ****6688（虛構）","示範電子錢包 NovaPay（虛構）"];
  function walletBody(tab){
    var pending = tx.filter(function(t){return t.status==="處理中"}).reduce(function(a,t){return a+t.amount},0);
    var h = '<div class="nb-tabs"><button data-wt="w" class="'+(tab!=="t"?"on":"")+'">提款</button><button data-wt="t" class="'+(tab==="t"?"on":"")+'">提款紀錄</button></div>';
    if(tab==="t"){
      h += tx.length ? tx.slice().reverse().map(function(t){
        return '<div class="nb-tx"><div class="h1"><b>提款 '+fmt(t.amount)+'</b><span class="badge '+(t.status==="已完成"?"w":"p")+'">'+t.status+'</span></div><div class="legs">'+esc(t.dest)+' · '+t.time+(t.via?' · 經由'+esc(t.via):'')+'</div></div>';
      }).join("") : '<div class="empty">尚無提款紀錄</div>';
      return h;
    }
    h += '<div style="padding-top:8px"><div class="nb-kv"><span>可提款餘額</span><b>'+fmt(S.bal)+'</b></div>'
      + '<div class="nb-kv"><span>處理中的提款</span><b>'+fmt(pending)+'</b></div></div>'
      + '<label for="wAmt">提款金額（最低 100）</label><input type="text" inputmode="numeric" id="wAmt" placeholder="輸入金額">'
      + '<label for="wDest">提款至</label><select id="wDest">'+DEST.map(function(d,i){return '<option value="'+i+'">'+d+'</option>'}).join("")+'</select>'
      + '<div class="nb-warn" id="wErr"></div>';
    return h;
  }
  function openWallet(tab){
    var foot = tab==="t" ? "" : '<button class="btn btn-ghost" data-act="close">取消</button><button class="btn btn-gold" data-act="wd">確認提款（示範）</button>';
    openModal("示範錢包", walletBody(tab), foot);
  }
  wbtn.addEventListener("click", function(){ openWallet("w"); });
  modal.addEventListener("click", function(e){
    var t = e.target.closest("button"); if(!t) return;
    if(t.dataset.wt){ openWallet(t.dataset.wt); return; }
    if(t.dataset.act==="close"){ closeModal(); return; }
    if(t.dataset.act==="wd"){
      var amt = parseInt(($("wAmt").value||"").replace(/[^0-9]/g,""),10)||0;
      var r = doWithdraw(amt, DEST[+$("wDest").value], null);
      if(!r.ok){ $("wErr").textContent = r.msg; return; }
      openWallet("t");
    }
  });
  document.addEventListener("input", function(e){ if(e.target.id==="wAmt") e.target.value = e.target.value.replace(/[^0-9]/g,""); });

  function now(){ var d=new Date(); return d.getHours()+":"+String(d.getMinutes()).padStart(2,"0"); }

  function doWithdraw(amount, dest, via){
    if(!(amount>0)) return {ok:false,msg:"請輸入提款金額"};
    if(amount<100) return {ok:false,msg:"最低提款金額為 100"};
    if(amount>S.bal) return {ok:false,msg:"示範餘額不足（目前 "+fmt(S.bal)+"）"};
    var t = {id:Date.now(), amount:amount, dest:dest||DEST[0], status:"處理中", time:now(), via:via||""};
    tx.push(t); S.bal -= amount;
    lastAction = "提款 "+fmt(amount)+" 至 "+t.dest+"（處理中）";
    saveTx(); NB.save(); NB.renderBal();
    NB.toast("示範提款申請已送出：" + fmt(amount));
    setTimeout(function(){ t.status="已完成"; lastAction="提款 "+fmt(amount)+" 已完成"; saveTx(); pushVars(); }, 10000);
    return {ok:true, msg:"已申請提款 "+fmt(amount)+" 至 "+t.dest+"，約 10 秒後完成。剩餘餘額 "+fmt(S.bal)+"。"};
  }

  /* ---------- betting from commands ---------- */
  var PICK = {home:0,h:0,"1":0,"主":0,"主勝":0, draw:1,x:1,d:1,"和":1,"和局":1, away:2,a:2,"2":2,"客":2,"客勝":2};
  function findMatch(q){
    q = String(q||"").trim(); if(!q) return null;
    if(/^\d+$/.test(q)) return NB.matchById(+q) || null;
    var low = q.toLowerCase();
    for(var i=0;i<NB.MATCHES.length;i++){
      var m = NB.MATCHES[i];
      if(m.home.toLowerCase().indexOf(low)>=0 || m.away.toLowerCase().indexOf(low)>=0) return m;
    }
    return null;
  }
  function pickIndex(m, p){
    p = String(p||"").trim(); var low = p.toLowerCase();
    if(PICK.hasOwnProperty(low)) return PICK[low];
    if(PICK.hasOwnProperty(p)) return PICK[p];
    if(m.home.toLowerCase().indexOf(low)>=0) return 0;
    if(m.away.toLowerCase().indexOf(low)>=0) return 2;
    return -1;
  }
  function resolveLeg(mq, pq){
    var m = findMatch(mq); if(!m) return {err:"找不到賽事「"+mq+"」"};
    var i = pickIndex(m, pq); if(i<0) return {err:"無法辨識選項「"+pq+"」（可用 home/draw/away 或 主勝/和局/客勝）"};
    if(m.o[i]===null) return {err:m.home+" vs "+m.away+" 沒有「"+NB.LABELS[i]+"」選項"};
    return {m:m, i:i};
  }
  function legText(l){ return l.m.home+" vs "+l.m.away+" — "+NB.LABELS[l.i]+" @ "+l.m.o[l.i].toFixed(2); }

  function doBet(legs, amount, via){
    if(!(amount>0)) return {ok:false,msg:"請指定下注金額"};
    if(amount>S.bal) return {ok:false,msg:"示範餘額不足（目前 "+fmt(S.bal)+"）"};
    var parlay = legs.length>1, odds = 1;
    legs.forEach(function(l){ odds *= l.m.o[l.i]; });
    if(parlay && legs.length>=3) odds *= 1.10;
    var legStr = legs.map(function(l){return l.m.home+" vs "+l.m.away+" — "+NB.LABELS[l.i]});
    S.hist.push({id:Date.now(), parlay:parlay, legs:legStr, stake:amount, odds:odds, win:amount*odds, status:"pending", time:now(), via:via||""});
    S.bal -= amount;
    lastAction = (parlay?"串關 "+legs.length+" 場":"單注 "+legStr[0])+"，金額 "+fmt(amount)+" @ "+odds.toFixed(2);
    saveTx(); NB.save(); NB.renderBal(); NB.renderHist();
    NB.toast("示範注單已送出，約 15 秒後自動結算");
    setTimeout(NB.settle, 15000);
    return {ok:true, msg:"已下注："+(parlay?"串關 ":"")+legs.map(legText).join("、")+"，金額 "+fmt(amount)+"，潛在獎金 "+fmt(amount*odds)+"。剩餘餘額 "+fmt(S.bal)+"。"};
  }

  /* ---------- command parsing ---------- */
  // [NB:bet match=1 pick=home amount=100]
  // [NB:parlay legs=1-home,6-away amount=200]
  // [NB:withdraw amount=500]   [NB:balance]   [NB:bets]
  // Slash form (visitor or console): /bet 1 home 100 · /parlay 1-home,6-away 200 · /withdraw 500 · /balance · /bets
  function kv(s){
    var o = {}, re = /(\w+)\s*=\s*("([^"]*)"|[^\s\]]+)/g, m;
    while((m = re.exec(s))) o[m[1].toLowerCase()] = m[3]!==undefined ? m[3] : m[2];
    return o;
  }
  function parseAll(text){
    var out = [], re = /\[\s*NB\s*:\s*(\w+)([^\]]*)\]/gi, m;
    while((m = re.exec(text))) out.push({op:m[1].toLowerCase(), args:kv(m[2]), raw:m[0]});
    if(out.length) return out;
    var s = String(text).trim();
    var sm = /^\/(bet|parlay|withdraw|balance|bets)\b\s*(.*)$/i.exec(s);
    if(sm){
      var op = sm[1].toLowerCase(), p = sm[2].trim().split(/\s+/).filter(Boolean), a = {};
      if(op==="bet"){ a.match=p[0]; a.pick=p[1]; a.amount=p[2]; }
      if(op==="parlay"){ a.legs=p[0]; a.amount=p[1]; }
      if(op==="withdraw"){ a.amount=p[0]; a.to=p[1]; }
      out.push({op:op, args:a, raw:s});
    }
    return out;
  }
  function num(v){ return parseInt(String(v||"").replace(/[^0-9]/g,""),10)||0; }
  function amtErr(amt, min){
    if(!(amt>0)) return "請指定金額";
    if(min && amt<min) return "最低金額為 "+fmt(min);
    if(amt>S.bal) return "示範餘額不足（目前 "+fmt(S.bal)+"）";
    return "";
  }

  // Turn a parsed command into {summary, run} or {error}
  function plan(c){
    var a = c.args;
    if(c.op==="balance") return {readonly:true, run:function(){ return {ok:true,msg:"目前示範餘額 "+fmt(S.bal)+"。"}; }};
    if(c.op==="bets") return {readonly:true, run:function(){
      var p = S.hist.filter(function(h){return h.status==="pending"});
      var last = S.hist.slice(-3).reverse().map(function(h){return (h.parlay?"串關":"單注")+" "+fmt(h.stake)+"（"+(h.status==="pending"?"待結算":h.status==="win"?"贏":"輸")+"）"});
      return {ok:true,msg:"待結算注單 "+p.length+" 張。最近："+(last.join("；")||"無")+"。"};
    }};
    if(c.op==="bet"){
      var l = resolveLeg(a.match||a.team, a.pick||a.side); if(l.err) return {error:l.err};
      var amt = num(a.amount||a.stake); if(amtErr(amt)) return {error:amtErr(amt)};
      return {summary:[["類型","單注"],["賽事",l.m.home+" vs "+l.m.away],["選項",NB.LABELS[l.i]+"（目前賠率 "+l.m.o[l.i].toFixed(2)+"）"],["金額",fmt(amt)],["潛在獎金",fmt(amt*l.m.o[l.i])]],
        run:function(){ var r = resolveLeg(a.match||a.team, a.pick||a.side); return r.err?{ok:false,msg:r.err}:doBet([r], amt, c.via); }};
    }
    if(c.op==="parlay"){
      var parts = String(a.legs||"").split(/[,，]/).filter(Boolean), legs = [];
      for(var i=0;i<parts.length;i++){
        var mp = parts[i].split(/[-:：]/); var r = resolveLeg(mp[0], mp[1]); if(r.err) return {error:r.err};
        if(legs.some(function(x){return x.m.id===r.m.id})) return {error:"同一場比賽不能在串關中選兩次"};
        legs.push(r);
      }
      if(legs.length<2) return {error:"串關至少需要 2 場"};
      var amt2 = num(a.amount||a.stake); if(amtErr(amt2)) return {error:amtErr(amt2)};
      var odds = legs.reduce(function(x,l){return x*l.m.o[l.i]},1)*(legs.length>=3?1.1:1);
      var rows = [["類型","串關 "+legs.length+" 場"+(legs.length>=3?"（含 10% 加成）":"")]];
      legs.forEach(function(l,k){ rows.push(["第 "+(k+1)+" 場", legText(l)]); });
      rows.push(["金額",fmt(amt2)],["串關賠率",odds.toFixed(2)],["潛在獎金",fmt(amt2*odds)]);
      return {summary:rows, run:function(){
        var fresh = []; for(var j=0;j<parts.length;j++){ var q=parts[j].split(/[-:：]/), x=resolveLeg(q[0],q[1]); if(x.err) return {ok:false,msg:x.err}; fresh.push(x); }
        return doBet(fresh, amt2, c.via);
      }};
    }
    if(c.op==="withdraw"){
      var w = num(a.amount); if(amtErr(w,100)) return {error:amtErr(w,100)};
      var di = /wallet|錢包|pay/i.test(a.to||"") ? 1 : 0;
      return {summary:[["類型","提款"],["金額",fmt(w)],["提款至",DEST[di]],["提款後餘額",fmt(S.bal-w)]],
        run:function(){ return doWithdraw(w, DEST[di], c.via); }};
    }
    return {error:"不支援的指令「"+c.op+"」"};
  }

  /* ---------- confirmation queue ---------- */
  var queue = [], busy = false;
  function enqueue(c){ queue.push(c); next(); }
  function next(){
    if(busy || !queue.length) return;
    var c = queue.shift(), p = plan(c);
    if(p.error){ log(c, false, p.error); report(c, "❌ 無法執行："+p.error); return next(); }
    if(p.readonly){ var r0 = p.run(); log(c, true, r0.msg); report(c, "ℹ️ "+r0.msg); return next(); }
    busy = true;
    var body = '<span class="nb-src">來源：'+esc(c.via)+'</span>'
      + '<div style="margin-bottom:8px">客服請求代你執行以下操作，請確認：</div>'
      + p.summary.map(function(r){return '<div class="nb-kv"><span>'+esc(r[0])+'</span><b>'+esc(r[1])+'</b></div>'}).join("")
      + '<div class="note" style="color:var(--muted);font-size:12px;margin-top:10px">示範操作，使用虛擬點數，不涉及真實金錢。</div>';
    var decided = false;
    openModal("確認代操作", body, '<button class="btn btn-ghost" id="cfNo">取消</button><button class="btn btn-gold" id="cfYes">確認執行</button>', function(){
      if(!decided){ decided = true; log(c,false,"使用者取消"); report(c,"🚫 使用者已取消此操作。"); }
      busy = false; setTimeout(next, 0);
    });
    $("cfYes").onclick = function(){
      decided = true; var r = p.run();
      log(c, r.ok, r.msg); report(c, (r.ok?"✅ ":"❌ ")+r.msg); pushVars();
      closeModal();
    };
    $("cfNo").onclick = function(){ closeModal(); };
  }

  /* ---------- report back + custom variables ---------- */
  var reportOn = store.get("nb_report", true);
  function chatReady(){ return window.Comm100API && typeof Comm100API.do==="function"; }
  function report(c, msg){
    if(!reportOn || c.via==="測試台" || c.via==="網址連結") return;
    if(!chatReady()) return;
    try{ ignoreNextVisitor = true; Comm100API.do("livechat.chat.visitor.sendText", "[系統回報] "+msg); }catch(e){}
  }
  function pushVars(){
    if(!(window.Comm100API && typeof Comm100API.set==="function")) return;
    var pend = S.hist.filter(function(h){return h.status==="pending"}).length;
    try{
      Comm100API.set("livechat.customVariables", [
        {name:"nb_user", value:USER.id},
        {name:"nb_balance", value:String(Math.round(S.bal))},
        {name:"nb_pending_bets", value:String(pend)},
        {name:"nb_last_action", value:lastAction}
      ]);
    }catch(e){}
  }
  window.addEventListener("nb:change", pushVars);
  // keep tabs in sync (a chat link may open the page in a new tab)
  window.addEventListener("storage", function(e){
    if(["nb_bal","nb_hist","nb_tx","nb_last_action"].indexOf(e.key)<0) return;
    S.bal = store.get("nb_bal", S.bal); S.hist = store.get("nb_hist", S.hist);
    tx = store.get("nb_tx", tx); lastAction = store.get("nb_last_action", lastAction);
    NB.renderBal(); NB.renderHist(); pushVars();
  });

  /* ---------- listen to the chat ---------- */
  var seen = {}, ignoreNextVisitor = false;
  function fresh(text){ var k = String(text), t = Date.now(); if(seen[k] && t-seen[k]<8000) return false; seen[k]=t; return true; }
  function clean(t){
    if(typeof t!=="string") return "";
    var doc = new DOMParser().parseFromString(t.replace(/<br\s*\/?>/gi,"\n"), "text/html");
    return (doc.body.textContent||"").replace(/ /g," ");
  }
  function handle(text, via){
    text = clean(text);
    if(typeof text!=="string" || !fresh(via+text)) return;
    parseAll(text).forEach(function(c){ c.via = via; enqueue(c); });
  }
  var hooked = false;
  function hook(){
    if(hooked || !(window.Comm100API && typeof Comm100API.on==="function")) return;
    hooked = true;
    try{
      Comm100API.on("livechat.chat.agent.input", function(agent, content){
        var who = (agent && (agent.name||agent.nickname)) || "客服";
        logRaw("收到客服訊息（"+who+"）："+String(typeof content==="string"?content:JSON.stringify(content)).slice(0,120));
        handle(typeof content==="string"?content:"", "線上客服（"+who+"）");
      });
      Comm100API.on("livechat.chat.visitor.input", function(content){
        if(ignoreNextVisitor){ ignoreNextVisitor = false; return; }
        if(typeof content==="string" && /^\s*\//.test(content)) handle(content, "你在聊天室輸入的指令");
      });
      Comm100API.on("livechat.chat.start", pushVars);
    }catch(e){ console.warn("Comm100 hook failed", e); }
    pushVars();
  }
  var tries = 0, iv = setInterval(function(){ hook(); if(hooked || ++tries>60) clearInterval(iv); }, 1000);

  /* ---------- URL hash links: #nb=bet&match=1&pick=home&amount=100 ---------- */
  function fromHash(){
    var h = location.hash.replace(/^#/,""); if(!/^nb=/.test(h)) return;
    var q = {}; h.split("&").forEach(function(p){ var kvp=p.split("="); q[decodeURIComponent(kvp[0])] = decodeURIComponent(kvp[1]||""); });
    var op = q.nb; delete q.nb;
    history.replaceState(null, "", location.pathname + location.search);
    enqueue({op:op.toLowerCase(), args:q, raw:"#nb="+op, via:"網址連結"});
  }
  window.addEventListener("hashchange", fromHash);

  /* ---------- on-page test console ---------- */
  var card = document.createElement("section");
  card.className = "card cmd-card"; card.id = "cmd-console";
  var EX = ["/bet 1 home 100","/bet 紅堡城 away 200","/parlay 1-home,6-away,7-draw 300","/withdraw 500","/balance","/bets","[NB:bet match=2 pick=away amount=150]","[NB:withdraw amount=1000 to=wallet]"];
  card.innerHTML = '<h3>客服代操作測試台</h3>'
    + '<p class="note">模擬客服在聊天中送出的指令。實際使用時，客服或 AI Agent 在聊天訊息中送出相同格式的指令，頁面會跳出確認視窗，你按「確認執行」後才會下注或提款。</p>'
    + '<div class="cmd-row"><input id="cmdIn" placeholder="/bet 1 home 100" autocomplete="off"><button class="btn btn-gold" id="cmdRun">送出</button></div>'
    + '<div class="cmd-ex">'+EX.map(function(x){return '<button data-ex="'+esc(x)+'">'+esc(x)+'</button>'}).join("")+'</div>'
    + '<div class="cmd-log" id="cmdLog"><div>等待指令… 聊天室連線狀態：<span id="cmdHook">連線中</span></div></div>'
    + '<label class="cmd-opt"><input type="checkbox" id="cmdReport" '+(reportOn?"checked":"")+'> 執行結果自動回報到聊天室</label>';
  var chatCard = document.querySelector(".chat-card");
  chatCard.parentNode.insertBefore(card, chatCard);
  $("cmdRun").onclick = function(){ var v=$("cmdIn").value.trim(); if(!v) return; seen = {}; var cs=parseAll(v); if(!cs.length){ logRaw("無法辨識的指令："+v, "err"); return; } cs.forEach(function(c){c.via="測試台"; enqueue(c);}); $("cmdIn").value=""; };
  $("cmdIn").addEventListener("keydown", function(e){ if(e.key==="Enter") $("cmdRun").click(); });
  card.addEventListener("click", function(e){ var b=e.target.closest("button[data-ex]"); if(b){ $("cmdIn").value=b.dataset.ex; $("cmdIn").focus(); } });
  $("cmdReport").onchange = function(){ reportOn = this.checked; store.set("nb_report", reportOn); };
  setInterval(function(){ var el=$("cmdHook"); if(el) el.textContent = hooked ? "已連線" : "未連線（客服程式尚未載入）"; }, 1000);

  function logRaw(msg, cls){ var d=document.createElement("div"); if(cls) d.className=cls; d.textContent="["+now()+"] "+msg; $("cmdLog").appendChild(d); $("cmdLog").scrollTop=1e9; }
  function log(c, ok, msg){ logRaw(c.via+" ▸ "+c.raw+" → "+msg, ok?"ok":"err"); }

  // small public API for debugging / future backends
  window.NovaBetChat = {run:function(text){ parseAll(text).forEach(function(c){c.via="測試台"; enqueue(c);}); }, parse:parseAll, withdrawals:function(){return tx.slice()}};

  fromHash();
})();
