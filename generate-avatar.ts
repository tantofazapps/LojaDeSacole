import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  try {
    console.log("Generating image...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: 'A friendly, welcoming portrait avatar of a smiling older Black woman with dark hair tied back, wearing stylish sunglasses and a black high-neck shirt. The background is a vibrant, cheerful theme of "sacolés" (Brazilian popsicles/ice pops in plastic tubes) with bright orange, pink, and yellow colors, and cute subtle popsicle patterns. High quality, perfect for a small business store profile picture, centered, well-lit, beautiful digital illustration style.',
          },
        ],
      },
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const publicDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir);
        }
        fs.writeFileSync(path.join(publicDir, 'avatar-dineia.png'), Buffer.from(part.inlineData.data, 'base64'));
        console.log('SUCCESS: Image saved to public/avatar-dineia.png');
        return;
      }
    }
    console.log("No image data found in response.");
  } catch (e) {
    console.error("Error generating image:", e);
  }
}

main();
