export default async function handler(req, res) {
    // Tillåt din lokala frontend att prata med denna funktion under utveckling (Löser CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { query, conversation_id } = req.body;

        // Här gör vi anropet från server till server (Ingen CORS-blockering!)
        // Notera också /chat-messages i slutet för att undvika 308-redirects
        const difyResponse = await fetch('https://dify.ai', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.DIFY_API_KEY}`, // Hämtas säkert från miljövariabler
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: {},
                query: query,
                user: "portfolio_visitor",
                response_mode: "streaming",
                conversation_id: conversation_id || ""
            })
        });

        // Strömma svaret direkt vidare till din frontend
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = difyResponse.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value));
        }

        res.end();
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
