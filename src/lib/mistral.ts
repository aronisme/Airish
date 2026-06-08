export async function queryMistral(systemPrompt: string, history: any[], userMessage: string) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
        throw new Error("MISTRAL_API_KEY tidak ditemukan di environment variables!");
    }

    // Ubah history dari format Supabase ke format standard Mistral/OpenAI
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.content
        })),
        { role: 'user', content: userMessage }
    ];

    const tools = [
        {
            type: "function",
            function: {
                name: "generate_selfie",
                description: "Picu alat ini saat pengguna meminta foto selfie atau gambar diri bot. Mode 'mirror' digunakan jika pengguna meminta outfit/pakaian (di cermin), mode 'direct' jika pengguna meminta foto close-up atau di lokasi tertentu secara langsung.",
                parameters: {
                    type: "object",
                    properties: {
                        context: { 
                            type: "string", 
                            description: "Deskripsi pose, pakaian, atau lokasi tempat bot berfoto (misal: 'sedang di kamar tidur memakai hoodie', 'tersenyum di kedai kopi')" 
                        },
                        mode: { 
                            type: "string", 
                            enum: ["mirror", "direct"],
                            description: "Gunakan 'mirror' jika ada cermin/pakaian yang ingin dipamerkan, gunakan 'direct' jika foto langsung menghadap kamera."
                        }
                    },
                    required: ["context", "mode"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "save_memory",
                description: "Simpan fakta penting tentang pengguna agar bot mengingatnya di masa mendatang (seperti nama, pekerjaan, hobi, dll).",
                parameters: {
                    type: "object",
                    properties: {
                        fact: { 
                            type: "string", 
                            description: "Fakta penting tentang pengguna (misal: 'User bernama Budi', 'User suka bermain piano')" 
                        },
                        event_date: { 
                            type: "string", 
                            description: "Tanggal kejadian jika ada dalam format YYYY-MM-DD" 
                        }
                    },
                    required: ["fact"]
                }
            }
        }
    ];

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "mistral-large-latest", // Model unggulan Mistral tercanggih
            messages,
            tools,
            tool_choice: "auto"
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Mistral API Error: ${response.status} - ${errText}`);
    }

    return response.json();
}
