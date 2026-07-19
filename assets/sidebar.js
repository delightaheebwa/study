/* === PBL Sidebar Chat === */
/* Collapsible chat panel with model selector, End Session, text selection */
(function () {
  var SERVER = window.PBL_SERVER || "http://localhost:8001";
  var DEFAULT_MODEL = "deepseek-v4-flash";
  var ALL_MODELS = [];
  var lessonName = document.title || "lesson";
  var lessonDomain = document.querySelector("meta[name='pbl-domain']")?.getAttribute("content") || "llm-fundamentals";
  var chatHistory = [];
  var isOpen = false;
  var chatInitialized = false;

  // ---- styles ----
  var style = document.createElement("style");
  style.textContent = `
    #pbl-sidebar { position:fixed; top:0; right:0; width:420px; height:100vh;
      background:#1a1a2e; border-left:1px solid #333; z-index:10000;
      display:flex; flex-direction:column; font-family:system-ui,-apple-system,sans-serif;
      color:#e0e0e0; transform:translateX(420px); transition:transform .3s ease;
      box-shadow:-4px 0 20px rgba(0,0,0,.4); }
    #pbl-sidebar.open { transform:translateX(0); }
    #pbl-toggle { position:fixed; top:50%; right:0; z-index:10001;
      background:#ff6b6b; color:#fff; border:none; border-radius:6px 0 0 6px;
      padding:12px 8px; cursor:pointer; font-size:18px; transition:right .3s ease; }
    #pbl-toggle.open { right:420px; }
    #pbl-toggle:hover { background:#ff5252; }
    #pbl-header { padding:12px 16px; border-bottom:1px solid #333;
      display:flex; justify-content:space-between; align-items:center;
      background:#16213e; }
    #pbl-header h3 { margin:0; font-size:14px; color:#ff6b6b; }
    #pbl-model-select { background:#1e1e36; color:#e0e0e0; border:1px solid #333;
      border-radius:4px; padding:4px 8px; font-size:12px; cursor:pointer; }
    #pbl-chat { flex:1; overflow-y:auto; padding:12px 16px; display:flex;
      flex-direction:column; gap:10px; }
    #pbl-chat .msg { max-width:90%; padding:8px 12px; border-radius:8px;
      font-size:13px; line-height:1.5; word-wrap:break-word; }
    #pbl-chat .msg.user { align-self:flex-end; background:#2a2a4e; }
    #pbl-chat .msg.assistant { align-self:flex-start; background:#1e2a3a; }
    #pbl-chat .msg.system { align-self:center; background:#2a2a1a; font-style:italic; font-size:12px; color:#aaa; }
    #pbl-chat .msg.error { align-self:center; background:#3a1a1a; color:#ef5350; }
    #pbl-chat .msg code { background:#111; padding:1px 4px; border-radius:3px; font-size:12px; }
    #pbl-chat .msg pre { background:#111; padding:8px; border-radius:4px; overflow-x:auto; margin:4px 0; font-size:12px; }
    #pbl-chat .msg .spinner { display:inline-block; width:14px; height:14px;
      border:2px solid #555; border-top-color:#ff6b6b; border-radius:50%;
      animation:pblspin .6s linear infinite; }
    @keyframes pblspin { to { transform:rotate(360deg); } }
    #pbl-input-area { padding:12px 16px; border-top:1px solid #333;
      display:flex; gap:8px; background:#16213e; }
    #pbl-input { flex:1; background:#1e1e36; color:#e0e0e0; border:1px solid #333;
      border-radius:4px; padding:8px 12px; font-size:13px; resize:none;
      font-family:inherit; }
    #pbl-input:focus { outline:none; border-color:#ff6b6b; }
    #pbl-send { background:#ff6b6b; color:#fff; border:none; border-radius:4px;
      padding:8px 16px; cursor:pointer; font-size:13px; font-weight:600; }
    #pbl-send:hover { background:#ff5252; }
    #pbl-end-session { background:#2a2a1a; color:#d4a017; border:1px solid #5a4e2e;
      border-radius:4px; padding:8px 16px; cursor:pointer; font-size:12px;
      font-weight:600; white-space:nowrap; }
    #pbl-end-session:hover { background:#3a3a1a; }
    #pbl-end-panel { display:none; padding:12px 16px; border-top:1px solid #333;
      background:#1e1e36; flex-direction:column; gap:8px; }
    #pbl-end-panel.show { display:flex; }
    #pbl-end-panel textarea { background:#1a1a2e; color:#e0e0e0; border:1px solid #333;
      border-radius:4px; padding:8px; font-size:12px; resize:vertical;
      font-family:inherit; min-height:60px; }
    #pbl-end-actions { display:flex; gap:8px; justify-content:flex-end; }
    #pbl-end-actions button { padding:6px 16px; border-radius:4px; cursor:pointer;
      font-size:12px; font-weight:600; border:none; }
    #pbl-end-confirm { background:#d4a017; color:#1a1a2e; }
    #pbl-end-cancel { background:#333; color:#e0e0e0; }
    .pbl-selection-btn { position:absolute; background:#ff6b6b; color:#fff;
      border:none; border-radius:4px; padding:4px 10px; font-size:12px;
      cursor:pointer; z-index:10002; display:none; }
    .pbl-selection-btn:hover { background:#ff5252; }
    #pbl-reviews { padding:8px 16px; border-bottom:1px solid #333;
      background:#1e2a1a; font-size:12px; display:none; }
    #pbl-reviews.show { display:block; }
    #pbl-reviews a { color:#66bb6a; cursor:pointer; text-decoration:underline; }
  `;
  document.head.appendChild(style);

  // ---- DOM ----
  var sidebar = document.createElement("div");
  sidebar.id = "pbl-sidebar";

  sidebar.innerHTML = `
    <div id="pbl-header">
      <h3>PBL Tutor</h3>
      <select id="pbl-model-select"></select>
    </div>
    <div id="pbl-reviews"></div>
    <div id="pbl-chat"></div>
    <div id="pbl-end-panel">
      <textarea id="pbl-notes" placeholder="Optional session notes..."></textarea>
      <div id="pbl-end-actions">
        <button id="pbl-end-cancel">Cancel</button>
        <button id="pbl-end-confirm">End Session → Save &amp; Push</button>
      </div>
    </div>
    <div id="pbl-input-area">
      <input id="pbl-input" type="text" placeholder="Ask a question..." autocomplete="off">
      <button id="pbl-end-session" title="End session and save to wiki">End</button>
      <button id="pbl-send">Send</button>
    </div>
  `;
  document.body.appendChild(sidebar);

  var toggle = document.createElement("button");
  toggle.id = "pbl-toggle";
  toggle.textContent = "☰";
  document.body.appendChild(toggle);

  var selectionBtn = document.createElement("button");
  selectionBtn.className = "pbl-selection-btn";
  selectionBtn.textContent = "Ask about this";
  document.body.appendChild(selectionBtn);

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

  // ---- load models ----
  fetch(SERVER + "/api/models")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      ALL_MODELS = data.models;
      modelSelect.innerHTML = "";
      data.models.forEach(function (m) {
        var opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        if (m === DEFAULT_MODEL) opt.selected = true;
        modelSelect.appendChild(opt);
      });
    })
    .catch(function () {
      modelSelect.innerHTML = "<option>server offline</option>";
    });

  // ---- check reviews ----
  function checkReviews() {
    fetch(SERVER + "/api/reviews")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.due && data.due.length > 0) {
          reviewsDiv.className = "show";
          reviewsDiv.innerHTML = "📚 <strong>Reviews due:</strong> " +
            data.due.map(function (d) {
              return '<a onclick="window.PBLreviewLesson(\'' + d.slug + '\')">' + d.title + "</a>";
            }).join(", ");
        }
      })
      .catch(function () {});
  }
  checkReviews();
  window.PBLreviewLesson = function (slug) {
    addMsg("system", "Let's review \"" + slug + "\". Try to recall the key concept.");
  };

  // ---- toggle ----
  toggle.addEventListener("click", function () {
    isOpen = !isOpen;
    sidebar.classList.toggle("open", isOpen);
    toggle.classList.toggle("open", isOpen);
    toggle.textContent = isOpen ? "✕" : "☰";
    if (isOpen && !chatInitialized) {
      chatInitialized = true;
      addMsg("system", "Welcome! Ask anything about this lesson. You can also select any text to ask about it.");
    }
  });

  // ---- text selection ----
  document.addEventListener("mouseup", function (e) {
    var sel = window.getSelection();
    var text = sel ? sel.toString().trim() : "";
    if (text && text.length > 5 && text.length < 500) {
      selectionBtn.style.display = "block";
      selectionBtn.style.left = (e.pageX) + "px";
      selectionBtn.style.top = (e.pageY - 30) + "px";
      selectionBtn.dataset.text = text;
    } else {
      selectionBtn.style.display = "none";
    }
  });
  selectionBtn.addEventListener("click", function () {
    var text = selectionBtn.dataset.text || "";
    selectionBtn.style.display = "none";
    if (!isOpen) { toggle.click(); }
    input.value = "Explain this: " + text;
    sendMsg();
  });

  // ---- send ----
  sendBtn.addEventListener("click", sendMsg);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });

  function sendMsg() {
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    addMsg("user", text);
    chatHistory.push({ role: "user", content: text });
    doChat();
  }

  function doChat() {
    var model = modelSelect.value;
    var spinner = addMsg("assistant", '<div class="spinner"></div>');

    var body = {
      model: model,
      messages: [
        { role: "system", content: "You are an expert Socratic tutor for AI engineering. The student is intermediate-level, currently studying \"" + lessonName + "\" in the domain of " + lessonDomain + ". Use vivid analogies. Ask one question at a time. Never give the answer directly — guide the student to discover it." },
        { role: "user", content: chatHistory.filter(function (m) { return m.role === "user"; }).slice(-1)[0]?.content || "" }
      ]
    };

    fetch(SERVER + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var reply = "";
      if (data.choices && data.choices[0] && data.choices[0].message) {
        reply = data.choices[0].message.content;
      } else if (data.content && data.content[0] && data.content[0].text) {
        reply = data.content[0].text;
      } else if (data.error) {
        reply = "Error: " + data.error;
      } else {
        reply = JSON.stringify(data).slice(0, 300);
      }
      spinner.innerHTML = renderMarkdown(reply);
      chatHistory.push({ role: "assistant", content: reply });
      renderMathIn(spinner);
      renderCodeIn(spinner);
    })
    .catch(function (err) {
      spinner.innerHTML = "Connection error. Is the server running at " + SERVER + "?";
      spinner.className = "msg error";
    });
  }

  // ---- end session ----
  endBtn.addEventListener("click", function () {
    endPanel.classList.toggle("show");
  });

  endCancel.addEventListener("click", function () {
    endPanel.classList.remove("show");
    notesArea.value = "";
  });

  endConfirm.addEventListener("click", function () {
    endConfirm.textContent = "Saving...";
    endConfirm.disabled = true;

    var quizNodes = document.querySelectorAll(".quiz");
    var scores = [];
    quizNodes.forEach(function (q) {
      var correct = q.querySelector(".option.correct");
      if (correct) scores.push(1);
      else { var anySelected = q.querySelector(".option.selected"); if (anySelected) scores.push(0); }
    });

    var body = {
      lesson: lessonName,
      domain: lessonDomain,
      chat_history: chatHistory,
      quiz_scores: scores,
      notes: notesArea.value
    };

    fetch(SERVER + "/api/end-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      endConfirm.textContent = "✓ Saved!";
      endConfirm.style.background = "#66bb6a";
      addMsg("system", "Session saved. 📝 Review scheduled. " +
        (data.interleaving ? "Interleaving practice suggested." : "") +
        " <a href='" + SERVER + "/api/reviews' target='_blank'>Check reviews</a>");
      endPanel.classList.remove("show");
      notesArea.value = "";
      setTimeout(function () {
        endConfirm.textContent = "End Session → Save & Push";
        endConfirm.disabled = false;
        endConfirm.style.background = "";
      }, 2000);
    })
    .catch(function () {
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

  function renderMarkdown(text) {
    text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    text = text.replace(/\n/g, "<br>");
    return text;
  }

  function renderMathIn(el) {
    if (window.MathJax && window.MathJax.Hub) {
      MathJax.Hub.Queue(["Typeset", MathJax.Hub, el]);
    }
  }

  function renderCodeIn(el) {
    if (window.Prism) {
      el.querySelectorAll("pre code").forEach(function (block) {
        Prism.highlightElement(block);
      });
    }
  }

  // ---- expose ----
  window.PBL = {
    sendMsg: sendMsg,
    toggle: function () { toggle.click(); },
    addMsg: addMsg,
    getChatHistory: function () { return chatHistory; }
  };

  console.log("PBL sidebar loaded. Toggle with the ☰ button on the right edge.");
})();
