import ollama from 'ollama';

export async function getOllamaResponse(ollamares) {
    const res = await ollama.chat({
        model: 'llama3.2:latest',
        messages: [{ role: 'user', content: ollamares }]
    });
// console.log(res.message.content);
return res.message.content;
}