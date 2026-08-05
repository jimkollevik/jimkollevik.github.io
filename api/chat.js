export default async function handler(req, res) {
    // Sätt CORS-headers så att webbläsaren tillåts läsa svaret
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

        // Ett minimalt och helt rent payload som garanterat accepteras av Dify Chatbot
        const requestPayload = {
            inputs: {},
            query: query,
            user: "unique_portfolio_visitor", // Obligatoriskt id för Dify-användarsessioner
            response_mode: "streaming"
        };

        // Om vi har ett pågående kontext-id, bifoga det
        if (conversation_id) {
            requestPayload.conversation_id = conversation_id;
        }

        const difyResponse = await fetch('https://api.dify.ai/v1/chat-messages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`, // Rensar eventuella dolda mellanslag
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        // Om Dify skickar ett felmeddelande, extraherar vi texten direkt ur deras svar
        if (!difyResponse.ok) {
            const errorText = await difyResponse.text();
            let parsedError = errorText;
            try {
                const jsonErr = JSON.parse(errorText);
                parsedError = jsonErr.message || jsonErr.code || errorText;
            } catch (e) {
                // Svaret var inte JSON
            }
            return res.status(difyResponse.status).json({ error: `Dify klagade på: ${parsedError}` });
        }

        // Sätt korrekta strömnings-headers för Vercel Node.js
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');

        // Strömma ut rådata direkt till din app.js
        const responseStream = difyResponse.body;
        for await (const chunk of responseStream) {
            res.write(chunk);
        }
        
        res.end();

    } catch (error) {
        return res.status(500).json({ error: `Internt Serverfel: ${error.message}` });
    }
}
