export const config = {
    runtime: 'edge', // Tvingar Vercel att köra i sin supersnabba Edge-miljö som älskar streaming
};

export default async function handler(req) {
    // Hantera CORS-förfrågningar (OPTIONS)
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    const apiKey = process.env.DIFY_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API key is missing on server' }), { status: 500 });
    }

    try {
        const { query, conversation_id } = await req.json();

        // Gör anropet till Dify
        const difyResponse = await fetch('https://dify.ai', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
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

        if (!difyResponse.ok) {
            const errorText = await difyResponse.text();
            return new Response(JSON.stringify({ error: `Dify error: ${errorText}` }), { status: difyResponse.status });
        }

        // Returnera Dify-strömmen direkt till din frontend med rätt headers
        return new Response(difyResponse.body, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}
