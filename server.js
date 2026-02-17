import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import mysql from 'mysql2/promise';
import fetch from "node-fetch";

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// CONFIG SUPABASE
const supabase = createClient(
    process.env.SUPABASE_URL || "https://arvzubxbvxrmftljrczi.supabase.co",
    process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydnp1YnhidnhybWZ0bGpyY3ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDMzODAsImV4cCI6MjA4NjU3OTM4MH0.ODUr_GPX4G07_xa7qFc5oTgRHdlhCUocUqXPpj0RvvE"
);

// CONFIG MYSQL HOSTGATOR (ADMIN DATA)
const mysqlPool = mysql.createPool({
    host: '108.167.169.203',
    user: 'equality_jarvis',
    password: '0wjKfiG3iHi5ouFp',
    database: 'equality_jarvis',
    waitForConnections: true,
    connectionLimit: 10
});

const WEBHOOK_N8N = "https://n8n.equalitycorretora.com/webhook/01ec4b3a-1a4b-4b4e-9cc0-37e7b5e950a6/chat";

app.get("/", (req, res) => res.send("LiveZilla DNA Pro v7.2 - Master Active 🚀🌍"));

// 1. ENDPOINT DE CONFIGURAÇÕES (LENDO DO MYSQL)
app.get("/settings", async (req, res) => {
    try {
        const [rows] = await mysqlPool.execute("SELECT cfg_key, cfg_value FROM admin_config");
        const settings = {};
        rows.forEach(r => settings[r.cfg_key] = r.cfg_value);
        res.json(settings);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. ATUALIZAR CONFIGURAÇÕES (SALVANDO NO MYSQL)
app.post("/settings", async (req, res) => {
    const { settings } = req.body; // { bot_name: 'Ane', ... }
    try {
        for (const [key, value] of Object.entries(settings)) {
            await mysqlPool.execute("INSERT INTO admin_config (cfg_key, cfg_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE cfg_value = ?", [key, value, value]);
        }
        res.json({ status: "ok" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. ROTA DE MENSAGEM DO CLIENTE (ROUTER)
app.post("/message", async (req, res) => {
    const { session_id, message, user_agent, url, referrer, geo, tech } = req.body;
    if (!session_id) return res.status(400).json({ error: "Missing session_id" });

    try {
        const ip = geo?.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        
        // 1. Upsert Session no Supabase
        const { data: sessData, error: sessError } = await supabase
            .from("sessions")
            .upsert({
                id: session_id,
                ip: String(ip),
                user_agent: String(user_agent || ''),
                state: 'active',
                url: url || null,
                referrer: referrer || null,
                city: geo?.city || null,
                region: geo?.region || null,
                country_name: geo?.country_name || null,
                country_code: geo?.country || null,
                os: tech?.os || null,
                resolution: tech?.resolution || null,
                updated_at: new Date().toISOString()
            })
            .select("control_mode")
            .single();

        const mode = sessData?.control_mode || 'bot';

        // 2. Salvar mensagem do usuário
        if (message) {
            await supabase.from("messages").insert([{ session_id, sender: "user", message }]);

            if (mode === 'bot') {
                const n8nRes = await fetch(WEBHOOK_N8N, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: session_id, chatInput: message })
                });
                const botResponse = await n8nRes.text();
                res.send(botResponse);
            } else {
                res.json({ type: "item", content: "Mensagem recebida pelo consultor humano." });
            }
        } else {
            res.json({ status: "ok" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. TRACKING DE EVENTOS
app.post("/track", async (req, res) => {
    const { event, session_id, data, url, user_agent, geo } = req.body;
    if (!session_id) return res.json({ status: "ok" });
    try {
        const ip = geo?.ip || req.headers['x-forwarded-for'] || '';
        await supabase.from("sessions").upsert({ id: session_id, ip: String(ip), updated_at: new Date().toISOString() });
        await supabase.from("events").insert([{ session_id, event, url: url || null, user_agent: user_agent || null, data: data || {} }]);
        res.json({ status: "ok" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. GATILHOS PROATIVOS (MYSQL)
app.post("/check-triggers", async (req, res) => {
    const { url, time_on_page } = req.body;
    try {
        const [rows] = await mysqlPool.execute("SELECT * FROM proactive_triggers WHERE is_active = TRUE AND ? LIKE CONCAT('%', url_pattern, '%') AND wait_seconds <= ?", [url, time_on_page || 0]);
        res.json({ triggers: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("LiveZilla Pro Master on " + PORT));
