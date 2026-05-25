/**
 * Cloudflare Pages Functions - 管理员后台（安全加固版）
 * - Cookie 使用随机 token 而非明文密码
 * - 登录频率限制：3 次错误后逐级锁定时长
 * - 锁定期间页面内显示倒计时，不跳转
 */

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

  // ========== 登录页面 ==========
  if (url.pathname === "/__login") {
    return new Response(renderLoginPage("", 0), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // ========== 登录验证 ==========
  if (url.pathname === "/__auth") {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // 检查是否被锁定
    const lockKey = `lock:${clientIP}`;
    const lockData = await env.VISITOR_LOG.get(lockKey, "text");
    if (lockData) {
      const lock = JSON.parse(lockData);
      if (Date.now() < lock.until) {
        const remainSec = Math.ceil((lock.until - Date.now()) / 1000);
        return new Response(renderLoginPage("locked", remainSec), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
      // 锁定期已过，清除
      await env.VISITOR_LOG.delete(lockKey);
    }

    // 手动解析 POST body
    const text = await request.text();
    const params = new URLSearchParams(text);
    const pwd = params.get("password") || "";
    const remember = params.get("remember") || "";

    // 密码正确
    if (pwd === env.ADMIN_KEY) {
      await env.VISITOR_LOG.delete(`fail:${clientIP}`);
      await env.VISITOR_LOG.delete(lockKey);

      const token = generateToken();
      const expires = remember ? 7 * 24 * 60 * 60 : 24 * 60 * 60;

      await env.VISITOR_LOG.put(`token:${token}`, JSON.stringify({
        expires: Date.now() + expires * 1000,
        ip: clientIP,
      }), { expirationTtl: expires });

      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/__logs",
          "Set-Cookie": `admin_token=${token}; Max-Age=${expires}; Path=/; SameSite=Lax; HttpOnly; Secure`,
        }
      });
    }

    // 密码错误 → 记录失败次数
    const failKey = `fail:${clientIP}`;
    const failRaw = await env.VISITOR_LOG.get(failKey, "text");
    let fails = failRaw ? JSON.parse(failRaw) : { count: 0, firstFail: 0 };

    if (Date.now() - fails.firstFail > 3600000) {
      fails = { count: 0, firstFail: Date.now() };
    }
    if (fails.firstFail === 0) fails.firstFail = Date.now();

    fails.count += 1;

    // 渐进式锁定：第 1 次 10 分钟，第 2 次 30 分钟，第 3 次+ 24 小时
    const LOCK_DURATIONS = [10, 30, 1440]; // 分钟
    const idx = Math.min(fails.count - 1, LOCK_DURATIONS.length - 1);
    const lockMinutes = LOCK_DURATIONS[idx];
    const lockUntil = Date.now() + lockMinutes * 60000;

    await env.VISITOR_LOG.put(failKey, JSON.stringify(fails), { expirationTtl: 86400 });
    await env.VISITOR_LOG.put(lockKey, JSON.stringify({ until: lockUntil, count: fails.count }), { expirationTtl: 86400 });

    return new Response(renderLoginPage("wrong", lockMinutes * 60), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // ========== 退出登录 ==========
  if (url.pathname === "/__logout") {
    const token = getCookie(request, "admin_token");
    if (token) await env.VISITOR_LOG.delete(`token:${token}`);
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/__login",
        "Set-Cookie": "admin_token=; Max-Age=0; Path=/",
      }
    });
  }

  // ========== 日志页面（需登录） ==========
  if (url.pathname === "/__logs") {
    const check = await checkAuth(request, env);
    if (!check.ok) return redirectToLogin();
    const raw = await env.VISITOR_LOG.get("log_entries", "text");
    const entries = raw ? JSON.parse(raw) : [];
    return new Response(renderLogPage(entries), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // ========== 清除日志（需登录） ==========
  if (url.pathname === "/__clear") {
    const check = await checkAuth(request, env);
    if (!check.ok) return redirectToLogin();
    await env.VISITOR_LOG.put("log_entries", JSON.stringify([]));
    return Response.redirect("/__logs", 302);
  }

  // ========== 记录访问 ==========
  const path = url.pathname;
  if (path.startsWith("/__")) return next();

  const rawUA = request.headers.get("User-Agent") || "";
  const visitor = {
    time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
    ip: clientIP,
    country: request.cf?.country || "unknown",
    city: request.cf?.city || "unknown",
    colo: request.cf?.colo || "unknown",
    asn: request.cf?.asn || 0,
    path: path + url.search,
    method: request.method,
    ua: parseUA(rawUA),
    referer: (request.headers.get("Referer") || "").slice(0, 200),
  };
  context.waitUntil(saveLog(env.VISITOR_LOG, visitor));

  return next();
}

// ========== 鉴权检查 ==========
async function checkAuth(request, env) {
  const token = getCookie(request, "admin_token");
  if (!token) return { ok: false };
  const raw = await env.VISITOR_LOG.get(`token:${token}`, "text");
  if (!raw) return { ok: false };
  const data = JSON.parse(raw);
  if (Date.now() > data.expires) {
    await env.VISITOR_LOG.delete(`token:${token}`);
    return { ok: false };
  }
  return { ok: true };
}

function redirectToLogin() {
  return Response.redirect("/__login", 302);
}

function generateToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 32; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

function parseUA(ua) {
  if (!ua) return "未知";
  const parts = [];
  if (ua.includes("Windows NT 10.0")) parts.push("Windows 10");
  else if (ua.includes("Windows")) parts.push("Windows");
  else if (ua.includes("Mac OS X")) parts.push("macOS");
  else if (ua.includes("Linux")) parts.push("Linux");
  else if (ua.includes("Android")) parts.push("Android");
  else if (ua.includes("iPhone") || ua.includes("iPad")) parts.push("iOS");
  if (ua.includes("Edg/")) parts.push("Edge");
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) parts.push("Chrome");
  else if (ua.includes("Firefox/")) parts.push("Firefox");
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) parts.push("Safari");
  else parts.push("其他");
  return parts.join(" / ");
}

async function saveLog(kv, entry) {
  const MAX_ENTRIES = 500;
  const raw = await kv.get("log_entries", "text");
  let entries = raw ? JSON.parse(raw) : [];
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(0, MAX_ENTRIES);
  await kv.put("log_entries", JSON.stringify(entries));
}

// ========== 登录页面（支持倒计时） ==========
function renderLoginPage(errorType, lockSeconds) {
  // 计算初始显示值
  const totalSec = Number(lockSeconds) || 0;
  const initMin = Math.floor(totalSec / 60);
  const initSec = totalSec % 60;
  const initDisplay = totalSec > 0
    ? `${initMin} 分 ${initSec} 秒`
    : "";

  // 错误消息
  let msg = "";
  let showTimer = false;
  if (errorType === "wrong") {
    msg = "密码错误！请等待冷却时间结束后再试。";
    showTimer = true;
  } else if (errorType === "locked") {
    msg = "账号已被锁定，请等待冷却时间结束后再试。";
    showTimer = true;
  }

  const msgHtml = msg
    ? `<div class="error-msg">
         <span>${msg}</span>
         ${showTimer && totalSec > 0 ? `<span class="countdown" id="countdown">${initDisplay}</span>` : ""}
       </div>`
    : "";

  // 是否禁用表单
  const disabled = showTimer && totalSec > 0 ? "disabled" : "";

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>管理员登录 - LBW教程网</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #0d1117; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .login-box { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 40px; width: 390px; }
  .login-box h2 { color: #c9d1d9; text-align: center; margin-bottom: 8px; font-size: 22px; }
  .login-box .sub { color: #8b949e; text-align: center; margin-bottom: 28px; font-size: 13px; }

  .error-msg { background: #3d1d1d; border: 1px solid #f85149; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; gap: 10px; color: #f85149; font-size: 13px; }
  .countdown { font-family: "SF Mono", "Consolas", monospace; font-size: 22px; font-weight: 700; color: #ffa198; white-space: nowrap; min-width: 90px; text-align: right; }

  .input-group { margin-bottom: 18px; }
  .input-group label { display: block; color: #c9d1d9; margin-bottom: 6px; font-size: 14px; }
  .input-group input { width: 100%; padding: 10px 14px; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; color: #c9d1d9; font-size: 14px; outline: none; transition: border-color .2s; }
  .input-group input:focus { border-color: #58a6ff; }
  .input-group input:disabled { opacity: 0.4; cursor: not-allowed; }

  .bottom-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; font-size: 13px; }
  .bottom-row label { color: #8b949e; cursor: pointer; display: flex; align-items: center; gap: 6px; }
  .bottom-row input[type=checkbox] { accent-color: #58a6ff; }

  .login-btn { width: 100%; padding: 12px; background: #238636; border: none; border-radius: 8px; color: #fff; font-size: 15px; cursor: pointer; font-weight: 600; transition: background .2s; }
  .login-btn:hover { background: #2ea043; }
  .login-btn:disabled { background: #30363d; color: #8b949e; cursor: not-allowed; }
</style>
</head>
<body>
  <div class="login-box">
    <h2>管理员登录</h2>
    <p class="sub">LBW教程网 · 访问后台</p>
    ${msgHtml}
    <form method="POST" action="/__auth">
      <div class="input-group">
        <label>管理密码</label>
        <input type="password" name="password" placeholder="请输入管理密码" ${disabled} required>
      </div>
      <div class="bottom-row">
        <label><input type="checkbox" name="remember" value="1" ${disabled}> 记住我（7天）</label>
      </div>
      <button type="submit" class="login-btn" ${disabled}>登 录</button>
    </form>
  </div>
  ${showTimer && totalSec > 0 ? `
  <script>
    (function(){
      var el = document.getElementById("countdown");
      if (!el) return;
      var remaining = ${totalSec};
      function tick(){
        if (remaining <= 0) {
          el.textContent = "已解除";
          el.style.color = "#3fb950";
          // 1.5 秒后刷新页面恢复表单
          setTimeout(function(){ location.href = "/__login"; }, 1500);
          return;
        }
        var m = Math.floor(remaining / 60);
        var s = remaining % 60;
        el.textContent = m + " 分 " + s + " 秒";
        remaining--;
        setTimeout(tick, 1000);
      }
      tick();
    })();
  </script>` : ""}
</body>
</html>`;
}

// ========== 日志页面 ==========
function renderLogPage(entries) {
  const rows = entries
    .map(
      (e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${e.time}</td>
      <td><code>${e.ip}</code></td>
      <td>${e.country} / ${e.city}</td>
      <td>${e.asn}</td>
      <td>${e.path}</td>
      <td>${e.method}</td>
      <td>${escapeHtml(e.ua)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>访问日志 - LBW教程网</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; background: #0d1117; color: #c9d1d9; }
  .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
  .topbar h2 { color: #58a6ff; margin: 0; font-size: 20px; }
  .topbar .actions { display: flex; gap: 10px; }
  .btn { padding: 8px 16px; border: 1px solid #30363d; border-radius: 6px; background: #21262d; color: #c9d1d9; cursor: pointer; font-size: 13px; text-decoration: none; transition: background .2s; }
  .btn:hover { background: #30363d; }
  .btn-danger { background: #da3633; border-color: #da3633; color: #fff; }
  .btn-danger:hover { background: #f85149; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #21262d; white-space: nowrap; }
  th { background: #161b22; color: #8b949e; position: sticky; top: 0; }
  tr:hover { background: #1c2129; }
  code { color: #d2a8ff; }
  .container { max-width: 100%; overflow-x: auto; }
  .empty { text-align: center; color: #8b949e; padding: 40px; }
</style>
</head>
<body>
  <div class="topbar">
    <h2>访问日志（最近 ${entries.length} 条）</h2>
    <div class="actions">
      <a href="/__clear" class="btn btn-danger" onclick="return confirm('确定清空所有日志？')">清空日志</a>
      <a href="/__logout" class="btn">退出登录</a>
    </div>
  </div>
  ${entries.length === 0
    ? '<div class="empty">暂无访问记录</div>'
    : `<div class="container">
    <table>
      <thead>
        <tr>
          <th>#</th><th>时间</th><th>IP</th><th>位置</th><th>ASN</th><th>路径</th><th>请求方式</th><th>客户端</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`}
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
