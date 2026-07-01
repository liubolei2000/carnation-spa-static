#!/usr/bin/env python3
"""
SIM7600G SMS Web Gateway
- Stores all sent/received messages in SQLite
- Web UI (iMessage-style) at http://pi-ip:8080/
- Real-time updates via SSE
- POST /message API compatible with Android SMS Gateway (Basic Auth)
"""

import os, re, time, json, sqlite3, threading, queue, base64, serial
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote

# ── Config ─────────────────────────────────────────────────────────────────
PORT         = int(os.environ.get("PORT", "8080"))
GW_USER      = os.environ.get("SMS_GW_USER", "sms")
GW_PASS      = os.environ.get("SMS_GW_PASS", "carnation")
WEB_PASS     = os.environ.get("WEB_PASS", "")          # optional web UI password
SERIAL_PORT  = os.environ.get("SERIAL_PORT", "")       # auto-detect if empty
BAUD_RATE    = int(os.environ.get("BAUD_RATE", "115200"))
DB_PATH      = os.environ.get("DB_PATH", "/opt/sim7600-gateway/sms.db")

# ── Database ───────────────────────────────────────────────────────────────
def db_connect():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            phone      TEXT    NOT NULL,
            direction  TEXT    NOT NULL,  -- 'in' | 'out'
            body       TEXT    NOT NULL,
            status     TEXT    DEFAULT 'sent',
            created_at TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now'))
        )
    """)
    con.commit()
    return con

_db_lock = threading.Lock()
_db = db_connect()

def db_save(phone: str, direction: str, body: str, status: str = "sent") -> dict:
    with _db_lock:
        cur = _db.execute(
            "INSERT INTO messages (phone, direction, body, status) VALUES (?,?,?,?)",
            (phone, direction, body, status)
        )
        _db.commit()
        row = _db.execute("SELECT * FROM messages WHERE id=?", (cur.lastrowid,)).fetchone()
        return dict(row)

def db_conversations() -> list:
    with _db_lock:
        rows = _db.execute("""
            SELECT phone,
                   MAX(created_at) AS last_at,
                   (SELECT body FROM messages m2
                    WHERE m2.phone=m.phone ORDER BY created_at DESC LIMIT 1) AS last_body,
                   (SELECT direction FROM messages m2
                    WHERE m2.phone=m.phone ORDER BY created_at DESC LIMIT 1) AS last_dir
            FROM messages m
            GROUP BY phone
            ORDER BY last_at DESC
        """).fetchall()
        return [dict(r) for r in rows]

def db_thread(phone: str) -> list:
    with _db_lock:
        rows = _db.execute(
            "SELECT * FROM messages WHERE phone=? ORDER BY created_at ASC", (phone,)
        ).fetchall()
        return [dict(r) for r in rows]


# ── SSE broadcaster ────────────────────────────────────────────────────────
_sse_clients: list[queue.Queue] = []
_sse_lock = threading.Lock()

def sse_broadcast(event: dict):
    with _sse_lock:
        for q in list(_sse_clients):
            try:
                q.put_nowait(event)
            except queue.Full:
                pass


# ── Modem worker ───────────────────────────────────────────────────────────
class ModemWorker(threading.Thread):
    """Owns the serial port. Sends AT commands and listens for incoming SMS URCs."""

    def __init__(self):
        super().__init__(daemon=True, name="modem")
        self._cmd_q: queue.Queue = queue.Queue()
        self._ser: serial.Serial | None = None

    def _open_serial(self):
        port = SERIAL_PORT or self._find_port()
        self._ser = serial.Serial(port, BAUD_RATE, timeout=0.1)
        print(f"[modem] opened {port}")

    @staticmethod
    def _find_port() -> str:
        for p in ["/dev/ttyUSB2", "/dev/ttyUSB1", "/dev/ttyUSB3", "/dev/ttyUSB0"]:
            if os.path.exists(p):
                return p
        raise RuntimeError("No serial port found. Set SERIAL_PORT env var.")

    def at(self, cmd: str, timeout: float = 10.0) -> list[str]:
        """Send AT command from any thread; returns response lines."""
        ev = threading.Event()
        result: list[str] = []
        self._cmd_q.put((cmd, ev, result))
        ev.wait(timeout)
        return result

    def send_sms(self, phone: str, body: str):
        """Send SMS; raises on failure."""
        self.at("AT+CMGF=1")
        ev = threading.Event()
        result: list[str] = []
        self._cmd_q.put((f'AT+CMGS="{phone}"', ev, result, body))
        ev.wait(30)
        joined = " ".join(result)
        if "ERROR" in joined:
            raise RuntimeError(f"SMS send failed: {joined}")

    def run(self):
        while True:
            try:
                self._open_serial()
                self._init_modem()
                self._loop()
            except Exception as e:
                print(f"[modem] error: {e}  — reconnecting in 5s")
                try:
                    self._ser and self._ser.close()
                except Exception:
                    pass
                time.sleep(5)

    def _init_modem(self):
        for cmd in ["ATE0", "AT+CMGF=1", 'AT+CSCS="GSM"', "AT+CNMI=2,1,0,0,0"]:
            self._raw_at(cmd)
        print("[modem] initialized")

    def _loop(self):
        buf = ""
        active_cmd = active_ev = active_res = active_payload = None

        while True:
            # Pick up next command if idle
            if active_cmd is None:
                try:
                    item = self._cmd_q.get_nowait()
                    active_cmd, active_ev, active_res = item[0], item[1], item[2]
                    active_payload = item[3] if len(item) > 3 else None
                    self._ser.write((active_cmd + "\r\n").encode())
                    if active_payload is not None:
                        time.sleep(0.4)
                        chunk = self._ser.read(self._ser.in_waiting or 1).decode(errors="replace")
                        if ">" in chunk:
                            self._ser.write(active_payload.encode() + b"\x1a")
                except queue.Empty:
                    pass

            # Read available bytes
            n = self._ser.in_waiting
            if n:
                buf += self._ser.read(n).decode(errors="replace")
            else:
                time.sleep(0.05)

            # Process complete lines
            while "\n" in buf:
                line, buf = buf.split("\n", 1)
                line = line.strip()
                if not line or line == "ATE0":
                    continue

                if active_cmd is not None:
                    active_res.append(line)
                    # Command complete?
                    if (line in ("OK", "ERROR") or
                            line.startswith("+CMS ERROR") or
                            "+CMGS:" in line and active_payload is not None):
                        active_ev.set()
                        active_cmd = active_ev = active_res = active_payload = None
                else:
                    self._handle_urc(line)

    def _handle_urc(self, line: str):
        """Handle unsolicited result codes (incoming SMS, etc.)."""
        m = re.match(r'\+CMTI:\s*"[^"]*",(\d+)', line)
        if m:
            idx = m.group(1)
            lines = self._raw_at(f"AT+CMGR={idx}", wait=1.5)
            self._raw_at(f"AT+CMGD={idx}")
            self._parse_incoming(lines)

    def _parse_incoming(self, lines: list[str]):
        for i, line in enumerate(lines):
            # +CMGR: "REC UNREAD","+16173197748",,"24/06/30,10:30:00-20"
            m = re.match(r'\+CMGR:\s*"[^"]*","([^"]+)"', line)
            if m and i + 1 < len(lines):
                phone = _norm(m.group(1))
                body  = lines[i + 1]
                msg = db_save(phone, "in", body)
                print(f"[SMS IN] {phone}: {body}")
                sse_broadcast({"type": "new_message", "phone": phone, "msg": msg})
                return

    def _raw_at(self, cmd: str, wait: float = 0.6) -> list[str]:
        """Low-level AT command (only call from modem thread)."""
        self._ser.reset_input_buffer()
        self._ser.write((cmd + "\r\n").encode())
        time.sleep(wait)
        raw = self._ser.read(self._ser.in_waiting or 1).decode(errors="replace")
        return [l.strip() for l in raw.splitlines() if l.strip()]


# ── Helpers ────────────────────────────────────────────────────────────────
def _norm(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:    return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"): return f"+{digits}"
    if phone.startswith("+"):return f"+{digits}"
    return phone

def _check_api_auth(headers: dict) -> bool:
    auth = headers.get("Authorization", "")
    if not auth.startswith("Basic "): return False
    try:
        user, _, pwd = base64.b64decode(auth[6:]).decode().partition(":")
        return user == GW_USER and pwd == GW_PASS
    except Exception:
        return False

def _check_web_auth(headers: dict) -> bool:
    if not WEB_PASS: return True
    cookie = headers.get("Cookie", "")
    return f"auth={WEB_PASS}" in cookie


# ── HTTP handler ───────────────────────────────────────────────────────────
_modem: ModemWorker | None = None

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[http] {self.address_string()} {fmt % args}")

    def _json(self, status: int, body):
        data = json.dumps(body, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _html(self, status: int, body: str):
        data = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_body(self) -> bytes:
        n = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(n) if n else b""

    # ── GET ──────────────────────────────────────────────────────────────
    def do_GET(self):
        p = urlparse(self.path)
        path = p.path

        if path in ("/", "/ui"):
            if not _check_web_auth(self.headers):
                self._html(200, _LOGIN_PAGE)
                return
            self._html(200, _UI_PAGE)
            return

        if path == "/health":
            self._json(200, {"status": "ok"})
            return

        if path == "/api/conversations":
            self._json(200, db_conversations())
            return

        if path.startswith("/api/messages/"):
            phone = unquote(path[len("/api/messages/"):])
            self._json(200, db_thread(phone))
            return

        if path == "/api/events":
            self._sse()
            return

        self._json(404, {"error": "not found"})

    # ── POST ─────────────────────────────────────────────────────────────
    def do_POST(self):
        p = urlparse(self.path)
        path = p.path

        # Web login
        if path == "/login":
            body = self._read_body().decode()
            params = parse_qs(body)
            pwd = (params.get("password", [""])[0])
            if not WEB_PASS or pwd == WEB_PASS:
                self.send_response(302)
                self.send_header("Location", "/")
                self.send_header("Set-Cookie", f"auth={WEB_PASS or 'ok'}; Path=/; HttpOnly")
                self.end_headers()
            else:
                self._html(200, _LOGIN_PAGE.replace("</form>", "<p style='color:red'>密码错误</p></form>"))
            return

        # Send SMS via web UI (no Basic auth needed, local network)
        if path == "/api/send":
            try:
                data = json.loads(self._read_body())
                phone   = _norm(data["phone"])
                message = data["message"]
                if _modem:
                    _modem.send_sms(phone, message)
                msg = db_save(phone, "out", message, "sent")
                sse_broadcast({"type": "new_message", "phone": phone, "msg": msg})
                self._json(200, {"ok": True, "msg": msg})
            except Exception as e:
                self._json(500, {"error": str(e)})
            return

        # Android SMS Gateway-compatible endpoint (Basic auth)
        if path == "/message":
            if not _check_api_auth(self.headers):
                self.send_response(401)
                self.send_header("WWW-Authenticate", 'Basic realm="SMS Gateway"')
                self.end_headers()
                return
            try:
                data    = json.loads(self._read_body())
                message = data.get("message", "")
                phones  = data.get("phoneNumbers", [])
                results = []
                for phone in phones:
                    phone = _norm(phone)
                    try:
                        if _modem:
                            _modem.send_sms(phone, message)
                        msg = db_save(phone, "out", message, "sent")
                        sse_broadcast({"type": "new_message", "phone": phone, "msg": msg})
                        results.append({"phone": phone, "state": "Pending"})
                    except Exception as e:
                        db_save(phone, "out", message, "failed")
                        results.append({"phone": phone, "state": "Failed", "error": str(e)})
                self._json(200, {"data": results})
            except Exception as e:
                self._json(400, {"error": str(e)})
            return

        self._json(404, {"error": "not found"})

    # ── SSE ──────────────────────────────────────────────────────────────
    def _sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        q: queue.Queue = queue.Queue(maxsize=50)
        with _sse_lock:
            _sse_clients.append(q)
        try:
            while True:
                try:
                    event = q.get(timeout=25)
                    data = f"data: {json.dumps(event, default=str)}\n\n"
                    self.wfile.write(data.encode())
                    self.wfile.flush()
                except queue.Empty:
                    self.wfile.write(b": keepalive\n\n")
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            with _sse_lock:
                if q in _sse_clients:
                    _sse_clients.remove(q)


# ── Embedded HTML pages ────────────────────────────────────────────────────
_LOGIN_PAGE = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SMS Gateway</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#f0f0f5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
  .box{background:white;padding:32px;border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,.1);width:280px;text-align:center}
  h2{margin-bottom:20px;color:#1a1a2e}
  input{width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-size:.95rem;box-sizing:border-box;outline:none;margin-bottom:12px}
  button{width:100%;padding:11px;background:#0b93f6;color:white;border:none;border-radius:8px;font-size:.95rem;cursor:pointer}
  button:hover{background:#0080e0}
</style></head>
<body><div class="box"><h2>SMS Gateway</h2>
<form method="POST" action="/login">
<input type="password" name="password" placeholder="密码" autofocus>
<button>登录</button>
</form></div></body></html>"""

_UI_PAGE = """<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SMS</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f0f5;height:100dvh;display:flex;overflow:hidden}

/* ── Sidebar ── */
#sidebar{width:280px;flex-shrink:0;background:white;border-right:1px solid #e0e0e5;display:flex;flex-direction:column}
#sb-head{padding:14px 16px;font-size:1rem;font-weight:600;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between}
#new-btn{background:#0b93f6;color:white;border:none;border-radius:6px;padding:4px 10px;font-size:.8rem;cursor:pointer}
#convos{overflow-y:auto;flex:1}
.convo{padding:11px 14px;cursor:pointer;border-bottom:1px solid #f2f2f7;transition:background .1s}
.convo:hover{background:#f5f5ff}
.convo.active{background:#e8f0fe}
.convo-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px}
.convo-phone{font-size:.88rem;font-weight:600;color:#1a1a1a}
.convo-time{font-size:.7rem;color:#aaa}
.convo-preview{font-size:.78rem;color:#888;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.convo-preview.out::before{content:"You: ";color:#0b93f6}

/* ── Main ── */
#main{flex:1;display:flex;flex-direction:column;min-width:0}
#thread-head{padding:14px 20px;background:white;border-bottom:1px solid #e0e0e5;font-weight:600;font-size:.95rem;display:none}
#placeholder{flex:1;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:.9rem}
#messages{flex:1;overflow-y:auto;padding:14px 18px;display:none;flex-direction:column;gap:4px}

/* ── Bubbles ── */
.msg{display:flex;flex-direction:column;max-width:72%;margin-bottom:2px}
.msg.out{align-self:flex-end;align-items:flex-end}
.msg.in{align-self:flex-start;align-items:flex-start}
.bubble{padding:9px 13px;border-radius:18px;font-size:.9rem;line-height:1.45;word-break:break-word;white-space:pre-wrap}
.msg.out .bubble{background:#0b93f6;color:#fff;border-bottom-right-radius:4px}
.msg.in  .bubble{background:#e5e5ea;color:#000;border-bottom-left-radius:4px}
.msg-time{font-size:.65rem;color:#aaa;padding:2px 4px}

/* date divider */
.date-sep{text-align:center;font-size:.7rem;color:#bbb;margin:10px 0 4px}

/* ── Compose ── */
#compose{padding:10px 14px;background:white;border-top:1px solid #e0e0e5;display:none;gap:8px;align-items:flex-end}
#msg-input{flex:1;border:1px solid #ddd;border-radius:20px;padding:8px 14px;font-size:.9rem;resize:none;outline:none;font-family:inherit;max-height:120px;line-height:1.4}
#send-btn{background:#0b93f6;color:#fff;border:none;border-radius:50%;width:34px;height:34px;cursor:pointer;font-size:1.1rem;flex-shrink:0;transition:background .15s}
#send-btn:hover{background:#0080e0}
#send-btn:disabled{background:#ccc;cursor:default}

/* ── New convo modal ── */
#modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:100;align-items:center;justify-content:center}
#modal.open{display:flex}
#modal-box{background:white;border-radius:14px;padding:24px;width:300px}
#modal-box h3{margin-bottom:14px;font-size:.95rem}
#modal-phone{width:100%;border:1px solid #ddd;border-radius:8px;padding:9px 12px;font-size:.9rem;outline:none;margin-bottom:12px}
.modal-btns{display:flex;gap:8px;justify-content:flex-end}
.modal-btns button{padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-size:.85rem}
#modal-cancel{background:#f0f0f0}
#modal-ok{background:#0b93f6;color:#fff}

/* ── Status dot ── */
#status{width:8px;height:8px;border-radius:50%;background:#ccc;flex-shrink:0}
#status.ok{background:#4cd964}
#status.err{background:#ff3b30}
</style>
</head>
<body>

<div id="sidebar">
  <div id="sb-head">
    <div style="display:flex;align-items:center;gap:8px">
      <span id="status"></span>Messages
    </div>
    <button id="new-btn" onclick="openModal()">✏️ 新建</button>
  </div>
  <div id="convos"></div>
</div>

<div id="main">
  <div id="thread-head"></div>
  <div id="placeholder">选择联系人开始聊天</div>
  <div id="messages"></div>
  <div id="compose" style="display:none">
    <textarea id="msg-input" placeholder="短信…" rows="1"
      oninput="autoResize(this)" onkeydown="onKey(event)"></textarea>
    <button id="send-btn" onclick="sendMsg()">↑</button>
  </div>
</div>

<div id="modal">
  <div id="modal-box">
    <h3>新建对话</h3>
    <input id="modal-phone" type="tel" placeholder="+1 (617) 000-0000">
    <div class="modal-btns">
      <button id="modal-cancel" onclick="closeModal()">取消</button>
      <button id="modal-ok" onclick="startConvo()">开始</button>
    </div>
  </div>
</div>

<script>
let activePhone = null;

// ── Helpers ──────────────────────────────────────────────────────
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function fmtTime(iso){
  const d = new Date(iso+'Z'), now = new Date();
  if(d.toDateString()===now.toDateString())
    return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  const diff = (now-d)/(1000*86400);
  if(diff<7) return d.toLocaleDateString([],{weekday:'short'});
  return d.toLocaleDateString([],{month:'short',day:'numeric'});
}

function fmtFull(iso){
  return new Date(iso+'Z').toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}

function autoResize(el){
  el.style.height='';
  el.style.height=Math.min(el.scrollHeight,120)+'px';
}

function onKey(e){
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}
}

// ── Conversations ─────────────────────────────────────────────────
async function loadConvos(){
  const r = await fetch('/api/conversations');
  const list = await r.json();
  const el = document.getElementById('convos');
  el.innerHTML = list.map(c=>`
    <div class="convo${c.phone===activePhone?' active':''}" onclick="openConvo('${esc(c.phone)}')">
      <div class="convo-top">
        <span class="convo-phone">${esc(c.phone)}</span>
        <span class="convo-time">${fmtTime(c.last_at)}</span>
      </div>
      <div class="convo-preview${c.last_dir==='out'?' out':''}">${esc(c.last_body)}</div>
    </div>`).join('');
}

// ── Thread ────────────────────────────────────────────────────────
async function openConvo(phone){
  activePhone = phone;
  document.getElementById('thread-head').style.display='';
  document.getElementById('thread-head').textContent = phone;
  document.getElementById('placeholder').style.display='none';
  const msgs = document.getElementById('messages');
  const compose = document.getElementById('compose');
  msgs.style.display='flex';
  compose.style.display='flex';
  document.getElementById('msg-input').focus();

  const r = await fetch('/api/messages/'+encodeURIComponent(phone));
  renderThread(await r.json());
  loadConvos();
}

function renderThread(list){
  const el = document.getElementById('messages');
  let lastDate='', html='';
  list.forEach(m=>{
    const d = new Date(m.created_at+'Z');
    const ds = d.toDateString();
    if(ds!==lastDate){
      const label = ds===new Date().toDateString()?'今天':fmtFull(m.created_at);
      html+=`<div class="date-sep">${label}</div>`;
      lastDate=ds;
    }
    html+=`<div class="msg ${m.direction}">
      <div class="bubble">${esc(m.body)}</div>
      <div class="msg-time">${fmtTime(m.created_at)}</div>
    </div>`;
  });
  el.innerHTML=html;
  el.scrollTop=el.scrollHeight;
}

function appendMsg(m){
  const el = document.getElementById('messages');
  const div=document.createElement('div');
  div.className='msg '+m.direction;
  div.innerHTML=`<div class="bubble">${esc(m.body)}</div><div class="msg-time">${fmtTime(m.created_at)}</div>`;
  el.appendChild(div);
  el.scrollTop=el.scrollHeight;
}

// ── Send ──────────────────────────────────────────────────────────
async function sendMsg(){
  if(!activePhone) return;
  const inp = document.getElementById('msg-input');
  const text = inp.value.trim();
  if(!text) return;
  document.getElementById('send-btn').disabled=true;
  inp.value=''; inp.style.height='';
  const r = await fetch('/api/send',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({phone:activePhone, message:text})
  });
  document.getElementById('send-btn').disabled=false;
  if(r.ok){
    const {msg} = await r.json();
    appendMsg(msg);
    loadConvos();
  } else {
    alert('发送失败');
  }
}

// ── Modal ─────────────────────────────────────────────────────────
function openModal(){ document.getElementById('modal').classList.add('open'); document.getElementById('modal-phone').focus(); }
function closeModal(){ document.getElementById('modal').classList.remove('open'); }
function startConvo(){
  const p = document.getElementById('modal-phone').value.trim();
  if(!p) return;
  closeModal();
  openConvo(p);
}
document.getElementById('modal-phone').addEventListener('keydown',e=>{if(e.key==='Enter')startConvo();});
document.getElementById('modal').addEventListener('click',e=>{if(e.target===document.getElementById('modal'))closeModal();});

// ── SSE ───────────────────────────────────────────────────────────
const status = document.getElementById('status');
function connectSSE(){
  const es = new EventSource('/api/events');
  es.onopen = ()=>{ status.className='ok'; };
  es.onmessage = e=>{
    const data = JSON.parse(e.data);
    if(data.type==='new_message'){
      loadConvos();
      if(data.phone===activePhone && data.msg){
        appendMsg(data.msg);
      }
    }
  };
  es.onerror = ()=>{ status.className='err'; setTimeout(connectSSE,3000); };
}

loadConvos();
connectSSE();
</script>
</body></html>"""


# ── Entry point ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"[gateway] SIM7600G SMS Gateway starting on port {PORT}")
    print(f"[gateway] DB: {DB_PATH}")
    print(f"[gateway] API auth: {GW_USER}:{'*'*len(GW_PASS)}")
    if WEB_PASS:
        print(f"[gateway] Web UI password protected")

    _modem = ModemWorker()
    _modem.start()

    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[gateway] Web UI: http://localhost:{PORT}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[gateway] stopped")
