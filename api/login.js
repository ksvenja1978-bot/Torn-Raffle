export default async function handler(req, res) {

    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });

    }


    try {

        const { apiKey } =
            req.body || {};


        if (!apiKey) {

            return res.status(400).json({
                error: "API-Key fehlt."
            });

        }


        const url =
            "https://api.torn.com/user/?selections=profile&key=" +
            encodeURIComponent(apiKey);


        const response =
            await fetch(url);


        const data =
            await response.json();


        if (!response.ok || data.error) {

            return res.status(401).json({
                error: "Der Torn API-Key ist ungültig."
            });

        }


        return res.status(200).json({

            id: data.player_id,

            name: data.name

        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error: "Fehler bei der Verbindung zur Torn API."
        });

    }

}
