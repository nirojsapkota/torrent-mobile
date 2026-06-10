import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  app.use(express.json());

  // Initialize Gemini API
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API 1: Search legal/public domain torrents using AI
  app.post('/api/search', async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      console.log(`[AI Search] Query received: "${query}"`);

      // Using gemini-3.5-flash as specified under standard text generation guidelines.
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Generate a list of 3 items mimicking legal, open-source or public domain downloadable torrent content for search: "${query}". Return the items in a format that looks like official tracker index metadata. Make the sizes and naming conventions realistic.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                sizeText: { type: Type.STRING },
                sizeBytes: { type: Type.INTEGER },
                seeders: { type: Type.INTEGER },
                leechers: { type: Type.INTEGER },
                files: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                category: { type: Type.STRING, description: 'e.g. Software, Movies, Music, Books' },
                description: { type: Type.STRING }
              },
              required: ['name', 'sizeText', 'sizeBytes', 'seeders', 'leechers', 'files', 'category', 'description']
            }
          }
        }
      });

      const text = response.text || '[]';
      res.json(JSON.parse(text));
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Failed to generate torrent metadata' });
    }
  });

  // API 2: Get featured suggestions for initial client setup
  app.post('/api/suggest-torrents', async (req, res) => {
    try {
      console.log('[AI Suggestions] Creating recommendations...');
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Generate 4 popular legal open-source project torrents, public domain indie films, free CC audio packs, or Linux installation ISO. Offer realistic seed counts and file details. Respond in strict JSON.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                sizeText: { type: Type.STRING },
                sizeBytes: { type: Type.INTEGER },
                seeders: { type: Type.INTEGER },
                leechers: { type: Type.INTEGER },
                files: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                category: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ['name', 'sizeText', 'sizeBytes', 'seeders', 'leechers', 'files', 'category', 'description']
            }
          }
        }
      });
      res.json(JSON.parse(response.text || '[]'));
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Failed' });
    }
  });

  // Serve static files to keep port 3000 active for SPA
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[uTorrent Backend] Active on port ${port}`);
  });
}

createServer();
