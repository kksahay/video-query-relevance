import { App } from "./App";

const app = new App(process.env.PORT as string);
export const pinecone = app.pinecone;
export const index = app.index;
export const ai = app.ai;
await app.preprocessVideos();
app.listen();
