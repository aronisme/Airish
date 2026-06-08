import { fal } from "@fal-ai/client";

// Konfigurasi fal.ai secara otomatis mengambil dari process.env.FAL_KEY

export async function generateSelfie(imageUrl: string, prompt: string): Promise<string | null> {
  try {
    const result = await fal.subscribe("xai/grok-imagine-image/edit", {
      input: {
        image_url: imageUrl,
        prompt: prompt,
        num_images: 1,
        output_format: "jpeg"
      }
    });
    
    // @ts-ignore
    return result.data?.images?.[0]?.url || null;
  } catch (error) {
    console.error("Error fal.ai generation:", error);
    return null;
  }
}
