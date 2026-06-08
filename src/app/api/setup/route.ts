import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    
    // Ganti ini dengan URL Vercel Anda setelah deploy
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Pastikan user tahu secret-nya
    if (secret !== process.env.WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Secret salah" }, { status: 401 });
    }

    const webhookUrl = `${baseUrl}/api/webhook?secret=${secret}`;
    const telegramApiUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${webhookUrl}`;

    try {
        const response = await fetch(telegramApiUrl);
        const data = await response.json();
        
        return NextResponse.json({ 
            message: "Setup webhook selesai", 
            webhookUrl: webhookUrl,
            telegram_response: data 
        });
    } catch (error) {
        return NextResponse.json({ error: "Gagal memanggil API Telegram" }, { status: 500 });
    }
}
