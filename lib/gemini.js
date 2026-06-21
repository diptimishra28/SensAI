import { GoogleGenerativeAI } from "@google/generative-ai";

// gemini-1.5-flash was retired; gemini-2.5-flash-lite is the current free-tier replacement
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
