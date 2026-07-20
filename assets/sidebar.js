/* === PBL Sidebar Chat v2 === */
(function () {
  var SERVER = window.PBL_SERVER || "http://localhost:8001";
  var DEFAULT_MODEL = "deepseek-v4-flash";
  var ALL_MODELS = [];
  var lessonName = document.title || "lesson";
  var lessonDomain = (document.querySelector("meta[name='pbl-domain']") || {}).getAttribute
    ? (document.querySelector("meta[name='pbl-domain']").getAttribute("content") || "llm-fundamentals")
    : "llm-fundamentals";
  var chatHistory = [];
  var isOpen = false;
  var chatReady = false;

  // ---- styles ----
  var style = document.createElement("style");
  style.textContent = [
    "#pbl-sidebar{position:fixed;top:0;right:0;width:420px;height:100vh;background:#1a1a2e;border-left:1px solid #333;z-index:10000;display:flex;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;color:#e0e0e0;transform:translateX(420px);transition:transform .3s ease;box-shadow:-4px 0 20px rgba(0,0,0,.4)}",
    "#pbl-sidebar.open{transform:translateX(0)}",
    "#pbl-toggle{position:fixed;top:50%;right:0;z-index:10001;background:#ff6b6b;color:#fff;border:none;border-radius:6px 0 0 6px;padding:12px 8px;cursor:pointer;font-size:18px;transition:right .3s ease}",
    "#pbl-toggle.open{right:420px}",
    "#pbl-toggle:hover{background:#ff5252}",
    "#pbl-header{padding:12px 16px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;background:#16213e}",
    "#pbl-header h3{margin:0;font-size:14px;color:#ff6b6b}",
    "#pbl-model-select{background:#1e1e36;color:#e0e0e0;border:1px solid #333;border-radius:4px;padding:4px 8px;font-size:12px;cursor:pointer;max-width:200px}",
    "#pbl-chat{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px;min-height:0}",
    "#pbl-chat .msg{padding:8px 12px;border-radius:8px;font-size:13px;line-height:1.5;word-wrap:break-word;white-space:pre-wrap}",
    "#pbl-chat .msg.user{align-self:flex-end;background:#2a2a4e;max-width:85%}",
    "#pbl-chat .msg.assistant{align-self:flex-start;background:#1e2a3a;max-width:100%}",
    "#pbl-chat .msg.system{align-self:center;background:#2a2a1a;font-style:italic;font-size:12px;color:#aaa;max-width:90%;text-align:center}",
    "#pbl-chat .msg.error{align-self:center;background:#3a1a1a;color:#ff6b6b;max-width:90%;text-align:center;border:1px solid #5a2e2e}",
    "#pbl-chat .msg pre{background:#111;padding:8px;border-radius:4px;overflow-x:auto;margin:4px 0;font-size:12px}",
    "#pbl-chat .msg code{background:#111;padding:1px 4px;border-radius:3px;font-size:12px}",
    ".pbl-spinner{display:inline-block;width:14px;height:14px;border:2px solid #555;border-top-color:#ff6b6b;border-radius:50%;animation:pblspin .6s linear infinite;margin-right:6px;vertical-align:middle}",
    "@keyframes pblspin{to{transform:rotate(360deg)}}",
    "#pbl-input-area{padding:12px 16px;border-top:1px solid #333;display:flex;gap:8px;background:#16213e;flex-shrink:0}",
    "#pbl-input{flex:1;background:#1e1e36;color:#e0e0e0;border:1px solid #333;border-radius:4px;padding:8px 12px;font-size:13px;font-family:inherit}",
    "#pbl-input:focus{outline:none;border-color:#ff6b6b}",
    "#pbl-send{background:#ff6b6b;color:#fff;border:none;border-radius:4px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600}",
    "#pbl-send:hover{background:#ff5252}",
    "#pbl-send:disabled{opacity:.5;cursor:not-allowed}",
    "#pbl-end-session{background:#2a2a1a;color:#d4a017;border:1px solid #5a4e2e;border-radius:4px;padding:8px 16px;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap}",
    "#pbl-end-panel{display:none;padding:12px 16px;border-top:1px solid #333;background:#1e1e36;flex-direction:column;gap:8px;flex-shrink:0}",
    "#pbl-end-panel.show{display:flex}",
    "#pbl-end-panel textarea{background:#1a1a2e;color:#e0e0e0;border:1px solid #333;border-radius:4px;padding:8px;font-size:12px;resize:vertical;font-family:inherit;min-height:60px}",
    "#pbl-end-actions{display:flex;gap:8px;justify-content:flex-end}",
    "#pbl-end-actions button{padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;border:none}",
    "#pbl-end-confirm{background:#d4a017;color:#1a1a2e}",
    "#pbl-end-cancel{background:#333;color:#e0e0e0}",
    ".pbl-selection-btn{position:absolute;background:#ff6b6b;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer;z-index:10002;display:none}",
    "#pbl-reviews{padding:8px 16px;border-bottom:1px solid #333;background:#1e2a1a;font-size:12px;display:none;flex-shrink:0}",
    "#pbl-reviews.show{display:block}",
    "#pbl-reviews a{color:#66bb6a;cursor:pointer;text-decoration:underline}"
  ].join(" ");
  document.head.appendChild(style);

  // ---- build DOM ----
  var sidebar = document.createElement("div");
  sidebar.id = "pbl-sidebar";
  sidebar.innerHTML = [
    '<div id="pbl-header"><h3>PBL Tutor</h3><select id="pbl-model-select"></select></div>',
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
      '<input id="pbl-input" type="text" placeholder="Ask anything about this lesson..." autocomplete="off">',
      '<button id="pbl-end-session" title="End session">End</button>',
      '<button id="pbl-send">Send</button>',
    '</div>'
  ].join("");
  document.body.appendChild(sidebar);

  var toggle = document.createElement("button");
  toggle.id = "pbl-toggle";
  toggle.textContent = "☰";
  toggle.title = "Toggle PBL Tutor chat";
  document.body.appendChild(toggle);

  var selBtn = document.createElement("button");
  selBtn.className = "pbl-selection-btn";
  selBtn.textContent = "Ask about this text";
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
  var isSending = false;

  // ---- load models ----
  fetch(SERVER + "/api/models").then(function(r){return r.json()}).then(function(data){
    ALL_MODELS = data.models;
    modelSelect.innerHTML = "";
    data.models.forEach(function(m){
      var o = document.createElement("option");
      o.value = m; o.textContent = m;
      if (m === DEFAULT_MODEL) o.selected = true;
      modelSelect.appendChild(o);
    });
    chatReady = true;
    console.log("PBL: models loaded, chat ready");
  }).catch(function(){
    modelSelect.innerHTML = "<option>Server offline</option>";
    console.warn("PBL: server unreachable at", SERVER);
  });

  // ---- check reviews ----
  function checkReviews(){
    fetch(SERVER + "/api/reviews").then(function(r){return r.json()}).then(function(d){
      if (d.due && d.due.length > 0) {
        reviewsDiv.className = "show";
        reviewsDiv.innerHTML = "📚 <b>Reviews due:</b> " +
          d.due.map(function(r){return '<a onclick="window.PBLreview(\''+r.slug+'\')">'+r.title+'</a>'}).join(", ");
      }
    }).catch(function(){});
  }
  checkReviews();
  window.PBLreview = function(slug){ addMsg("system", "Let's review \""+slug+"\". Try to recall the key concept."); };

  // ---- toggle ----
  toggle.addEventListener("click", function(){
    isOpen = !isOpen;
    sidebar.classList.toggle("open", isOpen);
    toggle.classList.toggle("open", isOpen);
    toggle.textContent = isOpen ? "✕" : "☰";
    if (isOpen && chat.children.length === 0) {
      addMsg("system", "Welcome! Ask anything about this lesson, or select any text in the lesson to ask about it.");
    }
  });

  // ---- text selection ----
  document.addEventListener("mouseup", function(e){
    var sel = window.getSelection();
    var txt = sel ? sel.toString().trim() : "";
    if (txt.length > 5 && txt.length < 500) {
      selBtn.style.display = "block";
      selBtn.style.left = Math.min(e.pageX, window.innerWidth - 160) + "px";
      selBtn.style.top = (e.pageY - 36) + "px";
      selBtn.dataset.text = txt;
    } else {
      selBtn.style.display = "none";
    }
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

    // Show thinking indicator
    var msgEl = addMsg("assistant", '<span class="pbl-spinner"></span> thinking...');

    var body = {
      model: model,
      stream: true,
      messages: [
        { role: "system", content: "You are a Socratic tutor for AI engineering. The student is intermediate-level, studying \"" + lessonName + "\" (" + lessonDomain + "). Use short analogies. Ask one question at a time. Guide — don't give answers." },
        { role: "user", content: chatHistory.filter(function(m){return m.role==="user"}).slice(-1)[0].content }
      ]
    };

    // If streaming, use EventSource-like fetch. Otherwise fallback to regular POST.
    if (body.stream) {
      doStreamingChat(model, body, msgEl);
    } else {
      doSimpleChat(body, msgEl);
    }
  }

  function doStreamingChat(model, body, msgEl) {
    var collected = "";
    msgEl.innerHTML = '<span class="pbl-spinner"></span>';

    fetch(SERVER + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function(resp){
      if (!resp.ok) {
        return resp.json().then(function(err){
          msgEl.innerHTML = markdown("Error: " + (err.error || resp.statusText));
          msgEl.className = "msg error";
          throw new Error(err.error || resp.statusText);
        });
      }
      return resp.text();
    }).then(function(text){
      // Parse SSE stream
      var lines = text.split("\n");
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            var parsed = JSON.parse(line.substring(6));
            var content = "";
            if (parsed.choices && parsed.choices[0]) {
              content = parsed.choices[0].delta ? parsed.choices[0].delta.content : parsed.choices[0].message.content;
            } else if (parsed.content && parsed.content[0]) {
              content = parsed.content[0].text;
            } else if (parsed.error) {
              content = "Error: " + parsed.error;
            }
            if (content) {
              collected += content;
              msgEl.innerHTML = markdown(collected) || "<em>(empty response)</em>";
              chat.scrollTop = chat.scrollHeight;
            }
          } catch(e) {}
        }
      }
      if (!collected) {
        msgEl.innerHTML = "(The model returned an empty response. Try a different question or model.)";
        msgEl.className = "msg error";
      } else {
        chatHistory.push({ role: "assistant", content: collected });
        renderCode(msgEl);
      }
      isSending = false;
      sendBtn.disabled = false;
    }).catch(function(err){
      msgEl.innerHTML = markdown("Connection error. Make sure the server is running at " + SERVER + ".\n\nError: " + err.message);
      msgEl.className = "msg error";
      isSending = false;
      sendBtn.disabled = false;
    });
  }

  function doSimpleChat(body, msgEl) {
    fetch(SERVER + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function(r){return r.json()}).then(function(data){
      var reply = "";
      if (data.choices && data.choices[0] && data.choices[0].message) {
        reply = data.choices[0].message.content;
      } else if (data.content && data.content[0] && data.content[0].text) {
        reply = data.content[0].text;
      } else if (data.error) {
        reply = "⚠ " + data.error;
      } else {
        reply = JSON.stringify(data).substring(0, 300);
      }
      if (!reply || reply.trim() === "") reply = "(empty response)";
      msgEl.innerHTML = markdown(reply);
      chatHistory.push({ role: "assistant", content: reply });
      renderCode(msgEl);
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

    // Collect quiz scores if any quizzes were answered
    var scores = [];
    document.querySelectorAll(".quiz .option.selected.correct").forEach(function(){ scores.push(1); });
    document.querySelectorAll(".quiz .option.selected.incorrect").forEach(function(){ scores.push(0); });

    var body = JSON.stringify({
      lesson: lessonName,
      domain: lessonDomain,
      chat_history: chatHistory,
      quiz_scores: scores,
      notes: notesArea.value || ""
    });

    fetch(SERVER + "/api/end-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body
    }).then(function(r){return r.json()}).then(function(data){
      addMsg("system", "✅ Session saved successfully! Review has been scheduled.");
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
    history: function(){ return chatHistory; }
  };
  console.log("PBL sidebar loaded at", SERVER);
})();
