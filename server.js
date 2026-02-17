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
    host: '108.167.169.203',
    user: 'equality_jarvis',
    password: '0wjKfiG3iHi5ouFp',
    database: 'equality_jarvis',
    waitForConnections: true,
    connectionLimit: 10
});

const WEBHOOK_N8N_CHAT = "https://n8n.equalitycorretora.com/webhook/01ec4b3a-1a4b-4b4e-9cc0-37e7b5e950a6/chat";
const WEBHOOK_N8N_AUTH = "https://n8n.equalitycorretora.com/webhook/auth-events"; // Para envio de e-mails

app.get("/", (req, res) => res.send("LiveZilla DNA Engine v8.9 - Secure Auth 🛡️🚀"));

// --- SISTEMA DE AUTENTICAÇÃO (MYSQL) ---

app.post("/auth/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await mysqlPool.execute(
            "SELECT id, username, full_name, email FROM operators WHERE username = ? AND password = ?",
            [username, password]
        );

        if (rows.length > 0) {
            res.json({ status: "success", user: rows[0] });
        } else {
            res.status(401).json({ status: "error", message: "Login ou senha incorretos" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    try {
        const [rows] = await mysqlPool.execute("SELECT id, username FROM operators WHERE email = ?", [email]);
        if (rows.length === 0) return res.json({ status: "ok" }); // Silencioso por segurança

        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hora

        await mysqlPool.execute(
            "UPDATE operators SET recovery_token = ?, token_expires = ? WHERE email = ?",
            [token, expires, email]
        );

        // Disparar n8n para enviar o e-mail
        fetch(WEBHOOK_N8N_AUTH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'password_reset', email, token, username: rows[0].username })
        }).catch(console.error);

        res.json({ status: "ok", message: "Se o e-mail existir, as instruções foram enviadas." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- TRACKING & CHAT (SUPABASE) ---

app.post("/message", async (req, res) => {
    const { session_id, message, user_agent, url, referrer, geo, tech } = req.body;
    if (!session_id) return res.status(400).json({ error: "Missing session_id" });

    try {
        const ip = geo?.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        await supabase.from("sessions").upsert({
            id: session_id, ip: String(ip), user_agent: String(user_agent || ''),
            state: 'active', url: url || null, referrer: referrer || null,
            city: geo?.city || null, region: geo?.region || null, country_code: geo?.country || null,
            updated_at: new Date().toISOString()
        });

        if (message) {
            await supabase.from("messages").insert([{ session_id, sender: "user", message }]);
            const n8nRes = await fetch(WEBHOOK_N8N_CHAT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: session_id, chatInput: message })
            });
            res.send(await n8nRes.text());
        } else { res.json({ status: "ok" }); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/settings", async (req, res) => {
    try {
        const [rows] = await mysqlPool.execute("SELECT cfg_key, cfg_value FROM admin_config");
        const settings = {}; rows.forEach(r => settings[r.cfg_key] = r.value);
        res.json(settings);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3000, () => console.log("v8.9 Secure Auth Active"));
