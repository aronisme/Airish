import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { geminiModel } from '@/lib/gemini';
import { generateSelfie } from '@/lib/fal';
import { logEvent } from '@/lib/logger';
import { after } from 'next/server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const DEFAULT_REF_IMAGE = "https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png";

async function sendTelegram(method: string, payload: any) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            await logEvent('ERROR', 'Telegram API Error', `Method: ${method}, Status: ${response.status}, Res: ${JSON.stringify(data)}`);
        }
        return data;
    } catch (error: any) {
        await logEvent('ERROR', 'Telegram Fetch Exception', `Method: ${method}, Err: ${error.message}`);
        return null;
    }
}

async function processMessage(body: any) {
    if (!body.message || !body.message.text) {
        await logEvent('WARN', 'Webhook Message Ignored', 'Message body empty atau tidak berisi text.');
        return;
    }
    
    const chatId = body.message.chat.id;
    const text = body.message.text;
    const userId = body.message.from.id;

    await logEvent('INFO', 'Message Received', `Dari user ${userId}: "${text}"`, userId);

    try {
        // Kirim status typing
        await sendTelegram('sendChatAction', { chat_id: chatId, action: 'typing' });

        // 1. Registrasi & Ambil Persona
        await logEvent('INFO', 'Supabase Upsert User', `telegram_id: ${userId}`, userId);
        const { error: upsertErr } = await supabase.from('users').upsert({ telegram_id: userId }, { onConflict: 'telegram_id' });
        if (upsertErr) {
            await logEvent('ERROR', 'Supabase User Upsert Fail', upsertErr.message, userId);
            throw new Error(`Supabase Upsert Fail: ${upsertErr.message}`);
        }
        
        let { data: persona, error: personaErr } = await supabase.from('personas').select('*').eq('telegram_id', userId).single();
        if (personaErr && personaErr.code !== 'PGRST116') {
            await logEvent('WARN', 'Supabase Persona Read Warn', personaErr.message, userId);
        }
        
        let systemPrompt = "Kamu adalah Airish, AI companion yang ramah. Jawablah dengan bahasa Indonesia santai (menggunakan lo/gue atau aku/kamu yang natural).";
        let refImage = DEFAULT_REF_IMAGE;

        if (persona) {
            systemPrompt = `Namamu adalah ${persona.name}. Sifatmu: ${persona.archetype}. Kerjaanmu: ${persona.craft}. 
Backstory: ${persona.backstory}. Lingkungan: ${persona.world_context}. 
Jawablah dengan bahasa Indonesia santai sesuai dengan sifatmu.`;
            if (persona.reference_image_url) refImage = persona.reference_image_url;
            await logEvent('INFO', 'Persona Loaded', `Menggunakan Persona: ${persona.name}`, userId);
        } else {
            await logEvent('INFO', 'Default Persona Used', `User belum membuat persona, menggunakan template default.`, userId);
        }

        // 2. Ambil Chat History
        const { data: history, error: historyErr } = await supabase.from('chat_history')
            .select('*')
            .eq('telegram_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (historyErr) {
            await logEvent('WARN', 'Chat History Read Fail', historyErr.message, userId);
        }
            
        const formattedHistory = (history || []).reverse().map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content }]
        }));

        // Simpan pesan user saat ini
        await supabase.from('chat_history').insert({ telegram_id: userId, role: 'user', content: text });

        // 3. Panggil Gemini
        await logEvent('INFO', 'Gemini Request', `Mengirim history (${formattedHistory.length} pesan) ke Gemini Flash.`, userId);
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
            await logEvent('INFO', 'Gemini Tool Triggered', `Memanggil Tool: ${call.name} dengan args: ${JSON.stringify(call.args)}`, userId);
            
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

                await logEvent('INFO', 'Fal Image Start', `Prompt: "${prompt}"`, userId);
                const imageUrl = await generateSelfie(refImage, prompt);

                if (imageUrl) {
                    await logEvent('INFO', 'Fal Image Success', `Url: ${imageUrl}`, userId);
                    await sendTelegram('sendPhoto', { chat_id: chatId, photo: imageUrl });
                    await supabase.from('chat_history').insert({ telegram_id: userId, role: 'assistant', content: "[Mengirim foto selfie]" });
                } else {
                    await logEvent('ERROR', 'Fal Image Fail', 'Gagal memproses gambar melalui fal.ai', userId);
                    await sendTelegram('sendMessage', { chat_id: chatId, text: "Aduh, kamera aku lagi error nih. Nanti aja ya fotonya." });
                }
            } 
            else if (call.name === 'save_memory') {
                // @ts-ignore
                const fact = call.args.fact;
                // @ts-ignore
                const date = call.args.event_date;

                const { error: memErr } = await supabase.from('memories').insert({ telegram_id: userId, fact: fact, event_date: date || null });
                if (memErr) {
                    await logEvent('ERROR', 'Supabase Memory Save Fail', memErr.message, userId);
                } else {
                    await logEvent('INFO', 'Memory Saved', `Fakta disimpan: "${fact}"`, userId);
                }
                
                const followupResult = await chat.sendMessage([{functionResponse: { name: 'save_memory', response: { success: true } }}]);
                const replyText = followupResult.response.text();
                
                await sendTelegram('sendMessage', { chat_id: chatId, text: replyText });
                await supabase.from('chat_history').insert({ telegram_id: userId, role: 'assistant', content: replyText });
            }
        } else {
            const replyText = response.text();
            await logEvent('INFO', 'Gemini Text Reply', `Balasan teks: "${replyText}"`, userId);
            await sendTelegram('sendMessage', { chat_id: chatId, text: replyText });
            await supabase.from('chat_history').insert({ telegram_id: userId, role: 'assistant', content: replyText });
        }

    } catch (error: any) {
        await logEvent('ERROR', 'Process Message Exception', `Err: ${error.message} - Stack: ${error.stack}`, userId);
    }
}

export async function POST(req: Request) {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');

    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
        await logEvent('WARN', 'Security Alert', `Webhook dipanggil dengan secret salah: "${secret}"`);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        
        // Simpan log bahwa webhook menerima data
        await logEvent('INFO', 'Webhook Invoked', `Payload update_id: ${body.update_id}`);

        after(() => {
            processMessage(body);
        });

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        await logEvent('ERROR', 'Webhook Post Exception', `Err: ${error.message}`);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
