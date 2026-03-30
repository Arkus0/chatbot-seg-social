import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";

import { assertRagEnv, getEnv } from "../config/env.js";
import { getEmbeddings } from "./embeddings.js";

let pineconeClient: Pinecone | undefined;
let vectorStorePromise: Promise<PineconeStore> | undefined;

export function getPineconeClient(): Pinecone {
  if (pineconeClient) {
    return pineconeClient;
  }

  const env = getEnv();
  assertRagEnv(env);

  pineconeClient = new Pinecone({
    apiKey: env.PINECONE_API_KEY!,
  });

  return pineconeClient;
}

export async function getVectorStore(): Promise<PineconeStore> {
  if (vectorStorePromise) {
    return vectorStorePromise;
  }

  const env = getEnv();
  assertRagEnv(env);

  vectorStorePromise = PineconeStore.fromExistingIndex(getEmbeddings(), {
    pineconeIndex: getPineconeClient().index(env.PINECONE_INDEX_NAME!),
    namespace: env.PINECONE_NAMESPACE,
  });

  return vectorStorePromise;
}
