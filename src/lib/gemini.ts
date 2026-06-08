import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// Deklarasi Tools (Function Calling) yang membuat LLM jadi cerdas
const tools: any = [
  {
    functionDeclarations: [
      {
        name: "generate_selfie",
        description: "Gunakan tool ini JIKA pengguna secara eksplisit atau implisit meminta foto/pap dari dirimu. Ekstrak konteks pakaian/lokasi, dan pilih mode yang tepat.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            context: {
              type: SchemaType.STRING,
              description: "Konteks visual. Contoh: 'memakai topi koboi', 'berada di sebuah cafe yang nyaman'",
            },
            mode: {
              type: SchemaType.STRING,
              description: "Pilih 'mirror' (jika konteks fokus ke pakaian/seluruh tubuh) atau 'direct' (jika konteks fokus ke wajah/lokasi/aktivitas).",
              enum: ["mirror", "direct"]
            }
          },
          required: ["context", "mode"],
        },
      },
      {
        name: "save_memory",
        description: "Gunakan tool ini JIKA pengguna memberitahukan fakta penting tentang dirinya (ulang tahun, ujian, hobi, janji, alergi).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            fact: {
              type: SchemaType.STRING,
              description: "Fakta penting yang harus diingat. Contoh: 'Besok ujian matematika', 'User suka minum kopi tanpa gula'",
            },
            event_date: {
              type: SchemaType.STRING,
              description: "Tanggal kejadian (Opsional). Contoh format: YYYY-MM-DD",
            }
          },
          required: ["fact"],
        },
      }
    ],
  }
];

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash", // Menggunakan versi flash karena sangat cepat untuk API
  tools: tools
});
