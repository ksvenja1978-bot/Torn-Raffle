import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { apiKey } = req.body || {};

        if (!apiKey || typeof apiKey !== "string") {
            return res.status(400).json({ error: "API-Key fehlt." });
        }

        // 1. Torn API abfragen
        const response = await fetch(
            `https://api.torn.com/user/?selections=profile&key=${encodeURIComponent(apiKey)}`
        );
        const data = await response.json();

        if (!response.ok || data.error) {
            return res.status(401).json({ error: "Der Torn API-Key ist ungültig." });
        }

        const id = Number(data.player_id);
        const name = String(data.name);

        // 2. Spieler registrieren oder aktualisieren (Upsert)
        const playerResult = await sql`
            INSERT INTO players (id, name)
            VALUES (${id}, ${name})
            ON CONFLICT (id)
            DO UPDATE SET
                name = EXCLUDED.name,
                last_login = NOW()
            RETURNING id, name, created_at, balance, games_played, games_won
        `;

        const player = playerResult[0];

        // 3. Alte Sessions aufräumen & Neue erzeugen
        await sql`DELETE FROM sessions WHERE player_id = ${id}`;

        const sessionId = crypto.randomBytes(32).toString("hex");

        await sql`
            INSERT INTO sessions (session_id, player_id)
            VALUES (${sessionId}, ${id})
        `;

        // 4. HttpOnly Session-Cookie setzen
        res.setHeader(
            "Set-Cookie",
            `torn_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`
        );

        return res.status(200).json({
            success: true,
            id: Number(player.id),
            name: player.name,
            balance: Number(player.balance),
            gamesPlayed: Number(player.games_played),
            gamesWon: Number(player.games_won)
        });

    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ error: "Serverfehler bei Login und Registrierung." });
    }
}
