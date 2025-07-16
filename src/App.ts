import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { Pinecone, type PineconeRecord } from "@pinecone-database/pinecone";
import { prettyJSON } from "hono/pretty-json";
import { routers } from "./routes/index";
import { serve } from "@hono/node-server";
import { GoogleGenAI } from "@google/genai";
import { readdirSync, existsSync } from "fs";
import * as fs from "fs/promises";
import * as path from "path";

interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}

export class App {
  private readonly app;
  private TRANSCRIPT_DIR: string;
  private CACHE_FILE: string;
  public pinecone: Pinecone;
  public ai: GoogleGenAI;
  public index;

  constructor(private readonly PORT: string) {
    this.app = new Hono();
    this.TRANSCRIPT_DIR = path.join(process.cwd(), "static", "transcripts");
    this.CACHE_FILE = path.join(process.cwd(), "indexed.json");
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API,
    });
    this.pinecone = new Pinecone({ apiKey: process.env.PINECONE_API! });
    this.index = this.pinecone
      .index(process.env.PINECONE_INDEX!)
      .namespace("default");
    this.middlewares();
    this.routes();
  }

  private middlewares() {
    this.app.use(prettyJSON());
    this.app.use(cors());
    this.app.use(compress());
    this.app.notFound((c) => c.text("Video Query Relevance Backend", 404));
  }

  private routes() {
    routers.forEach((router) => {
      this.app.route(router.path, router.router);
    });
  }

  async preprocessVideos() {
    const indexed = existsSync(this.CACHE_FILE)
      ? JSON.parse(await fs.readFile(this.CACHE_FILE, "utf-8"))
      : {};
    const files = readdirSync(this.TRANSCRIPT_DIR).filter((f) =>
      f.endsWith(".json")
    );
    const updated = { ...indexed };

    for (const file of files) {
      if (indexed[file]) {
        continue;
      }

      console.log("Indexing", file);

      const transcripts: TranscriptWord[] = JSON.parse(
        await fs.readFile(path.join(this.TRANSCRIPT_DIR, file), "utf-8")
      );
      const vectors: PineconeRecord[] = [];
      let i = 0;
      for (const transcript of transcripts) {
        const vector = await this.computeEmbedding(transcript.text.trim());
        vectors.push({
          id: `${file}-${i++}`,
          values: vector,
          metadata: {
            text: transcript.text,
            start: transcript.start,
            end: transcript.end,
            videoId: file.replace(/\.json$/, ""),
          },
        });
      }

      if (vectors.length) {
        await this.index.upsert(vectors);
        console.log(`Indexed ${vectors.length} chunks for ${file}`);
      }

      updated[file] = true;
      await fs.writeFile(
        this.CACHE_FILE,
        JSON.stringify(updated, null, 2),
        "utf-8"
      );
    }
    console.log("Preprocessing complete");
  }

  private async computeEmbedding(text: string): Promise<number[]> {
    const res = await this.ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
      config: {
        outputDimensionality: 1024,
      },
    });
    const embeddings = res.embeddings!;
    return embeddings[0].values!;
  }

  public listen() {
    serve({
      fetch: this.app.fetch,
      port: parseInt(this.PORT),
    });
    console.log(`Server is running on Port: ${this.PORT}`);
  }
}
