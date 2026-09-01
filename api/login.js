import crypto from "crypto";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { apiKey } = req.body || {};

        if (!apiKey || typeof apiKey !== "string") {
            return res.status(400).json({
                error: "API-Key fehlt."
            });
        }

        // Torn API prüfen
        const response = await fetch(
            "https://api.torn.com/user/?selections=profile&key=" +
            encodeURIComponent(apiKey)
        );

        const data = await response.json();

        if (!response.ok || data.error) {
            return res.status(401).json({
                error: "Der Torn API-Key ist ungültig."
            });
        }

        const id = Number(data.player_id);
        const name = String(data.name);

        // Datenbank vorbereiten
        await sql`
            CREATE TABLE IF NOT EXISTS players (
                id BIGINT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_login TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                balance BIGINT NOT NULL DEFAULT 0,
                games_played BIGINT NOT NULL DEFAULT 0,
                games_won BIGINT NOT NULL DEFAULT 0
            )
        `;

        // Spieler registrieren / aktualisieren
        const result = await sql`
            INSERT INTO players (id, name)
            VALUES (${id}, ${name})
            ON CONFLICT (id)
            DO UPDATE SET
                name = EXCLUDED.name,
                last_login = NOW()
            RETURNING id, name, created_at, balance, games_played, games_won
        `;
// Session erstellen
const sessionId = crypto.randomBytes(32).toString("hex");

await sql`
    CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        player_id BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
    )
`;

await sql`
    DELETE FROM sessions
    WHERE player_id = ${id}
`;

await sql`
    INSERT INTO sessions (
        session_id,
        player_id
    )
    VALUES (
        ${sessionId},
        ${id}
    )
// Session erstellen
const sessionId = crypto.randomBytes(32).toString("hex");

await sql`
    CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        player_id BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
    )
`;

await sql`
    DELETE FROM sessions
    WHERE player_id = ${id}
`;

await sql`
    INSERT INTO sessions (
        session_id,
        player_id
    )
    VALUES (
        ${sessionId},
        ${id}
    )
`;

res.setHeader(
    "Set-Cookie",
    `torn_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
);

return res.status(200).json({
    success: true,
    id: Number(player.id),
    name: player.name,
    balance: Number(player.balance),
    gamesPlayed: Number(player.games_played),
    gamesWon: Number(player.games_won),
    registeredAt: player.created_at
});`;

res.setHeader(
    "Set-Cookie",
    `torn_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
);


        const player = result[0];


    } catch (error) {
        console.error("Login/registration error:", error);

        return res.status(500).json({
            error: "Serverfehler bei Login und Registrierung."
        });
    }
}
