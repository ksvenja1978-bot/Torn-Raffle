import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    try {
        // =========================
        // SESSION ANLEGEN
        // =========================
        if (req.method === "POST") {
            const { playerId } = req.body || {};

            if (!playerId) {
                return res.status(400).json({
                    error: "Spieler-ID fehlt."
                });
            }

            // Session-ID erzeugen
            const sessionId = crypto.randomBytes(32).toString("hex");

            // Sessions-Tabelle erstellen, falls sie noch nicht existiert
            await sql`
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    player_id BIGINT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
                )
            `;

            // Alte Sessions dieses Spielers löschen
            await sql`
                DELETE FROM sessions
                WHERE player_id = ${playerId}
            `;

            // Neue Session speichern
            await sql`
                INSERT INTO sessions (
                    session_id,
                    player_id
                )
                VALUES (
                    ${sessionId},
                    ${playerId}
                )
            `;

            // Session als HTTP-only Cookie setzen
            res.setHeader(
                "Set-Cookie",
                `torn_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
            );

            return res.status(200).json({
                success: true
            });
        }

        // =========================
        // SESSION ABFRAGEN
        // =========================
        if (req.method === "GET") {
            const cookieHeader = req.headers.cookie || "";

            const sessionMatch = cookieHeader.match(
                /(?:^|;\s*)torn_session=([^;]+)/
            );

            if (!sessionMatch) {
                return res.status(401).json({
                    loggedIn: false
                });
            }

            const sessionId = sessionMatch[1];

            const result = await sql`
                SELECT
                    s.player_id,
                    p.name,
                    p.balance,
                    p.games_played,
                    p.games_won
                FROM sessions s
                JOIN players p
                    ON p.id = s.player_id
                WHERE s.session_id = ${sessionId}
                  AND s.expires_at > NOW()
                LIMIT 1
            `;

            if (result.length === 0) {
                return res.status(401).json({
                    loggedIn: false
                });
            }

            const player = result[0];

            return res.status(200).json({
                loggedIn: true,
                player: {
                    id: Number(player.player_id),
                    name: player.name,
                    balance: Number(player.balance),
                    gamesPlayed: Number(player.games_played),
                    gamesWon: Number(player.games_won)
                }
            });
        }

        // =========================
        // LOGOUT
        // =========================
        if (req.method === "DELETE") {
            const cookieHeader = req.headers.cookie || "";

            const sessionMatch = cookieHeader.match(
                /(?:^|;\s*)torn_session=([^;]+)/
            );

            if (sessionMatch) {
                const sessionId = sessionMatch[1];

                await sql`
                    DELETE FROM sessions
                    WHERE session_id = ${sessionId}
                `;
            }

            res.setHeader(
                "Set-Cookie",
                "torn_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
            );

            return res.status(200).json({
                success: true
            });
        }

        return res.status(405).json({
            error: "Method not allowed"
        });

    } catch (error) {
        console.error("Session error:", error);

        return res.status(500).json({
            error: "Session konnte nicht verarbeitet werden."
        });
    }
}
