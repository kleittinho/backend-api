import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

app.get("/", (req, res) => {
    res.send("Backend conectado ao Supabase 🚀");
});

// Rota de tracking
app.post("/track", async (req, res) => {
    const { event, session_id, data } = req.body;
    // Se for envio de mensagem do usuário
    if (event === "message_sent") {
        await supabase.from("messages").insert([
            { session_id: session_id, sender: "user", message: data.message }
        ]);
    }
    // Se for resposta do bot
    if (event === "message_received") {
        await supabase.from("messages").insert([
            { session_id: session_id, sender: "bot", message: data.response }
        ]);
    }
    res.json({ status: "ok" });
});

// Listar sessões
app.get("/sessions", async (req, res) => {
    const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false });
    if (error) return res.status(500).json(error);
    res.json(data);
});

// Listar mensagens
app.get("/messages/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
    if (error) return res.status(500).json(error);
    res.json(data);
});

app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000");
});
