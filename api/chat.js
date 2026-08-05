export default async function handler(req, res) {
    // Sätt CORS-headers direkt på Vercel Response-objektet
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Hantera CORS-preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metoden tillåts inte' });
    }

    const apiKey = process.env.DIFY_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'DIFY_API_KEY saknas i Vercels miljövariabler!' });
    }

    try {
        const { query, conversation_id } = req.body;

        // Anrop till Dify API (Notera den exakta sökvägen till /chat-messages)
        const difyResponse = await fetch('https://dify.ai', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: {},
                query: query,
                user: "portfolio_visitor_session", // Dify kräver ett identifierande användar-ID
                response_mode: "streaming",
                conversation_id: conversation_id || ""
            })
        });

        if (!difyResponse.ok) {
            const errorText = await difyResponse.text();
            return res.status(difyResponse.status).json({ error: `Dify API Returnerade Fel: ${errorText}` });
        }

        // Sätt korrekta headers för att frontend ska förstå att en ström (Server-Sent Events) startar
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Läs in Difys dataström och skriv ut den direkt till klienten
        const reader = difyResponse.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value));
        }

        res.end();

    } catch (error) {
        return res.status(500).json({ error: `Internt Serverfel: ${error.message}` });
    }
}
