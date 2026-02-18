import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import mysql from 'mysql2/promise';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// --- POOLS ---
const supabase = createClient(
    process.env.SUPABASE_URL || "https://arvzubxbvxrmftljrczi.supabase.co",
    process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydnp1YnhidnhybWZ0bGpyY3ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDMzODAsImV4cCI6MjA4NjU3OTM4MH0.ODUr_GPX4G07_xa7qFc5oTgRHdlhCUocUqXPpj0RvvE"
);

const mysqlPool = mysql.createPool({
    host: '108.167.169.203', user: 'equality_jarvis', password: '0wjKfiG3iHi5ouFp', database: 'equality_jarvis',
    waitForConnections: true, connectionLimit: 10
});

const legacyPool = mysql.createPool({
    host: '108.167.169.203', user: 'equality_chat', password: 'agata1', database: 'equality_chat',
    waitForConnections: true, connectionLimit: 10
});

app.get("/", (req, res) => res.send("Jarvis v10.7 - Core Stable"));

// --- AUTH ---
app.post("/auth/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await mysqlPool.execute("SELECT id, username, full_name FROM operators WHERE username = ? AND password = ?", [username, password]);
        if (rows.length > 0) res.json({ status: "success", user: rows[0] });
        else res.status(401).json({ status: "error" });
    } catch (e) { 
        console.error("Auth Error:", e.message); 
        res.status(500).json({ status: "error", message: e.message }); 
    }
});

// --- LEGACY DATA (MySQL Direct) ---
app.get("/admin/legacy-visitors", async (req, res) => {
    try {
        const [rows] = await legacyPool.execute(
            "SELECT v.id, v.ip, v.country, v.entrance, c.city as city_name, b.browser as browser_name " +
            "FROM visitors v " +
            "LEFT JOIN visitor_data_cities c ON v.city = c.id " +
            "LEFT JOIN visitor_data_browsers b ON v.browser = b.id " +
            "ORDER BY v.entrance DESC LIMIT 50"
        );
        res.json(rows);
    } catch (e) { 
        console.error("Legacy Error:", e.message); 
        res.status(500).json({ status: "error", message: e.message }); 
    }
});

// --- DOSSIER ---
app.get("/admin/dossiers", async (req, res) => {
    try {
        const [rows] = await mysqlPool.execute("SELECT * FROM visitor_dossier ORDER BY updated_at DESC");
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/admin/delete-dossier", async (req, res) => {
    const { session_id } = req.body;
    try {
        await mysqlPool.execute("DELETE FROM visitor_dossier WHERE session_id = ?", [session_id]);
        res.json({ status: "success" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SUPABASE (New) ---
app.post("/track", async (req, res) => {
    const { session_id, event, url, title, geo, tech } = req.body;
    if (!session_id) return res.json({ status: "skipped" });
    try {
        const ip = geo?.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const [session] = await supabase.from("sessions").select("*").eq("id", session_id).limit(1).single();

        if (session) {
            await supabase.from("sessions").upsert({
                id: session_id, ip: String(ip), state: 'active', url: url || null,
                city: geo?.city || null, country_code: geo?.country || null,
                os: tech?.os || null, user_agent: req.headers['user-agent'], updated_at: new Date().toISOString()
            });
            if (event === "page_view") await supabase.from("visitor_path").insert([{ session_id, url: url || '', title: title || 'Página' }]);
        }
        res.json({ status: "ok" });
    } catch (error) {
        console.error("Track Error:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

app.get("/session-details/:id", async (req, res) => {
    try {
        const [session, path] = await Promise.all([
            supabase.from("sessions").select("*").eq("id", req.params.id).single(),
            supabase.from("visitor_path").select("*").eq("session_id", req.params.id).order("created_at", { ascending: true })
        ]);
        res.json({ session: session.data, path: path.data });
    } catch (e) { 
        console.error("Session Error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Jarvis v10.7 - Stable Core Active"));
