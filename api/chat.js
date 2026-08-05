export default async function handler(req, res) {
    // Sätt CORS-headers så att din frontend får prata med backenden
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Hantera CORS Preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metoden tillåts inte' });
    }

    const apiKey = process.env.DIFY_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'DIFY_API_KEY saknas helt i Vercels miljövariabler!' });
    }

    try {
        const { query, conversation_id } = req.body;

        // Skapa payload för Dify Chatbot API
        const requestPayload = {
            inputs: {},
            query: query,
            user: "unique_portfolio_visitor", // Obligatoriskt id för Dify-användarsessioner
            response_mode: "streaming"
        };

        if (conversation_id) {
            requestPayload.conversation_id = conversation_id;
        }

        // Anrop till Dify API
        const difyResponse = await fetch('https://dify.ai', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        if (!difyResponse.ok) {
            const errorText = await difyResponse.text();
            return res.status(difyResponse.status).json({ error: `Dify API fel: ${errorText}` });
        }

        // Sätt korrekta strömnings-headers för Vercel Node.js
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');

        const reader = difyResponse.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = '';

        // Läs in strömmen från Dify på servern, städa den, och skicka till klienten
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || '';

            for (const line of lines) {
                const cleanLine = line.trim();
                
                // SERVER-FILTER: Skicka BARA vidare rader som faktiskt innehåller JSON-data.
                // Detta klipper bort dolda pings/heartbeats som kraschar mobil-Safari.
                if (cleanLine.startsWith('data:')) {
                    const jsonPart = cleanLine.slice(5).trim();
                    if (jsonPart.startsWith('{')) {
                        // Skriv ut den rena raden till webbläsaren (både mobil och desktop)
                        res.write(`${cleanLine}\n\n`); 
                    }
                }
            }
        }
        
        res.end();

    } catch (error) {
        return res.status(500).json({ error: `Internt Serverfel: ${error.message}` });
    }
}
