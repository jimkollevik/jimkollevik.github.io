export default async function handler(req, res) {

    // Allow frontend requests
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");


    // Handle browser preflight requests
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }


    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }


    const apiKey = process.env.DIFY_API_KEY;


    if (!apiKey) {
        return res.status(500).json({
            error: "Missing DIFY_API_KEY environment variable"
        });
    }


    try {

        const {
            query,
            conversation_id
        } = req.body;


        const payload = {
            inputs: {},
            query,
            response_mode: "streaming",

            // Static anonymous visitor.
            // No personal information is stored.
            user: "portfolio_visitor"
        };


        if (conversation_id) {
            payload.conversation_id = conversation_id;
        }


        const difyResponse = await fetch(
            "https://api.dify.ai/v1/chat-messages",
            {
                method: "POST",

                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(payload)
            }
        );


        if (!difyResponse.ok) {

            const errorText = await difyResponse.text();

            console.error(
                "Dify error:",
                difyResponse.status,
                errorText
            );

            return res.status(difyResponse.status).json({
                error: "Dify API request failed",
                details: errorText
            });
        }


        // Forward SSE stream directly to browser
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive"
        });


        const reader = difyResponse.body.getReader();


        while (true) {

            const {
                done,
                value
            } = await reader.read();


            if (done) {
                break;
            }


            res.write(Buffer.from(value));
        }


        res.end();


    } catch (error) {

        console.error(error);


        return res.status(500).json({
            error: error.message
        });
    }
}