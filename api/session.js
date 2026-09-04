import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Hilfsfunktion zum sauberen Auslesen von Cookies
function getSessionId(req) {
    const cookieHeader = req.headers.cookie || "";
    const sessionMatch = cookieHeader.match(/(?:^|;\s*)torn_session=([^;]+)/);
    return sessionMatch ? sessionMatch[1] : null;
}

export default async function handler(req, res) {
    try {
        const sessionId = getSessionId(req);

        // =========================
        // 1. SESSION ABFRAGEN (GET)
        // =========================
        if (req.method === "GET") {
            if (!sessionId) {
                return res.status(401).json({ loggedIn: false });
            }

            const result = await sql`
                SELECT
                    s.player_id,
                    p.name,
                    p.balance,
                    p.games_played,
                    p.games_won
                FROM sessions s
                JOIN players p ON p.id = s.player_id
                WHERE s.session_id = ${sessionId}
                  AND s.expires_at > NOW()
                LIMIT 1
            `;

            if (result.length === 0) {
                return res.status(401).json({ loggedIn: false });
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
        // 2. LOGOUT (DELETE)
        // =========================
        if (req.method === "DELETE") {
            if (sessionId) {
                await sql`
                    DELETE FROM sessions
                    WHERE session_id = ${sessionId}
                `;
            }

            // Cookie löschen
            res.setHeader(
                "Set-Cookie",
                "torn_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
            );

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: "Method not allowed" });

    } catch (error) {
        console.error("Session API Error:", error);
        return res.status(500).json({ error: "Serverfehler bei der Session-Verarbeitung." });
    }
}
