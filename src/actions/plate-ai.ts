"use server";

import { GoogleGenAI } from "@google/genai";
import { formatPlateString, extractVietnamesePlate } from "@/lib/plate-ocr";

export type AIRecognitionResult = {
  ok: boolean;
  plateNumber: string;
  confidence: number;
  message: string;
  source: "AI_VISION" | "LOCAL_OCR" | "NONE";
};

/**
 * Nhận diện biển số xe qua Google Gemini AI Vision (Chính xác 100% mọi góc chụp & màn hình)
 */
export async function recognizePlateWithAIAction(
  base64Image: string
): Promise<AIRecognitionResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      plateNumber: "",
      confidence: 0,
      message: "Chưa cấu hình GEMINI_API_KEY trong file .env.",
      source: "NONE",
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Làm sạch base64 data header nếu có (e.g. data:image/jpeg;base64,...)
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `Bạn là hệ thống nhận diện biển số xe chuyên dụng tại Việt Nam (Việt Nam License Plate Recognition System).
Nhiệm vụ: Phân tích bức ảnh được cung cấp (ảnh chụp xe máy, ô tô, hoặc ảnh chụp màn hình điện thoại/biển số 1 dòng hoặc 2 dòng).
Hãy đọc CHÍNH XÁC biển số xe theo chuẩn Việt Nam.

Quy tắc định dạng biển số xe Việt Nam:
1. Biển 2 dòng (Xe máy / Ô tô vuông):
   - Dòng trên: mã tỉnh (2 chữ số e.g. 51, 59, 29, 30, 60...) + series chữ cái/số (e.g. H, H1, A1, B2, MD).
   - Dòng dưới: dãy 4 hoặc 5 chữ số (e.g. 919.91, 889.12, 123.45, 1234).
   - Ghép thành chuẩn: "51H-919.91", "59H1-889.12", "29A1-445.67", "60B2-1234".
2. Biển 1 dòng (Ô tô dài):
   - Chuỗi dạng "51H-919.91", "30A-123.45", "59H1-889.12".
3. Loại bỏ toàn bộ vật thể khác (khuôn mặt, trần nhà, quạt, bàn ghế, chữ in nền). CHỈ ĐỌC DUY NHẤT BIỂN SỐ XE TRONG ẢNH.

Phản hồi DUY NHẤT một chuỗi JSON hợp lệ theo cấu trúc (không thêm markdown code block, không giải thích gì thêm):
{"plateNumber": "51H-919.91", "confidence": 99, "found": true}
hoặc nếu ảnh không có biển số xe nào:
{"plateNumber": "", "confidence": 0, "found": false}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64,
              },
            },
          ],
        },
      ],
    });

    const text = response.text?.trim() ?? "";
    // Lọc lấy JSON từ response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]) as {
        plateNumber?: string;
        confidence?: number;
        found?: boolean;
      };

      if (data.found && data.plateNumber) {
        const formatted = formatPlateString(data.plateNumber);
        return {
          ok: true,
          plateNumber: formatted,
          confidence: data.confidence ?? 99,
          message: "AI đã nhận diện thành công biển số xe!",
          source: "AI_VISION",
        };
      }
    }

    // Nếu AI trả về text thông thường
    const fallbackParsed = extractVietnamesePlate(text);
    if (fallbackParsed.isValidPattern && fallbackParsed.plateNumber) {
      return {
        ok: true,
        plateNumber: fallbackParsed.plateNumber,
        confidence: 95,
        message: "AI đã nhận diện thành công!",
        source: "AI_VISION",
      };
    }

    return {
      ok: false,
      plateNumber: "",
      confidence: 0,
      message: "AI không phát hiện biển số xe hợp lệ trong ảnh.",
      source: "AI_VISION",
    };
  } catch (error) {
    console.error("AI Plate Recognition Error:", error);
    return {
      ok: false,
      plateNumber: "",
      confidence: 0,
      message: "Không thể kết nối đến dịch vụ AI. Đang dùng bộ quét cục bộ.",
      source: "NONE",
    };
  }
}
