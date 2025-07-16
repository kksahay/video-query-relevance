import type { Context } from "hono";
import { index, ai } from "../server";

export class SearchController {
  async search(c: Context) {
    const { query } = await c.req.json();
    const vector = await this.computeEmbedding(query);

    const result = await index.query({
      vector,
      topK: 1,
      includeMetadata: true,
    });

    const match = result.matches?.[0]?.metadata;
    if (!match) return c.json({ error: "No match found" }, 404);

    return c.json({
      videoId: match.videoId,
      startTime: match.start,
      endTime: match.end,
      text: match.text,
    });
  }

  private async computeEmbedding(text: string): Promise<number[]> {
    const res = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
      config: {
        outputDimensionality: 1024,
      },
    });
    const embeddings = res.embeddings!;
    return embeddings[0].values!;
  }
}
