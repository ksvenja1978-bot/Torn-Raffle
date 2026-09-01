import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { id, name } = req.body || {};

        if (!id || !name) {
            return res.status(400).json({
                error: "Spielerdaten fehlen."
            });
        }

        // Tabelle automatisch anlegen, falls sie noch nicht existiert
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

        // Spieler registrieren oder letzten Login aktualisieren
        const result = await sql`
            INSERT INTO players (id, name)
            VALUES (${id}, ${name})
            ON CONFLICT (id)
            DO UPDATE SET
                name = EXCLUDED.name,
                last_login = NOW()
            RETURNING id, name, created_at, balance, games_played, games_won
        `;

        return res.status(200).json({
            success: true,
            player: result[0]
        });

    } catch (error) {
        console.error("Register error:", error);

        return res.status(500).json({
            error: "Spieler konnte nicht registriert werden."
        });
    }
}
