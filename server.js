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
    
    // Verifica se sessão já existe
    const { data: existingSession } = await supabase
        .from("sessions")
        .select("id")
        .eq("id", session_id)
        .single();
        
    // Se não existir, cria
    if (!existingSession) {
        await supabase.from("sessions").insert([
            { 
                id: session_id, 
                ip: data?.ip || null, 
                user_agent: data?.user_agent || null, 
                country: data?.country || null, 
                state: data?.state || null 
            }
        ]);
    }
    
    // Salva mensagem do usuário
    if (event === "message_sent") {
        await supabase.from("messages").insert([
            { session_id: session_id, sender: "user", message: data.message }
        ]);
    }
    
    // Salva resposta do bot
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
