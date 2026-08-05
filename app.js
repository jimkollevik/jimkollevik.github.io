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
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            // Hanterar både \r\n (mobiler) och vanliga \n (desktop)
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop(); // Spara den sista ofullständiga raden i bufferten

            for (const line of lines) {
                const cleanLine = line.trim();
                
                // Mobiler skickar ibland tomma rader i strömmen, hoppa över dem
                if (!cleanLine || !cleanLine.startsWith('data:')) continue;

                try {
                    // Extrahera allt efter "data:"
                    const jsonString = cleanLine.slice(5).trim();
                    const parsed = JSON.parse(jsonString);
                    
                    if (parsed.conversation_id) {
                        conversationId = parsed.conversation_id; 
                    }

                    if (parsed.event === 'message' && parsed.answer) {
                        agentMessageDiv.innerText += parsed.answer;
                        
                        // Scrolla ner automatiskt
                        const chatBox = document.getElementById('chat-box');
                        chatBox.scrollTop = chatBox.scrollHeight;
                    }
                } catch (e) {
                    // Om en rad mot förmodan fortfarande är trasig på mobilen, 
                    // hoppar vi bara över den istället för att krascha hela chatten
                    console.log("Hoppade över trasig strömrad:", cleanLine);
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
