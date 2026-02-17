import express from "express";
import cors from "cors";
import pg from 'pg';
import fetch from 'node-fetch';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const pool = new pg.Pool({
  host: 'db.arvzubxbvxrmftljrczi.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '9ZUcisPkujDDALeE',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const WEBHOOK_N8N = "https://n8n.equalitycorretora.com/webhook/01ec4b3a-1a4b-4b4e-9cc0-37e7b5e950a6/chat";

app.get("/", (req, res) => res.send("LiveZilla DNA Engine v6.2 Ready 🧬🚀"));

// ROUTER CENTRAL DE MENSAGENS
app.post("/message", async (req, res) => {
    const { session_id, message, user_agent, url, referrer, geo, tech } = req.body;
    if (!session_id || !message) return res.status(400).json({ error: "Missing data" });

    try {
        const clientIp = geo?.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        
        // 1. Upsert Session com Metadados Profundos
        const { rows } = await pool.query(
            `INSERT INTO public.sessions (id, ip, user_agent, state, url, referrer, city, region, country_name, country_code, os, resolution, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) 
             ON CONFLICT (id) DO UPDATE SET updated_at = NOW(), url = EXCLUDED.url, ip = EXCLUDED.ip
             RETURNING control_mode`,
            [session_id, String(clientIp), String(user_agent || ''), 'active', url || null, referrer || null, geo?.city || null, geo?.region || null, geo?.country_name || null, geo?.country || null, tech?.os || null, tech?.resolution || null]
        );

        const mode = rows[0]?.control_mode || 'bot';

        // 2. Salvar mensagem do usuário
        await pool.query("INSERT INTO public.messages (session_id, sender, message) VALUES ($1, $2, $3)", [session_id, 'user', message]);

        // 3. Resposta
        if (mode === 'bot') {
            const n8nRes = await fetch(WEBHOOK_N8N, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: session_id, chatInput: message })
            });
            const botData = await n8nRes.text();
            res.send(botData);
        } else {
            res.json({ type: "item", content: "Sua mensagem foi entregue ao consultor. Por favor, aguarde." });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// CHECK TRIGGERS (CONVITES PROATIVOS)
app.post("/check-triggers", async (req, res) => {
    const { session_id, url, time_on_page } = req.body;
    try {
        // Buscar gatilhos que batem com a URL e tempo
        const { rows: triggers } = await pool.query(
            "SELECT * FROM public.triggers WHERE is_active = true AND ($1 LIKE '%' || url_match || '%') AND time_on_page <= $2 ORDER BY priority DESC",
            [url, time_on_page || 0]
        );
        
        // Log de visita em events
        await pool.query("INSERT INTO public.events (session_id, event, url) VALUES ($1, 'page_pulse', $2)", [session_id, url]);
        
        res.json({ triggers });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// LOG DE EVENTOS (CLIQUE, SCROLL, ETC)
app.post("/track", async (req, res) => {
    const { event, session_id, data, url, user_agent } = req.body;
    try {
        await pool.query("INSERT INTO public.events (session_id, event, url, user_agent, data) VALUES ($1, $2, $3, $4, $5)", 
            [session_id, event, url || null, user_agent || null, JSON.stringify(data || {})]);
        res.json({ status: "ok" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3000, () => console.log("DNA Engine v6.2 on 3000"));
