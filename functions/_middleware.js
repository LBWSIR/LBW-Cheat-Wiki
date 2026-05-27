/**
 * Cloudflare Pages Functions - 管理员后台 + Turnstile 全站验证
 * - 使用 D1 替代 KV，免费额度 10 万次写入/天
 * - Cookie 使用随机 token 而非明文密码
 * - 登录频率限制：3 次错误后逐级锁定时长
 * - Turnstile：非管理员访问需通过人机验证
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

    const lock = await env.DB.prepare(
      "SELECT * FROM rate_limits WHERE ip = ?"
    ).bind(clientIP).first();

    if (lock && lock.locked_until > 0 && Date.now() < lock.locked_until) {
      const remainSec = Math.ceil((lock.locked_until - Date.now()) / 1000);
      return new Response(renderLoginPage("locked", remainSec), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (lock && lock.locked_until > 0) {
      await env.DB.prepare("DELETE FROM rate_limits WHERE ip = ?").bind(clientIP).run();
    }

    const text = await request.text();
    const params = new URLSearchParams(text);
    const pwd = params.get("password") || "";
    const remember = params.get("remember") || "";

    if (pwd === env.ADMIN_KEY) {
      await env.DB.prepare("DELETE FROM rate_limits WHERE ip = ?").bind(clientIP).run();
      const token = generateToken();
      const expires = remember ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
      await env.DB.prepare(
        "INSERT OR REPLACE INTO admin_tokens (token, ip, expires) VALUES (?, ?, ?)"
      ).bind(token, clientIP, Date.now() + expires * 1000).run();

      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/__logs",
          "Set-Cookie": `admin_token=${token}; Max-Age=${expires}; Path=/; SameSite=Lax; HttpOnly; Secure`,
        }
      });
    }

    let fails = lock || { ip: clientIP, fail_count: 0, first_fail_at: 0 };
    if (Date.now() - fails.first_fail_at > 3600000) {
      fails.fail_count = 0;
      fails.first_fail_at = Date.now();
    }
    if (fails.first_fail_at === 0) fails.first_fail_at = Date.now();
    fails.fail_count += 1;

    const LOCK_DURATIONS = [10, 30, 1440];
    const idx = Math.min(fails.fail_count - 1, LOCK_DURATIONS.length - 1);
    const lockMinutes = LOCK_DURATIONS[idx];
    const lockUntil = Date.now() + lockMinutes * 60000;

    await env.DB.prepare(
      "INSERT OR REPLACE INTO rate_limits (ip, fail_count, first_fail_at, locked_until) VALUES (?, ?, ?, ?)"
    ).bind(clientIP, fails.fail_count, fails.first_fail_at, lockUntil).run();

    return new Response(renderLoginPage("wrong", lockMinutes * 60), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // ========== 退出登录 ==========
  if (url.pathname === "/__logout") {
    const token = getCookie(request, "admin_token");
    if (token) {
      await env.DB.prepare("DELETE FROM admin_tokens WHERE token = ?").bind(token).run();
    }
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/__login",
        "Set-Cookie": "admin_token=; Max-Age=0; Path=/",
      }
    });
  }

  // ========== 日志页面 ==========
  if (url.pathname === "/__logs") {
    const check = await checkAuth(request, env);
    if (!check.ok) return redirectToLogin();
    const { results } = await env.DB.prepare(
      "SELECT * FROM visitors ORDER BY id DESC LIMIT 500"
    ).all();
    return new Response(renderLogPage(results), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // ========== 清除日志 ==========
  if (url.pathname === "/__clear") {
    const check = await checkAuth(request, env);
    if (!check.ok) return redirectToLogin();
    await env.DB.prepare("DELETE FROM visitors").run();
    return Response.redirect("/__logs", 302);
  }

  // ========== Turnstile 验证回调 ==========
  if (url.pathname === "/__turnstile-verify") {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    return handleTurnstileVerify(request, env);
  }

  // ========== Turnstile 人机验证（非管理员） ==========
  if (url.pathname.startsWith("/__")) return next();

  // 静态资源放行（CSS/JS/图片等不需要验证，且 Accept 不是 text/html）
  if (url.pathname.startsWith("/assets/") || /\.(js|css|png|jpg|webp|svg|ico|woff2?)$/i.test(url.pathname)) {
    return next();
  }

  // ========== 记录访问日志 ==========
  const rawUA = request.headers.get("User-Agent") || "";
  const cf = request.cf || {};
  const visitor = {
    time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
    ip: clientIP,
    country: cf.country || "unknown",
    city: cf.city || "unknown",
    colo: cf.colo || "unknown",
    asn: cf.asn || 0,
    path: url.pathname + url.search,
    method: request.method,
    ua: parseUA(rawUA),
    referer: (request.headers.get("Referer") || "").slice(0, 200),
  };
  context.waitUntil(saveLog(env.DB, visitor));

  // ========== 防爬虫：浏览器白名单拦截 ==========
  const ua = (request.headers.get("User-Agent") || "").toLowerCase();
  const accept = request.headers.get("Accept") || "";
  const isBrowser = /mozilla/i.test(ua) && accept.includes("text/html");
  if (!isBrowser) {
    return new Response("Forbidden", { status: 403 });
  }

  // 管理员无需验证
  const auth = await checkAuth(request, env);
  if (auth.ok) return next();

  // 已通过 Turnstile 验证
  const turnstileToken = getCookie(request, "turnstile");
  if (turnstileToken) {
    const isValid = await verifyTurnstileCookie(env.TURNSTILE_SECRET, turnstileToken);
    if (isValid) return next();
  }

  // 显示 Turnstile 验证页
  return serveTurnstilePage(env.TURNSTILE_SITE_KEY, url.pathname + url.search);
}

// ========== Turnstile 验证处理 ==========
async function handleTurnstileVerify(request, env) {
  const text = await request.text();
  const params = new URLSearchParams(text);
  const token = params.get("cf-turnstile-response") || "";
  const redirectUrl = params.get("redirect") || "/";

  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token }),
  });
  const outcome = await result.json();

  if (outcome.success) {
    const cookieValue = await signTurnstileCookie(env.TURNSTILE_SECRET);
    return new Response(null, {
      status: 302,
      headers: {
        "Location": redirectUrl,
        "Set-Cookie": `turnstile=${cookieValue}; Path=/; Max-Age=86400; SameSite=Lax; HttpOnly; Secure`,
      },
    });
  }

  return new Response("验证失败，请刷新重试", { status: 403 });
}

// ========== Turnstile Cookie 签名/验证 ==========
async function signTurnstileCookie(secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const payload = `ok:${Date.now()}`;
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}

async function verifyTurnstileCookie(secret, cookieValue) {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const [payload, sig] = cookieValue.split(".");
    if (!payload || !sig) return false;
    const expectedSig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)))));
    return sig === expectedSig;
  } catch {
    return false;
  }
}

// ========== Turnstile 验证页面 ==========
function serveTurnstilePage(siteKey, redirectPath) {
  const safe = escapeHtml(redirectPath);
  return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LBW教程网 - 人机验证</title>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad" async defer></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #0d1117; display: flex; justify-content: center; align-items: center; min-height: 100vh; user-select: none; }
  .verify-box { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 48px 40px; text-align: center; max-width: 420px; width: 90%; }
  .verify-box h1 { color: #c9d1d9; font-size: 22px; margin-bottom: 10px; }
  .verify-box p { color: #8b949e; font-size: 14px; line-height: 1.6; margin-bottom: 28px; }
  .turnstile-wrapper { display: inline-block; }
</style>
</head>
<body>
  <div class="verify-box">
    <h1>LBW教程网</h1>
    <p>正在验证您的访问身份，请稍候...</p>
    <div class="turnstile-wrapper">
      <div class="cf-turnstile" data-sitekey="${siteKey}" data-theme="dark"></div>
    </div>
  </div>
  <script>
    window.onTurnstileLoad = function() {
      if (window.turnstile) {
        window.turnstile.render('.cf-turnstile', {
          sitekey: '${siteKey}',
          theme: 'dark',
          callback: function(token) {
            var form = document.createElement('form');
            form.method = 'POST';
            form.action = '/__turnstile-verify';
            form.style.display = 'none';
            var t = document.createElement('input');
            t.name = 'cf-turnstile-response'; t.value = token; form.appendChild(t);
            var r = document.createElement('input');
            r.name = 'redirect'; r.value = '${safe}'; form.appendChild(r);
            document.body.appendChild(form);
            form.submit();
          }
        });
      }
    };
  </script>
</body>
</html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// ========== 鉴权检查 ==========
async function checkAuth(request, env) {
  const token = getCookie(request, "admin_token");
  if (!token) return { ok: false };
  const row = await env.DB.prepare(
    "SELECT * FROM admin_tokens WHERE token = ?"
  ).bind(token).first();
  if (!row) return { ok: false };
  if (Date.now() > row.expires) {
    await env.DB.prepare("DELETE FROM admin_tokens WHERE token = ?").bind(token).run();
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
  for (let i = 0; i < 32; i++) result += chars[bytes[i] % chars.length];
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

async function saveLog(db, entry) {
  try {
    await db.prepare(
      "INSERT INTO visitors (time, ip, country, city, colo, asn, path, method, ua, referer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      entry.time, entry.ip, entry.country, entry.city, entry.colo,
      entry.asn, entry.path, entry.method, entry.ua, entry.referer
    ).run();
  } catch (e) {
    console.error("D1 insert error:", e);
  }
}

// ========== 登录页面 ==========
function renderLoginPage(errorType, lockSeconds) {
  const totalSec = Number(lockSeconds) || 0;
  const initMin = Math.floor(totalSec / 60);
  const initSec = totalSec % 60;
  const initDisplay = totalSec > 0 ? `${initMin} 分 ${initSec} 秒` : "";

  let msg = "";
  let showTimer = false;
  if (errorType === "wrong") { msg = "密码错误！请等待冷却时间结束后再试。"; showTimer = true; }
  else if (errorType === "locked") { msg = "账号已被锁定，请等待冷却时间结束后再试。"; showTimer = true; }

  const msgHtml = msg
    ? `<div class="error-msg"><span>${msg}</span>${showTimer && totalSec > 0 ? `<span class="countdown" id="countdown">${initDisplay}</span>` : ""}</div>`
    : "";
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
      <div class="input-group"><label>管理密码</label><input type="password" name="password" placeholder="请输入管理密码" ${disabled} required></div>
      <div class="bottom-row"><label><input type="checkbox" name="remember" value="1" ${disabled}> 记住我（7天）</label></div>
      <button type="submit" class="login-btn" ${disabled}>登 录</button>
    </form>
  </div>
  ${showTimer && totalSec > 0 ? `
  <script>
    (function(){var el=document.getElementById("countdown");if(!el)return;var r=${totalSec};
    function t(){if(r<=0){el.textContent="已解除";el.style.color="#3fb950";setTimeout(function(){location.href="/__login"},1500);return}
    var m=Math.floor(r/60),s=r%60;el.textContent=m+" 分 "+s+" 秒";r--;setTimeout(t,1000)}t()})();
  </script>` : ""}
</body>
</html>`;
}

// ========== 日志页面 ==========
function renderLogPage(entries) {
  const rows = entries.map((e, i) => `
    <tr>
      <td>${i + 1}</td><td>${e.time}</td><td><code>${e.ip}</code></td>
      <td>${e.country} / ${e.city}</td><td>${e.asn}</td><td>${e.path}</td>
      <td>${e.method}</td><td>${escapeHtml(e.ua)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
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
  <div class="topbar"><h2>访问日志（最近 ${entries.length} 条）</h2>
    <div class="actions">
      <a href="/__clear" class="btn btn-danger" onclick="return confirm('确定清空所有日志？')">清空日志</a>
      <a href="/__logout" class="btn">退出登录</a>
    </div>
  </div>
  ${entries.length === 0 ? '<div class="empty">暂无访问记录</div>' : `<div class="container">
    <table><thead><tr><th>#</th><th>时间</th><th>IP</th><th>位置</th><th>ASN</th><th>路径</th><th>请求方式</th><th>客户端</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`}
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
