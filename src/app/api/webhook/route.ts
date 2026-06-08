import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { geminiModel } from '@/lib/gemini';
import { generateSelfie } from '@/lib/fal';
import { after } from 'next/server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const DEFAULT_REF_IMAGE = "https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png";

// Helper untuk mengirim request ke Telegram menggunakan native FETCH
// Ini jauh lebih aman dari error TLS socket reset dibanding memakai library Telegraf di serverless
async function sendTelegram(method: string, payload: any) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errText = await response.text();
            console.error(`Telegram API Error (${method}):`, errText);
        }
        return response.json();
    } catch (error) {
        console.error(`Fetch error to Telegram (${method}):`, error);
        return null;
    }
}

async function processMessage(body: any) {
    if (!body.message || !body.message.text) return;
    
    const chatId = body.message.chat.id;
    const text = body.message.text;
    const userId = body.message.from.id;

    try {
        // Kirim status typing
        await sendTelegram('sendChatAction', { chat_id: chatId, action: 'typing' });

        // 1. Registrasi & Ambil Persona dari Supabase
        await supabase.from('users').upsert({ telegram_id: userId }, { onConflict: 'telegram_id' });
        
        let { data: persona } = await supabase.from('personas').select('*').eq('telegram_id', userId).single();
        
        let systemPrompt = "Kamu adalah Airish, AI companion yang ramah. Jawablah dengan bahasa Indonesia santai (menggunakan lo/gue atau aku/kamu yang natural).";
        let refImage = DEFAULT_REF_IMAGE;

        if (persona) {
            systemPrompt = `Namamu adalah ${persona.name}. Sifatmu: ${persona.archetype}. Kerjaanmu: ${persona.craft}. 
Backstory: ${persona.backstory}. Lingkungan: ${persona.world_context}. 
Jawablah dengan bahasa Indonesia santai sesuai dengan sifatmu.`;
            if (persona.reference_image_url) refImage = persona.reference_image_url;
        }

        // 2. Ambil Chat History
        const { data: history } = await supabase.from('chat_history')
            .select('*')
            .eq('telegram_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);
            
        const formattedHistory = (history || []).reverse().map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content }]
        }));

        // Simpan pesan user saat ini
        await supabase.from('chat_history').insert({ telegram_id: userId, role: 'user', content: text });

        // 3. Panggil Gemini
        const chat = geminiModel.startChat({
            history: formattedHistory,
            systemInstruction: systemPrompt
        });

        const result = await chat.sendMessage(text);
        const response = result.response;
        const functionCalls = response.functionCalls();

        // 4. Handle Tools
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            
            if (call.name === 'generate_selfie') {
                await sendTelegram('sendMessage', { chat_id: chatId, text: "Bentar ya, aku fotokan dulu... 📸" });
                await sendTelegram('sendChatAction', { chat_id: chatId, action: 'upload_photo' });

                // @ts-ignore
                const context = call.args.context;
                // @ts-ignore
                const mode = call.args.mode;

                const prompt = mode === 'direct' 
                    ? `a close-up selfie taken by herself at ${context}, direct eye contact with the camera, looking straight into the lens, eyes centered and clearly visible, not a mirror selfie, phone held at arm's length, face fully visible`
                    : `make a pic of this person, but ${context}. the person is taking a mirror selfie`;

                const imageUrl = await generateSelfie(refImage, prompt);

                if (imageUrl) {
                    await sendTelegram('sendPhoto', { chat_id: chatId, photo: imageUrl });
                    await supabase.from('chat_history').insert({ telegram_id: userId, role: 'assistant', content: "[Mengirim foto selfie]" });
                } else {
                    await sendTelegram('sendMessage', { chat_id: chatId, text: "Aduh, kamera aku lagi error nih. Nanti aja ya fotonya." });
                }
            } 
            else if (call.name === 'save_memory') {
                // @ts-ignore
                const fact = call.args.fact;
                // @ts-ignore
                const date = call.args.event_date;

                await supabase.from('memories').insert({ telegram_id: userId, fact: fact, event_date: date || null });
                
                const followupResult = await chat.sendMessage([{functionResponse: { name: 'save_memory', response: { success: true } }}]);
                const replyText = followupResult.response.text();
                
                await sendTelegram('sendMessage', { chat_id: chatId, text: replyText });
                await supabase.from('chat_history').insert({ telegram_id: userId, role: 'assistant', content: replyText });
            }
        } else {
            const replyText = response.text();
            await sendTelegram('sendMessage', { chat_id: chatId, text: replyText });
            await supabase.from('chat_history').insert({ telegram_id: userId, role: 'assistant', content: replyText });
        }

    } catch (error) {
        console.error("Error processing message:", error);
    }
}

export async function POST(req: Request) {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');

    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        
        after(() => {
            processMessage(body);
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
