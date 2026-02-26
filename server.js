import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || "https://backend-api-app.arj8vq.easypanel.host";
const DEFAULT_WEBHOOK_URL = process.env.DEFAULT_WEBHOOK_URL || "https://n8n.equalitycorretora.com/webhook/01ec4b3a-1a4b-4b4e-9cc0-37e7b5e950a6/chat";
const DEFAULT_BOT_AVATAR = process.env.DEFAULT_BOT_AVATAR || "https://equalitycorretora.com.br/wp-content/uploads/2026/02/anne-final.png";
const DEFAULT_WELCOME_AVATAR = process.env.DEFAULT_WELCOME_AVATAR || "https://equalitycorretora.com.br/wp-content/uploads/2026/02/ane-joinha.png";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// --- POOLS ---
const supabase = createClient(
  process.env.SUPABASE_URL || "https://arvzubxbvxrmftljrczi.supabase.co",
  process.env.SUPABASE_KEY || ""
);

const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST || "108.167.169.203",
  user: process.env.MYSQL_USER || "",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "",
  waitForConnections: true,
  connectionLimit: 10,
});

const legacyPool = mysql.createPool({
  host: process.env.LEGACY_MYSQL_HOST || "108.167.169.203",
  user: process.env.LEGACY_MYSQL_USER || "",
  password: process.env.LEGACY_MYSQL_PASSWORD || "",
  database: process.env.LEGACY_MYSQL_DATABASE || "",
  waitForConnections: true,
  connectionLimit: 10,
});

function getBotId(req) {
  return req.query.bot_id || req.query.botId || "default";
}

async function getBotSettings(botId = "default") {
  try {
    const { data, error } = await supabase
      .from("bot_settings")
      .select("*")
      .eq("bot_id", botId)
      .maybeSingle();

    if (error) {
      console.warn("bot_settings fallback:", error.message);
    }

    return {
      bot_id: botId,
      bot_name: data?.bot_name || "Ane",
      primary_color: data?.primary_color || "#10b981",
      position: data?.position || "bottom-right",
      bot_avatar: data?.bot_avatar || DEFAULT_BOT_AVATAR,
      welcome_avatar: data?.welcome_avatar || DEFAULT_WELCOME_AVATAR,
      welcome_message:
        data?.welcome_message ||
        "Olá! 😊 Eu sou a Ane, assistente virtual da Equality Corretora. Como posso te ajudar hoje?",
      webhook_url: data?.webhook_url || DEFAULT_WEBHOOK_URL,
      backend_url: data?.backend_url || BACKEND_PUBLIC_URL,
      proactive_seconds: data?.proactive_seconds ?? 8,
      enabled: data?.enabled ?? true,
    };
  } catch (e) {
    console.warn("bot_settings hard fallback:", e.message);
    return {
      bot_id: botId,
      bot_name: "Ane",
      primary_color: "#10b981",
      position: "bottom-right",
      bot_avatar: DEFAULT_BOT_AVATAR,
      welcome_avatar: DEFAULT_WELCOME_AVATAR,
      welcome_message: "Olá! 😊 Eu sou a Ane, assistente virtual da Equality Corretora. Como posso te ajudar hoje?",
      webhook_url: DEFAULT_WEBHOOK_URL,
      backend_url: BACKEND_PUBLIC_URL,
      proactive_seconds: 8,
      enabled: true,
    };
  }
}

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(500).json({ error: "ADMIN_TOKEN not configured" });
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: "unauthorized" });
  next();
}

app.get("/", (req, res) => res.send("Jarvis API - AI Chat Platform"));
app.get("/health", (req, res) => res.json({ status: "ok", service: "backend-api" }));

// --- PUBLIC BOT SETTINGS ---
app.get("/settings", async (req, res) => {
  try {
    const settings = await getBotSettings(getBotId(req));
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- ADMIN BOT SETTINGS ---
app.get("/admin/bot-settings/:botId", requireAdmin, async (req, res) => {
  try {
    const settings = await getBotSettings(req.params.botId);
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/admin/bot-settings/:botId", requireAdmin, async (req, res) => {
  const botId = req.params.botId;
  const payload = req.body || {};

  try {
    const upsertPayload = {
      bot_id: botId,
      bot_name: payload.bot_name,
      primary_color: payload.primary_color,
      position: payload.position,
      bot_avatar: payload.bot_avatar,
      welcome_avatar: payload.welcome_avatar,
      welcome_message: payload.welcome_message,
      webhook_url: payload.webhook_url,
      backend_url: payload.backend_url,
      proactive_seconds: payload.proactive_seconds,
      enabled: payload.enabled,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("bot_settings").upsert(upsertPayload, { onConflict: "bot_id" });
    if (error) throw error;

    const settings = await getBotSettings(botId);
    res.json({ status: "success", settings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/admin/widget-snippet/:botId", requireAdmin, async (req, res) => {
  const botId = req.params.botId;
  try {
    const settings = await getBotSettings(botId);
    const src = `${settings.backend_url.replace(/\/$/, "")}/widget/${botId}.js`;
    res.json({
      bot_id: botId,
      script_src: src,
      snippet: `<script src="${src}"><\/script>`,
      settings,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- WIDGET DELIVERY ---
app.get("/widget/chat.js", (req, res) => {
  try {
    const filePath = path.join(__dirname, "chat.js");
    const js = fs.readFileSync(filePath, "utf8");
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.send(js);
  } catch (e) {
    res.status(500).send(`console.error(${JSON.stringify(e.message)});`);
  }
});

app.get("/widget/:botId.js", async (req, res) => {
  try {
    const settings = await getBotSettings(req.params.botId);
    const script = `
(function(){
  window.__ANE_CONFIG = ${JSON.stringify(settings)};
  var s = document.createElement('script');
  s.src = '${BACKEND_PUBLIC_URL}/widget/chat.js';
  s.async = true;
  document.head.appendChild(s);
})();`;

    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.send(script);
  } catch (e) {
    res.status(500).send(`console.error(${JSON.stringify(e.message)});`);
  }
});

// --- AUTH ---
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await mysqlPool.execute(
      "SELECT id, username, full_name FROM operators WHERE username = ? AND password = ?",
      [username, password]
    );
    if (rows.length > 0) res.json({ status: "success", user: rows[0] });
    else res.status(401).json({ status: "error" });
  } catch (e) {
    console.error("Auth Error:", e.message);
    res.status(500).json({ status: "error", message: e.message });
  }
});

// --- LEGACY DATA (MySQL Direct) ---
app.get("/admin/legacy-visitors", async (req, res) => {
  try {
    const [rows] = await legacyPool.execute(
      "SELECT v.id, v.ip, v.country, v.entrance, c.city as city_name, b.browser as browser_name " +
        "FROM visitors v " +
        "LEFT JOIN visitor_data_cities c ON v.city = c.id " +
        "LEFT JOIN visitor_data_browsers b ON v.browser = b.id " +
        "ORDER BY v.entrance DESC LIMIT 50"
    );
    res.json(rows);
  } catch (e) {
    console.error("Legacy Error:", e.message);
    res.status(500).json({ status: "error", message: e.message });
  }
});

// --- DOSSIER ---
app.get("/admin/dossiers", async (req, res) => {
  try {
    const [rows] = await mysqlPool.execute("SELECT * FROM visitor_dossier ORDER BY updated_at DESC");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/admin/delete-dossier", async (req, res) => {
  const { session_id } = req.body;
  try {
    await mysqlPool.execute("DELETE FROM visitor_dossier WHERE session_id = ?", [session_id]);
    res.json({ status: "success" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- SUPABASE (tracking) ---
app.post("/track", async (req, res) => {
  const { session_id, event, url, title, geo, tech } = req.body;
  if (!session_id) return res.json({ status: "skipped" });

  try {
    const ip = geo?.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";

    const { data: session } = await supabase.from("sessions").select("*").eq("id", session_id).maybeSingle();

    if (session || true) {
      await supabase.from("sessions").upsert({
        id: session_id,
        ip: String(ip),
        state: "active",
        url: url || null,
        city: geo?.city || null,
        country_code: geo?.country || null,
        os: tech?.os || null,
        user_agent: req.headers["user-agent"],
        updated_at: new Date().toISOString(),
      });

      if (event === "page_view") {
        await supabase.from("visitor_path").insert([{ session_id, url: url || "", title: title || "Página" }]);
      }
    }

    res.json({ status: "ok" });
  } catch (error) {
    console.error("Track Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/session-details/:id", async (req, res) => {
  try {
    const [session, pathRows] = await Promise.all([
      supabase.from("sessions").select("*").eq("id", req.params.id).single(),
      supabase.from("visitor_path").select("*").eq("session_id", req.params.id).order("created_at", { ascending: true }),
    ]);
    res.json({ session: session.data, path: pathRows.data });
  } catch (e) {
    console.error("Session Error:", e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Jarvis API running on port", PORT));
