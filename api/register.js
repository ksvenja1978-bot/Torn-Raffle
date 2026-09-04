import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Hilfsfunktion zum Auslesen von Cookies
function parseCookies(cookieHeader) {
    const list = {};
    if (!cookieHeader) return list;

    cookieHeader.split(";").forEach((cookie) => {
        let [name, ...rest] = cookie.split("=");
        name = name?.trim();
        if (!name) return;
        const value = rest.join("=").trim();
        list[name] = decodeURIComponent(value);
    });

    return list;
}

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        // 1. Session-Cookie auslesen
        const cookies = parseCookies(req.headers.cookie);
        const sessionId = cookies.torn_session;

        if (!sessionId) {
            return res.status(401).json({ authenticated: false, error: "Nicht eingeloggt." });
        }

        // 2. Session in der Datenbank prüfen und Spielerdaten laden
        const result = await sql`
            SELECT 
                p.id, 
                p.name, 
                p.balance, 
                p.games_played, 
                p.games_won,
                s.expires_at
            FROM sessions s
            JOIN players p ON s.player_id = p.id
            WHERE s.session_id = ${sessionId}
              AND s.expires_at > NOW()
        `;

        if (result.length === 0) {
            return res.status(401).json({ authenticated: false, error: "Session abgelaufen oder ungültig." });
        }

        const player = result[0];

        // 3. Erfolgreiche Antwort mit aktuellen Guthaben-Daten
        return res.status(200).json({
            authenticated: true,
            player: {
                id: Number(player.id),
                name: player.name,
                balance: Number(player.balance),
                gamesPlayed: Number(player.games_played),
                gamesWon: Number(player.games_won)
            }
        });

    } catch (error) {
        console.error("Session check error:", error);
        return res.status(500).json({ error: "Serverfehler beim Prüfen der Session." });
    }
}
