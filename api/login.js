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

        // Spieler erfolgreich bei Torn gefunden
        const player = {
            id: Number(data.player_id),
            name: String(data.name)
        };

        return res.status(200).json({
            success: true,
            player
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            error: "Fehler bei der Verbindung zur Torn API."
        });
    }
}
