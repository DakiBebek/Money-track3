import type { GeminiOcrResult } from '../types/state';

export let GEMINI_API_KEY = '';
try {
  GEMINI_API_KEY = localStorage.getItem('gemini_api_key') || '';
} catch {}

export function setGeminiApiKey(key: string): void {
  GEMINI_API_KEY = key.trim();
  try {
    localStorage.setItem('gemini_api_key', GEMINI_API_KEY);
  } catch {}
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function scanReceiptWithGemini(file: File): Promise<GeminiOcrResult> {
  if (!GEMINI_API_KEY) throw new Error('API Key Google Gemini belum diatur.');

  const base64Data = await fileToBase64(file);
  const cleanBase64 = base64Data.split(',')[1];
  const mimeType = file.type || 'image/jpeg';

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = `Analisis struk belanja Indonesia ini secara teliti.
Ekstrak data berikut dalam format JSON murni:
{
  "total": <angka total akhir belanja, berupa integer tanpa sen jika ,00, contoh 20000>,
  "date": <tanggal transaksi format YYYY-MM-DD, atau kosong jika tidak ada>,
  "merchant": <nama toko atau restoran>,
  "category": <pilih salah satu kategori: Makan, Transport, Belanja, Kesehatan, Tagihan, Hiburan, Lainnya>
}
PENTING:
- Bedakan antara TOTAL AKHIR / TOTAL BELANJA dengan TUNAI/CASH dan KEMBALIAN/CHANGE. Ambil TOTAL AKHIR belanja.
- Hati-hati dengan format desimal: jika tertulis "20.000,00" maka totalnya adalah 20000 (bukan 2 juta!).
Hanya kembalikan JSON murni tanpa markdown triple backticks.`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }, { inlineData: { mimeType, data: cleanBase64 } }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `HTTP ${response.status}`);
  }

  const resData = await response.json();
  const rawAnswer = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleanJson = rawAnswer.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanJson);

  return {
    total: Math.round(Number(parsed.total) || 0),
    merchant: (parsed.merchant || '').trim(),
    date: (parsed.date || '').trim(),
    category: (parsed.category || '').trim(),
  };
}
