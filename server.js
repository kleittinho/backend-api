import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// CONFIGURAÇÃO SUPABASE (USANDO REST API PARA ESTABILIDADE)
const supabase = createClient(
    process.env.SUPABASE_URL || "https://arvzubxbvxrmftljrczi.supabase.co",
    process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydnp1YnhidnhybWZ0bGpyY3ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDMzODAsImV4cCI6MjA4NjU3OTM4MH0.ODUr_GPX4G07_xa7qFc5oTgRHdlhCUocUqXPpj0RvvE"
);

const WEBHOOK_N8N = "https://n8n.equalitycorretora.com/webhook/01ec4b3a-1a4b-4b4e-9cc0-37e7b5e950a6/chat";

app.get("/", (req, res) => res.send("LiveZilla DNA Engine v6.3 Platinum 🚀"));

// ENDPOINT DE CONFIGURAÇÕES
app.get("/settings", async (req, res) => {
    try {
        const { data, error } = await supabase.from("settings").select("*");
        if (error) throw error;
        const settings = {};
        data.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ROUTER DE MENSAGENS
app.post("/message", async (req, res) => {
    const { session_id, message, user_agent, url, referrer, geo, tech } = req.body;
    if (!session_id || !message) return res.status(400).json({ error: "Missing data" });

    try {
        const ip = geo?.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

        // 1. Upsert Session
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

        if (sessError) console.error("SessError:", sessError);
        const mode = sessData?.control_mode || 'bot';

        // 2. Salvar mensagem do usuário
        await supabase.from("messages").insert([{ session_id, sender: "user", message }]);

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
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// TRACKING DE EVENTOS
app.post("/track", async (req, res) => {
    const { event, session_id, data, url, user_agent, geo } = req.body;
    if (!session_id) return res.json({ status: "skipped" });
    try {
        const ip = geo?.ip || req.headers['x-forwarded-for'] || '';
        await supabase.from("sessions").upsert({ id: session_id, ip: String(ip), updated_at: new Date().toISOString() });
        await supabase.from("events").insert([{ session_id, event, url: url || null, user_agent: user_agent || null, data: data || {} }]);
        res.json({ status: "ok" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// CHECK TRIGGERS
app.post("/check-triggers", async (req, res) => {
    const { session_id, url, time_on_page } = req.body;
    try {
        const { data: triggers } = await supabase
            .from("triggers")
            .select("*")
            .eq("is_active", true)
            .lte("time_on_page", time_on_page || 0);
        
        // Filtro manual de URL (PostgREST não suporta LIKE dinâmico fácil)
        const activeTriggers = triggers.filter(t => !t.url_match || url.includes(t.url_match));
        
        res.json({ triggers: activeTriggers });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3000, () => console.log("DNA Master v6.3 on 3000"));
