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

app.get("/", (req, res) => res.send("LiveZilla Master Engine v6.1 Active 🚀"));

// ENDPOINT DE CONFIGURAÇÕES PARA O CHAT
app.get("/settings", async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM public.settings");
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ROTA DE MENSAGEM DO CLIENTE
app.post("/message", async (req, res) => {
    const { session_id, message, user_agent, url, referrer, geo } = req.body;
    if (!session_id || !message) return res.status(400).json({ error: "Missing data" });

    try {
        // Obter configurações dinâmicas
        const settingsRows = await pool.query("SELECT value FROM public.settings WHERE key = 'webhook_url'");
        const webhook_from_db = settingsRows.rows[0]?.value;
        const target_webhook = webhook_from_db || WEBHOOK_N8N;

        // Captura de IP e UA robusta
        const ip = geo?.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const ua = user_agent || req.headers['user-agent'] || '';

        // 1. Atualizar Sessão
        const { rows } = await pool.query(
            `INSERT INTO public.sessions (id, ip, user_agent, state, url, referrer, city, region, country_name, country_code, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) 
             ON CONFLICT (id) DO UPDATE SET updated_at = NOW(), url = EXCLUDED.url, ip = EXCLUDED.ip, user_agent = EXCLUDED.user_agent
             RETURNING control_mode`,
            [session_id, String(ip), String(ua), 'active', url || null, referrer || null, geo?.city || null, geo?.region || null, geo?.country_name || null, geo?.country || null]
        );

        const mode = rows[0]?.control_mode || 'bot';

        // 2. Salvar mensagem do usuário
        await pool.query("INSERT INTO public.messages (session_id, sender, message) VALUES ($1, $2, $3)", [session_id, 'user', message]);

        // 3. Resposta
        if (mode === 'bot') {
            const n8nRes = await fetch(target_webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: session_id, chatInput: message })
            });
            const botData = await n8nRes.text();
            res.send(botData);
        } else {
            res.json({ type: "item", content: "Sua mensagem foi entregue a um consultor humano. Por favor, aguarde." });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/track", async (req, res) => {
    const { event, session_id, data, url, user_agent, geo } = req.body;
    if (!session_id) return res.json({ status: "skipped" });
    try {
        const ip = geo?.ip || req.headers['x-forwarded-for'] || '';
        await pool.query(
            "INSERT INTO public.sessions (id, ip, user_agent, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (id) DO UPDATE SET updated_at = NOW(), ip = EXCLUDED.ip",
            [session_id, String(ip), String(user_agent || '')]
        );
        await pool.query("INSERT INTO public.events (session_id, event, url, user_agent, data) VALUES ($1, $2, $3, $4, $5)", 
            [session_id, event, url || null, user_agent || null, JSON.stringify(data || {})]);
        res.json({ status: "ok" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/sessions", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM public.sessions ORDER BY updated_at DESC LIMIT 50");
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/session-details/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await pool.query("SELECT * FROM public.sessions WHERE id = $1", [sessionId]);
        const events = await pool.query("SELECT * FROM public.events WHERE session_id = $1 ORDER BY created_at ASC", [sessionId]);
        const messages = await pool.query("SELECT * FROM public.messages WHERE session_id = $1 ORDER BY created_at ASC", [sessionId]);
        res.json({ session: session.rows[0], events: events.rows, messages: messages.rows });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Master v6.1 Active on " + PORT));
