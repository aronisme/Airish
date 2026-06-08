import { NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';
import { supabase } from '@/lib/supabase';
import { geminiModel } from '@/lib/gemini';
import { generateSelfie } from '@/lib/fal';
import { after } from 'next/server';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const DEFAULT_REF_IMAGE = "https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png";

async function processMessage(body: any) {
    if (!body.message || !body.message.text) return;

    const chatId = body.message.chat.id;
    const text = body.message.text;
    const userId = body.message.from.id;

    try {
        await bot.telegram.sendChatAction(chatId, 'typing');

        // 1. Ambil Profil User & Persona
        // Pastikan user terdaftar di tabel users
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

        // Simpan pesan user saat ini ke database
        await supabase.from('chat_history').insert({ telegram_id: userId, role: 'user', content: text });

        // 3. Eksekusi LLM
        const chat = geminiModel.startChat({
            history: formattedHistory,
            systemInstruction: systemPrompt
        });

        const result = await chat.sendMessage(text);
        const response = result.response;
        const functionCalls = response.functionCalls();

        // 4. Handle Tools (Function Calling)
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];

            if (call.name === 'generate_selfie') {
                await bot.telegram.sendMessage(chatId, "Bentar ya, aku fotokan dulu... 📸");
                await bot.telegram.sendChatAction(chatId, 'upload_photo');

                // @ts-ignore
                const context = call.args.context;
                // @ts-ignore
                const mode = call.args.mode;

                const prompt = mode === 'direct'
                    ? `a close-up selfie taken by herself at ${context}, direct eye contact with the camera, looking straight into the lens, eyes centered and clearly visible, not a mirror selfie, phone held at arm's length, face fully visible`
                    : `make a pic of this person, but ${context}. the person is taking a mirror selfie`;

                // Panggil Fal.ai
                const imageUrl = await generateSelfie(refImage, prompt);

                if (imageUrl) {
                    await bot.telegram.sendPhoto(chatId, imageUrl);
                    await supabase.from('chat_history').insert({ telegram_id: userId, role: 'assistant', content: "[Mengirim foto selfie]" });
                } else {
                    await bot.telegram.sendMessage(chatId, "Aduh, kamera aku lagi error nih. Nanti aja ya fotonya.");
                }
            }
            else if (call.name === 'save_memory') {
                // @ts-ignore
                const fact = call.args.fact;
                // @ts-ignore
                const date = call.args.event_date;

                await supabase.from('memories').insert({ telegram_id: userId, fact: fact, event_date: date || null });

                // Minta Gemini melanjutkan percakapan setelah memori disimpan
                const followupResult = await chat.sendMessage([{ functionResponse: { name: 'save_memory', response: { success: true } } }]);
                const replyText = followupResult.response.text();

                await bot.telegram.sendMessage(chatId, replyText);
                await supabase.from('chat_history').insert({ telegram_id: userId, role: 'assistant', content: replyText });
            }
        } else {
            // Jika tidak ada tool yang dipanggil, balas teks biasa
            const replyText = response.text();
            await bot.telegram.sendMessage(chatId, replyText);
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

        // PENTING: Gunakan 'after' dari next/server
        // Ini memastikan Vercel segera mengembalikan 200 OK ke Telegram,
        // sementara proses LLM & Gambar tetap berjalan di background hingga 60 detik.
        after(() => {
            processMessage(body);
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
