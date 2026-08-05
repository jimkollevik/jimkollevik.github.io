const API_URL = '/api/chat'; // Pratar direkt med din lokala / säkra backend
let conversationId = ""; // Sparas för att hålla igång tråden/kontexten i chatten

function handleKeyPress(e) {
    if (e.key === 'Enter') handleSend();
}

function sendSuggestion(text) {
    document.getElementById('user-input').value = text;
    handleSend();
    // Döljer förslagen efter första klicket för att rensa spelytan
    document.getElementById('suggestions').style.display = 'none'; 
}

async function handleSend() {
    const inputField = document.getElementById('user-input');
    const query = inputField.value.trim();
    if (!query) return;

    inputField.value = '';

    // 1. Lägg till användarens meddelande i UI
    appendMessage(query, 'user');

    // 2. Skapa en tom bubbla för agentens strömmande svar
    const agentMessageDiv = appendMessage('', 'agent');

    // 3. Gör API-anropet till din serverlösa funktion
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                conversation_id: conversationId // Skickar med för att hålla minnet vid liv
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            // Spara sista biten om den inte är komplett än
            buffer = lines.pop(); 

            for (const line of lines) {
                if (line.startsWith('data:')) {
                    try {
                        const parsed = JSON.parse(line.slice(5));
                        
                        // Sparar conversation_id från första paketet för nästa fråga
                        if (parsed.conversation_id) {
                            conversationId = parsed.conversation_id; 
                        }

                        // Om raden innehåller text (answer), strömma ut den i gränssnittet
                        if (parsed.event === 'message' && parsed.answer) {
                            agentMessageDiv.innerText += parsed.answer;
                            
                            // Scrolla ner automatiskt under pågående streaming
                            const chatBox = document.getElementById('chat-box');
                            chatBox.scrollTop = chatBox.scrollHeight;
                        }
                    } catch (e) {
                        // Ignorerar rader som inte hunnit bli komplett JSON i bufferten
                    }
                }
            }
        }
    } catch (error) {
        console.error("Fel vid API-anrop:", error);
        agentMessageDiv.innerText = "Hoppsan, det gick inte att nå min server just nu. Kontrollera att du kör via Vercel CLI (vercel dev).";
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
