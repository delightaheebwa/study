/* === PBL Sidebar Chat v3 — usage bar, persistent history, lighter prompt === */
(function () {
  var SERVER = window.PBL_SERVER || "http://localhost:8001";
  var DEFAULT_MODEL = "deepseek-v4-flash";
  var allModels = [];
  var lessonName = document.title || "lesson";
  var domainMeta = document.querySelector("meta[name='pbl-domain']");
  var lessonDomain = (domainMeta && domainMeta.getAttribute ? domainMeta.getAttribute("content") : null) || "llm-fundamentals";
  var chatHistory = [];
  var isOpen = false;
  var isSending = false;

  // Accumulators
  var accPrompt = 0, accCompletion = 0, accTotal = 0;
  var accCost = 0;
  var contextWindow = 131072;
  var currentModel = DEFAULT_MODEL;

  // ---- styles ----
  var style = document.createElement("style");
  style.textContent = [
    "#pbl-sidebar{position:fixed;top:0;right:0;width:420px;height:100vh;background:#1a1a2e;border-left:1px solid #333;z-index:10000;display:flex;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;color:#e0e0e0;transform:translateX(420px);transition:transform .3s ease;box-shadow:-4px 0 20px rgba(0,0,0,.4)}",
    "#pbl-sidebar.open{transform:translateX(0)}",
    "#pbl-toggle{position:fixed;top:50%;right:0;z-index:10001;background:#ff6b6b;color:#fff;border:none;border-radius:6px 0 0 6px;padding:12px 8px;cursor:pointer;font-size:18px;transition:right .3s ease}",
    "#pbl-toggle.open{right:420px}",
    "#pbl-toggle:hover{background:#ff5252}",
    "#pbl-header{padding:10px 14px;border-bottom:1px solid #333;background:#16213e;flex-shrink:0}",
    "#pbl-header-row{display:flex;justify-content:space-between;align-items:center;gap:8px}",
    "#pbl-header h3{margin:0;font-size:13px;color:#ff6b6b;white-space:nowrap}",
    "#pbl-model-select{background:#1e1e36;color:#e0e0e0;border:1px solid #333;border-radius:4px;padding:3px 6px;font-size:11px;cursor:pointer;max-width:160px}",
    "#pbl-usage-bar{padding:4px 14px;background:#111;font-size:11px;color:#888;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #222;flex-shrink:0;gap:6px;flex-wrap:wrap}",
    "#pbl-usage-bar .u-num{color:#ddd}",
    "#pbl-usage-bar .u-cost{color:#66bb6a}",
    "#pbl-usage-bar .u-ctx{color:#888}",
    "#pbl-usage-bar .u-ctx-warn{color:#d4a017}",
    "#pbl-usage-bar .u-ctx-full{color:#ef5350}",
    "#pbl-usage-bar .u-reset{color:#ff6b6b;cursor:pointer;font-size:11px;text-decoration:none;margin-left:4px}",
    "#pbl-usage-bar .u-reset:hover{text-decoration:underline}",
    ".pbl-ctx-fill{height:2px;background:#333;flex:1;min-width:40px;border-radius:1px}",
    ".pbl-ctx-fill-inner{height:100%;border-radius:1px;background:#ff6b6b;transition:width .3s ease}",
    "#pbl-chat{flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:8px;min-height:0;font-size:13px;line-height:1.5}",
    "#pbl-chat .msg{padding:8px 12px;border-radius:8px;word-wrap:break-word;white-space:pre-wrap}",
    "#pbl-chat .msg.user{align-self:flex-end;background:#2a2a4e;max-width:85%}",
    "#pbl-chat .msg.assistant{align-self:flex-start;background:#1e2a3a;max-width:100%}",
    "#pbl-chat .msg.system{align-self:center;background:#2a2a1a;font-style:italic;font-size:12px;color:#aaa;max-width:90%;text-align:center}",
    "#pbl-chat .msg.error{align-self:center;background:#3a1a1a;color:#ff6b6b;max-width:90%;text-align:center;border:1px solid #5a2e2e}",
    "#pbl-chat .msg pre{background:#111;padding:8px;border-radius:4px;overflow-x:auto;margin:4px 0;font-size:12px}",
    "#pbl-chat .msg code{background:#111;padding:1px 4px;border-radius:3px;font-size:12px}",
    ".pbl-spinner{display:inline-block;width:14px;height:14px;border:2px solid #555;border-top-color:#ff6b6b;border-radius:50%;animation:pblspin .6s linear infinite;margin-right:6px;vertical-align:middle}",
    "@keyframes pblspin{to{transform:rotate(360deg)}}",
    "#pbl-input-area{padding:10px 14px;border-top:1px solid #333;display:flex;gap:6px;background:#16213e;flex-shrink:0}",
    "#pbl-input{flex:1;background:#1e1e36;color:#e0e0e0;border:1px solid #333;border-radius:4px;padding:8px 10px;font-size:13px;font-family:inherit}",
    "#pbl-input:focus{outline:none;border-color:#ff6b6b}",
    "#pbl-send{background:#ff6b6b;color:#fff;border:none;border-radius:4px;padding:8px 14px;cursor:pointer;font-size:13px;font-weight:600}",
    "#pbl-send:disabled{opacity:.5;cursor:not-allowed}",
    "#pbl-end-session{background:#2a2a1a;color:#d4a017;border:1px solid #5a4e2e;border-radius:4px;padding:8px 14px;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap}",
    "#pbl-end-panel{display:none;padding:10px 14px;border-top:1px solid #333;background:#1e1e36;flex-direction:column;gap:8px;flex-shrink:0}",
    "#pbl-end-panel.show{display:flex}",
    "#pbl-end-panel textarea{background:#1a1a2e;color:#e0e0e0;border:1px solid #333;border-radius:4px;padding:8px;font-size:12px;resize:vertical;font-family:inherit;min-height:50px}",
    "#pbl-end-actions{display:flex;gap:8px;justify-content:flex-end}",
    "#pbl-end-actions button{padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;border:none}",
    "#pbl-end-confirm{background:#d4a017;color:#1a1a2e}",
    "#pbl-end-cancel{background:#333;color:#e0e0e0}",
    ".pbl-sel-btn{position:absolute;background:#ff6b6b;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer;z-index:10002;display:none}",
    "#pbl-reviews{padding:6px 14px;border-bottom:1px solid #333;background:#1e2a1a;font-size:11px;display:none;flex-shrink:0}",
    "#pbl-reviews.show{display:block}",
    "#pbl-reviews a{color:#66bb6a;cursor:pointer;text-decoration:underline}"
  ].join(" ");
  document.head.appendChild(style);

  // ---- build DOM ----
  var sidebar = document.createElement("div");
  sidebar.id = "pbl-sidebar";
  sidebar.innerHTML = [
    '<div id="pbl-header"><div id="pbl-header-row"><h3>PBL Tutor</h3><select id="pbl-model-select"></select></div></div>',
    '<div id="pbl-usage-bar"><span class="u-num">—</span><span class="u-cost">—</span><div class="pbl-ctx-fill"><div class="pbl-ctx-fill-inner" style="width:0%"></div></div></div>',
    '<div id="pbl-reviews"></div>',
    '<div id="pbl-chat"></div>',
    '<div id="pbl-end-panel">',
      '<textarea id="pbl-notes" placeholder="Session notes (optional)..."></textarea>',
      '<div id="pbl-end-actions">',
        '<button id="pbl-end-cancel">Cancel</button>',
        '<button id="pbl-end-confirm">End Session → Save</button>',
      '</div>',
    '</div>',
    '<div id="pbl-input-area">',
      '<input id="pbl-input" type="text" placeholder="Ask anything..." autocomplete="off">',
      '<button id="pbl-end-session" title="End session">End</button>',
      '<button id="pbl-send">Send</button>',
    '</div>'
  ].join("");
  document.body.appendChild(sidebar);

  var toggle = document.createElement("button");
  toggle.id = "pbl-toggle";
  toggle.textContent = "☰";
  toggle.title = "Toggle PBL Tutor";
  document.body.appendChild(toggle);

  var selBtn = document.createElement("button");
  selBtn.className = "pbl-sel-btn";
  selBtn.textContent = "Ask about this";
  document.body.appendChild(selBtn);

  // ---- refs ----
  var $ = function (id) { return document.getElementById(id); };
  var chat = $("pbl-chat");
  var input = $("pbl-input");
  var sendBtn = $("pbl-send");
  var modelSelect = $("pbl-model-select");
  var endBtn = $("pbl-end-session");
  var endPanel = $("pbl-end-panel");
  var endConfirm = $("pbl-end-confirm");
  var endCancel = $("pbl-end-cancel");
  var notesArea = $("pbl-notes");
  var reviewsDiv = $("pbl-reviews");
  var usageBar = $("pbl-usage-bar");
  var ctxFill = usageBar ? usageBar.querySelector(".pbl-ctx-fill-inner") : null;

  // ---- load models from server catalog ----
  fetch(SERVER + "/api/models").then(function(r){return r.json()}).then(function(data){
    allModels = data.models || [];
    modelSelect.innerHTML = "";
    (data.models || []).forEach(function(m){
      var o = document.createElement("option");
      o.value = m.id || m;
      o.textContent = m.id || m;
      if ((m.id || m) === DEFAULT_MODEL) o.selected = true;
      modelSelect.appendChild(o);
    });
    // Pick up context window for default model
    var dm = data.models.find(function(m){return (m.id||m)===DEFAULT_MODEL});
    if (dm && dm.ctx) contextWindow = dm.ctx;
  }).catch(function(){
    modelSelect.innerHTML = "<option>Server offline</option>";
  });

  modelSelect.addEventListener("change", function(){
    currentModel = modelSelect.value;
    var m = allModels.find(function(x){return (x.id||x)===currentModel});
    if (m && m.ctx) contextWindow = m.ctx;
    updateUsageBar();
  });

  // ---- check reviews ----
  function checkReviews(){
    fetch(SERVER + "/api/reviews").then(function(r){return r.json()}).then(function(d){
      if (d.due && d.due.length > 0) {
        reviewsDiv.className = "show";
        reviewsDiv.innerHTML = "📚 <b>Reviews due:</b> " +
          d.due.map(function(r){return '<a onclick="window.PBLreview(\''+r.slug+'\')">'+r.title+'</a>'}).join(", ");
      } else { reviewsDiv.className = ""; }
    }).catch(function(){});
  }
  checkReviews();
  window.PBLreview = function(slug){ addMsg("system", "Let's review \""+slug+"\"."); };

  // ---- usage bar ----
  function updateUsageBar() {
    if (!usageBar) return;
    var pct = contextWindow > 0 ? Math.min(100, (accTotal / contextWindow) * 100) : 0;
    var ctxClass = "";
    if (pct > 90) ctxClass = "u-ctx-full";
    else if (pct > 70) ctxClass = "u-ctx-warn";
    var ctxLabel = pct < 1 ? "<1%" : Math.round(pct) + "%";

    var costLabel = accCost < 0.001 ? "$0.00" : "$" + accCost.toFixed(3);
    // If total is 0, show demo mode indicator
    if (accTotal === 0) {
      usageBar.innerHTML = '<span class="u-num">—</span><span class="u-cost">—</span><span class="u-ctx">' + ctxLabel + '</span><a class="u-reset" onclick="window.PBLreset()">Reset</a>';
    } else {
      usageBar.innerHTML = '<span class="u-num">' + accTotal.toLocaleString() + ' tok</span><span class="u-cost">' + costLabel + '</span><span class="u-ctx ' + ctxClass + '">' + ctxLabel + '</span><a class="u-reset" onclick="window.PBLreset()">Reset</a>';
    }
    // Add progress bar
    var barDiv = document.createElement("div");
    barDiv.className = "pbl-ctx-fill";
    barDiv.style.cssText = "height:2px;background:#333;flex:1;min-width:40px;border-radius:1px";
    var inner = document.createElement("div");
    inner.className = "pbl-ctx-fill-inner";
    inner.style.cssText = "height:100%;border-radius:1px;background:" + (pct > 90 ? "#ef5350" : pct > 70 ? "#d4a017" : "#ff6b6b") + ";width:" + pct + "%";
    barDiv.appendChild(inner);
    usageBar.insertBefore(barDiv, usageBar.lastChild);
  }

  window.PBLreset = function() {
    chatHistory = [];
    accPrompt = 0; accCompletion = 0; accTotal = 0; accCost = 0;
    chat.innerHTML = "";
    addMsg("system", "Context cleared. Starting fresh session.");
    updateUsageBar();
  };

  // ---- toggle ----
  toggle.addEventListener("click", function(){
    isOpen = !isOpen;
    sidebar.classList.toggle("open", isOpen);
    toggle.classList.toggle("open", isOpen);
    toggle.textContent = isOpen ? "✕" : "☰";
    if (isOpen && chat.children.length === 0) {
      addMsg("system", "Welcome! Ask about this lesson. Select any text to ask about it.");
    }
  });

  // ---- text selection ----
  document.addEventListener("mouseup", function(e){
    var sel = window.getSelection();
    var txt = sel ? sel.toString().trim() : "";
    if (txt.length > 5 && txt.length < 500) {
      selBtn.style.display = "block";
      selBtn.style.left = Math.min(e.pageX, window.innerWidth - 150) + "px";
      selBtn.style.top = (e.pageY - 36) + "px";
      selBtn.dataset.text = txt;
    } else { selBtn.style.display = "none"; }
  });
  selBtn.addEventListener("click", function(){
    var txt = selBtn.dataset.text || "";
    selBtn.style.display = "none";
    if (!isOpen) toggle.click();
    input.value = "Explain this: " + txt.substring(0, 200);
    sendMsg();
  });

  // ---- send ----
  sendBtn.addEventListener("click", sendMsg);
  input.addEventListener("keydown", function(e){
    if (e.key === "Enter") { e.preventDefault(); sendMsg(); }
  });

  function sendMsg() {
    var text = input.value.trim();
    if (!text || isSending) return;
    input.value = "";
    addMsg("user", text);
    chatHistory.push({ role: "user", content: text });
    doChat();
  }

  function doChat() {
    isSending = true;
    sendBtn.disabled = true;
    var model = modelSelect.value || DEFAULT_MODEL;
    currentModel = model;

    // Look up context window for this model
    var m = allModels.find(function(x){return (x.id||x)===model});
    if (m && m.ctx) contextWindow = m.ctx;

    // Build messages with full history, truncated to last 50
    var allMsgs = [{ role: "system", content: "You are a friendly AI engineering tutor. For casual chat ('hey','hello','thanks') be brief and natural. When asked about AI/ML concepts, teach using the Socratic method: short analogies, one question at a time, guide without giving answers. Match the user's tone." }];
    var recent = chatHistory.slice(-50);
    allMsgs = allMsgs.concat(recent);

    var msgEl = addMsg("assistant", '<span class="pbl-spinner"></span>');

    var body = {
      model: model,
      stream: true,
      messages: allMsgs
    };

    doStreamingChat(body, msgEl);
  }

  function doStreamingChat(body, msgEl) {
    var collected = "";
    var thinking = "";
    msgEl.innerHTML = '<span class="pbl-spinner"></span>';

    fetch(SERVER + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function(resp){
      if (!resp.ok) {
        return resp.json().then(function(err){
          msgEl.innerHTML = "⚠ " + (err.error || resp.statusText);
          msgEl.className = "msg error";
          throw new Error(err.error || resp.statusText);
        });
      }
      return resp.text();
    }).then(function(text){
      var lines = text.split("\n");
      var finalUsage = null;
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            var parsed = JSON.parse(line.substring(6));
            if (parsed.usage && parsed.usage.total_tokens != null) {
              finalUsage = parsed.usage;
            }
            if (parsed.choices && parsed.choices[0]) {
              var delta = parsed.choices[0].delta || {};
              var reasoning = delta.reasoning_content || "";
              var content = delta.content || "";
              if (reasoning) {
                thinking += reasoning;
                msgEl.innerHTML = '<em style="color:#888;font-size:12px">Thinking...</em><br>' + markdown(collected || "(waiting...)");
              }
              if (content) {
                collected += content;
                msgEl.innerHTML = markdown(collected);
              }
            } else if (parsed.content && parsed.content[0]) {
              var txt = parsed.content[0].text || "";
              if (txt) { collected += txt; msgEl.innerHTML = markdown(collected); }
            } else if (parsed.error) {
              msgEl.innerHTML = "⚠ " + parsed.error;
              msgEl.className = "msg error";
            }
            msgEl.className = "msg assistant";
            chat.scrollTop = chat.scrollHeight;
          } catch(e) {}
        }
      }
      if (!collected && !thinking) {
        msgEl.innerHTML = "(no response)";
        msgEl.className = "msg error";
      } else {
        var finalText = collected || "(thinking only — answer may be empty)";
        chatHistory.push({ role: "assistant", content: finalText });
        msgEl.innerHTML = markdown(finalText);
        renderCode(msgEl);
      }
      if (finalUsage) {
        var p = finalUsage.prompt_tokens || 0;
        var c = finalUsage.completion_tokens || 0;
        accPrompt += p; accCompletion += c; accTotal += p + c;
        var m = allModels.find(function(x){return (x.id||x)===currentModel});
        if (m && m.price_in != null) {
          accCost += (p / 1e6) * m.price_in + (c / 1e6) * m.price_out;
        }
        updateUsageBar();
      }
      isSending = false;
      sendBtn.disabled = false;
    }).catch(function(err){
      msgEl.innerHTML = markdown("Error: " + err.message);
      msgEl.className = "msg error";
      isSending = false;
      sendBtn.disabled = false;
    });
  }

  // ---- end session ----
  endBtn.addEventListener("click", function(){ endPanel.classList.toggle("show"); });
  endCancel.addEventListener("click", function(){ endPanel.classList.remove("show"); notesArea.value = ""; });

  endConfirm.addEventListener("click", function(){
    endConfirm.textContent = "Saving...";
    endConfirm.disabled = true;
    var scores = [];
    document.querySelectorAll(".quiz .option.selected.correct").forEach(function(){ scores.push(1); });
    document.querySelectorAll(".quiz .option.selected.incorrect").forEach(function(){ scores.push(0); });

    var now = new Date();
    var sessionToken = Math.random().toString(36).substring(2, 8);

    fetch(SERVER + "/api/end-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lesson: lessonName,
        domain: lessonDomain,
        chat_history: chatHistory,
        quiz_scores: scores,
        notes: notesArea.value || ""
      })
    }).then(function(r){return r.json()}).then(function(data){
      addMsg("system", "✅ Session saved. Review scheduled.");
      endPanel.classList.remove("show");
      notesArea.value = "";
      endConfirm.textContent = "End Session → Save";
      endConfirm.disabled = false;
      checkReviews();
    }).catch(function(){
      endConfirm.textContent = "Error — try again";
      endConfirm.disabled = false;
    });
  });

  // ---- helpers ----
  function addMsg(role, html) {
    var div = document.createElement("div");
    div.className = "msg " + role;
    div.innerHTML = html;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  }

  function markdown(text) {
    if (!text) return "";
    text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    text = text.replace(/\n/g, "<br>");
    return text;
  }

  function renderCode(el) {
    if (window.Prism) {
      el.querySelectorAll("pre code").forEach(function(b){ Prism.highlightElement(b); });
    }
  }

  // ---- expose ----
  window.PBL = {
    send: sendMsg,
    toggle: function(){ toggle.click(); },
    msg: addMsg,
    history: function(){ return chatHistory.slice(); },
    reset: window.PBLreset
  };
  console.log("PBL v3 loaded at", SERVER);
})();
