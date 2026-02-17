import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import mysql from 'mysql2/promise';
import fetch from "node-fetch";
import multer from "multer";
import path from "path";

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// CONFIGURAÇÃO DE UPLOAD
const upload = multer({ dest: 'uploads/' });

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

const WEBHOOK_N8N = "https://n8n.equalitycorretora.com/webhook/01ec4b3a-1a4b-4b4e-9cc0-37e7b5e950a6/chat";

app.get("/", (req, res) => res.send("LiveZilla Ultra Engine v8.0 Master Ready 🧬💎"));

// 1. AUTENTICAÇÃO DE OPERADOR (MULT-LOGIN)
app.post("/operator/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const { data: operator } = await supabase
            .from("operators")
            .select("*")
            .or(`email.eq.${username},name.eq.${username}`)
            .eq("password_hash", password)
            .single();

        if (operator) {
            res.json({ status: "success", operator });
        } else {
            res.status(401).json({ status: "error", message: "Credenciais inválidas" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. ROUTER DE MENSAGENS (COM MODO HUMANO)
app.post("/message", async (req, res) => {
    const { session_id, message, user_agent, url, referrer, geo, tech } = req.body;
    if (!session_id) return res.status(400).json({ error: "Missing session_id" });

    try {
        const ip = geo?.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        
        const { data: sessData } = await supabase
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

        if (message) {
            await supabase.from("messages").insert([{ session_id, sender: "user", message }]);

            if (mode === 'bot') {
                const n8nRes = await fetch(WEBHOOK_N8N, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: session_id, chatInput: message })
                });
                res.send(await n8nRes.text());
            } else {
                res.json({ type: "item", content: "..." }); // Silencioso no modo humano
            }
        } else { res.json({ status: "ok" }); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. TRACKING AVANÇADO
app.post("/track", async (req, res) => {
    const { event, session_id, data, url, title, user_agent, geo } = req.body;
    if (!session_id) return res.json({ status: "ok" });
    try {
        const ip = geo?.ip || req.headers['x-forwarded-for'] || '';
        await supabase.from("sessions").upsert({ id: session_id, ip: String(ip), updated_at: new Date().toISOString() });
        
        if (event === "page_view") {
            await supabase.from("visitor_path").insert([{ session_id, url: url || '', title: title || 'Página' }]);
        }
        await supabase.from("events").insert([{ session_id, event, url: url || null, user_agent: user_agent || null, data: data || {} }]);
        res.json({ status: "ok" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. UPLOAD DE ARQUIVOS (RECEBER DOCUMENTOS)
app.post("/upload", upload.single('file'), async (req, res) => {
    const { session_id, sender } = req.body;
    const file = req.file;
    if (!file || !session_id) return res.status(400).json({ error: "Missing data" });

    // Aqui salvaríamos o arquivo em um storage real (Supabase ou Local)
    // Por enquanto, apenas registramos no banco para o Admin ver
    try {
        const fileUrl = `https://equalitycorretora.com.br/chatane/uploads/${file.filename}`; // Placeholder
        await supabase.from("uploads").insert([{
            session_id,
            file_url: fileUrl,
            file_name: file.originalname,
            file_size: file.size,
            sender
        }]);
        res.json({ status: "ok", url: fileUrl });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. SUMÁRIO ANALÍTICO (PARA GRÁFICOS)
app.get("/admin/stats", async (req, res) => {
    try {
        const [
            { count: totalSessions },
            { count: totalMessages },
            { data: conversions }
        ] = await Promise.all([
            supabase.from("sessions").select("*", { count: 'exact', head: true }),
            supabase.from("messages").select("*", { count: 'exact', head: true }),
            supabase.from("conversions").select("*").order("created_at", { ascending: true })
        ]);
        res.json({ totalSessions, totalMessages, conversions });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ACÇÕES ADMIN
app.post("/admin/takeover", async (req, res) => {
    const { session_id, mode } = req.body;
    await supabase.from("sessions").update({ control_mode: mode }).eq("id", session_id);
    res.json({ status: "ok" });
});

app.post("/admin/send", async (req, res) => {
    const { session_id, message } = req.body;
    await supabase.from("messages").insert([{ session_id, sender: "bot", message }]);
    res.json({ status: "ok" });
});

app.get("/settings", async (req, res) => {
    const { data } = await supabase.from("settings").select("*");
    const s = {}; data?.forEach(r => s[r.key] = r.value);
    res.json(s);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Master Ultra Engine v8.0 on " + PORT));
