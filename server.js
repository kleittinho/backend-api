import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import mysql from 'mysql2/promise';
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL || "https://arvzubxbvxrmftljrczi.supabase.co",
    process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydnp1YnhidnhybWZ0bGpyY3ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDMzODAsImV4cCI6MjA4NjU3OTM4MH0.ODUr_GPX4G07_xa7qFc5oTgRHdlhCUocUqXPpj0RvvE"
);

const mysqlPool = mysql.createPool({
    host: '108.167.169.203', user: 'equality_jarvis', password: '0wjKfiG3iHi5ouFp', database: 'equality_jarvis',
    waitForConnections: true, connectionLimit: 10
});

const WEBHOOK_CHAT = "https://n8n.equalitycorretora.com/webhook/01ec4b3a-1a4b-4b4e-9cc0-37e7b5e950a6/chat";
const WEBHOOK_AUTH = "https://n8n.equalitycorretora.com/webhook/auth-events";

app.get("/", (req, res) => res.send("LiveZilla Platinum v9.3 Active 🛡️⚡"));

// --- AUTH ---
app.post("/auth/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await mysqlPool.execute("SELECT id, username, full_name, email FROM operators WHERE username = ? AND password = ?", [username, password]);
        if (rows.length > 0) res.json({ status: "success", user: rows[0] });
        else res.status(401).json({ status: "error", message: "Login ou senha incorretos" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    try {
        const [rows] = await mysqlPool.execute("SELECT id, username FROM operators WHERE email = ?", [email]);
        if (rows.length > 0) {
            const token = crypto.randomBytes(20).toString('hex');
            const expires = new Date(Date.now() + 3600000);
            await mysqlPool.execute("UPDATE operators SET recovery_token = ?, token_expires = ? WHERE email = ?", [token, expires, email]);
            fetch(WEBHOOK_AUTH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'password_reset', email, token, username: rows[0].username }) }).catch(console.error);
        }
        res.json({ status: "ok" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- TRACKING ---
app.post("/track", async (req, res) => {
    const { event, session_id, data, url, title, user_agent, geo, tech } = req.body;
    if (!session_id) return res.json({ status: "skipped" });
    try {
        const ip = geo?.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const clientUA = user_agent || req.headers['user-agent'] || '';

        await supabase.from("sessions").upsert({
            id: session_id, ip: String(ip), user_agent: String(clientUA),
            state: 'active', url: url || null, referrer: req.body.referrer || null,
            city: geo?.city || null, region: geo?.region || null, country_name: geo?.country_name || null, country_code: geo?.country || null,
            os: tech?.os || null, resolution: tech?.resolution || null, updated_at: new Date().toISOString()
        });

        if (event === "page_view") {
            await supabase.from("visitor_path").insert([{ session_id, url: url || '', title: title || 'Página' }]);
        }
        await supabase.from("events").insert([{ session_id, event, url: url || null, user_agent: clientUA, data: data || {} }]);
        res.json({ status: "ok" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- MESSAGING ---
app.post("/message", async (req, res) => {
    const { session_id, message, user_agent, url, referrer, geo, tech } = req.body;
    if (!session_id || !message) return res.status(400).json({ error: "Missing data" });
    try {
        const ip = geo?.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const { data: sessData } = await supabase.from("sessions").upsert({
            id: session_id, ip: String(ip), user_agent: String(user_agent || ''),
            state: 'active', url: url || null, updated_at: new Date().toISOString()
        }).select("control_mode").single();

        const mode = sessData?.control_mode || 'bot';
        await supabase.from("messages").insert([{ session_id, sender: "user", message }]);

        if (mode === 'bot') {
            const n8nRes = await fetch(WEBHOOK_CHAT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session_id, chatInput: message }) });
            res.send(await n8nRes.text());
        } else { res.json({ type: "item", content: "..." }); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ADMIN ACCESS ---
app.get("/sessions", async (req, res) => {
    const { data } = await supabase.from("sessions").select("*").order("updated_at", { ascending: false }).limit(50);
    res.json(data || []);
});

app.get("/session-details/:sessionId", async (req, res) => {
    const sid = req.params.sessionId;
    const [session, events, messages, path] = await Promise.all([
        supabase.from("sessions").select("*").eq("id", sid).single(),
        supabase.from("events").select("*").eq("session_id", sid).order("created_at", { ascending: true }),
        supabase.from("messages").select("*").eq("session_id", sid).order("created_at", { ascending: true }),
        supabase.from("visitor_path").select("*").eq("session_id", sid).order("created_at", { ascending: true })
    ]);
    res.json({ session: session.data, events: events.data, messages: messages.data, path: path.data });
});

app.get("/settings", async (req, res) => {
    const [rows] = await mysqlPool.execute("SELECT cfg_key, cfg_value FROM admin_config");
    const settings = {}; rows.forEach(r => settings[r.cfg_key] = r.value);
    res.json(settings);
});

app.post("/admin/takeover", async (req, res) => {
    await supabase.from("sessions").update({ control_mode: req.body.mode }).eq("id", req.body.session_id);
    res.json({ status: "ok" });
});

app.post("/admin/send", async (req, res) => {
    await supabase.from("messages").insert([{ session_id: req.body.session_id, sender: "bot", message: req.body.message }]);
    res.json({ status: "ok" });
});

app.listen(3000, () => console.log("v9.3 Master Active"));
