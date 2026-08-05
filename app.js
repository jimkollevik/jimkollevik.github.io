const API_URL = '/api/chat';
let conversationId = "";

function handleKeyPress(e) {
    if (e.key === 'Enter') handleSend();
}

function sendSuggestion(text) {
    document.getElementById('user-input').value = text;
    handleSend();
    document.getElementById('suggestions').style.display = 'none'; 
}

async function handleSend() {
    const inputField = document.getElementById('user-input');
    const query = inputField.value.trim();
    if (!query) return;

    inputField.value = '';

    // 1. Rendera användarens text
    appendMessage(query, 'user');

    // 2. Skapa agentens bubbla
    const agentMessageDiv = appendMessage('', 'agent');
    agentMessageDiv.innerText = "Tänker...";

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                conversation_id: conversationId
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Okänt serverfel");
        }

        agentMessageDiv.innerText = "";

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            // Hantera alla typer av mobil-radbrytningar
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || ''; // Spara sista raden om den är delad

            for (const line of lines) {
                const cleanLine = line.trim();
                
                // CRUCIAL: Safaris mönster-validering kräver att vi stenhårt 
                // rensar bort allt som inte börjar med data: och att det faktiskt finns text efter.
                if (!cleanLine || !cleanLine.startsWith('data:') || cleanLine.length <= 5) {
                    continue; 
                }

                try {
                    // Klipp ut JSON-strängen
                    const jsonString = cleanLine.slice(5).trim();
                    
                    // Safaris panikbroms: Om strängen inte börjar med { så kör vi inte JSON.parse
                    if (!jsonString.startsWith('{')) {
                        continue;
                    }

                    const parsed = JSON.parse(jsonString);
                    
                    if (parsed.conversation_id) {
                        conversationId = parsed.conversation_id; 
                    }

                    // Säkra att det är ett faktiskt textmeddelande från Dify
                    if (parsed.event === 'message' && parsed.answer) {
                        agentMessageDiv.innerText += parsed.answer;
                        
                        // Scrolla ner automatiskt
                        const chatBox = document.getElementById('chat-box');
                        chatBox.scrollTop = chatBox.scrollHeight;
                    }
                } catch (e) {
                    // Det var en trasig rad, vi sväljer felet tyst så att mobilen bara tuggar vidare
                    console.log("Hoppade över ogiltig JSON-rad på mobilen.");
                }
            }
        }
    } catch (error) {
        console.error("Fel fångat i frontend:", error);
        agentMessageDiv.innerText = `Kunde inte hämta svar. Felmeddelande: ${error.message}`;
    }
}


function appendMessage(text, sender) {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.innerText = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return msgDiv;
}
