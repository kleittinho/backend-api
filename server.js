import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL || "https://arvzubxbvxrmftljrczi.supabase.co",
    process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydnp1YnhidnhybWZ0bGpyY3ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDMzODAsImV4cCI6MjA4NjU3OTM4MH0.ODUr_GPX4G07_xa7qFc5oTgRHdlhCUocUqXPpj0RvvE"
);

const WEBHOOK_N8N = "https://n8n.equalitycorretora.com/webhook/01ec4b3a-1a4b-4b4e-9cc0-37e7b5e950a6/chat";

app.get("/", (req, res) => res.send("LiveZilla DNA Engine v7.1 Platinum Active 🚀"));

// ENDPOINT DE CONFIGURAÇÕES
app.get("/settings", async (req, res) => {
    try {
        const { data } = await supabase.from("settings").select("*");
        const settings = {};
        data?.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// LISTAR SESSÕES (PARA A DASHBOARD)
app.get("/sessions", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("sessions")
            .select("*")
            .order("updated_at", { ascending: false })
            .limit(50);
        if (error) throw error;
        res.json(data || []);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DETALHES DA SESSÃO
app.get("/session-details/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const [session, events, messages] = await Promise.all([
            supabase.from("sessions").select("*").eq("id", sessionId).single(),
            supabase.from("events").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
            supabase.from("messages").select("*").eq("session_id", sessionId).order("created_at", { ascending: true })
        ]);
        res.json({ session: session.data, events: events.data, messages: messages.data });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ROTA DE MENSAGEM DO CLIENTE (ROUTER)
app.post("/message", async (req, res) => {
    const { session_id, message, user_agent, url, referrer, geo, tech } = req.body;
    if (!session_id) return res.status(400).json({ error: "Missing session_id" });

    try {
        const ip = geo?.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        
        await supabase.from("sessions").upsert({
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
        });

        if (message) {
            await supabase.from("messages").insert([{ session_id, sender: "user", message }]);
            
            const { data: sess } = await supabase.from("sessions").select("control_mode").eq("id", session_id).single();
            if (sess?.control_mode === 'human') {
                return res.json({ type: "item", content: "Mensagem recebida pelo consultor." });
            }

            const n8nRes = await fetch(WEBHOOK_N8N, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: session_id, chatInput: message })
            });
            res.send(await n8nRes.text());
        } else {
            res.json({ status: "ok" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// TRACKING DE EVENTOS
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

// ADMIN: TAKEOVER
app.post("/admin/takeover", async (req, res) => {
    const { session_id, mode } = req.body;
    await supabase.from("sessions").update({ control_mode: mode }).eq("id", session_id);
    res.json({ status: "ok" });
});

// ADMIN: SEND MESSAGE
app.post("/admin/send", async (req, res) => {
    const { session_id, message } = req.body;
    await supabase.from("messages").insert([{ session_id, sender: "bot", message }]);
    res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("v7.1 Active on " + PORT));
