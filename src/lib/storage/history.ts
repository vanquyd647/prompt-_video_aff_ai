import type { PromptHistoryItem } from "@/types";

const DB_NAME = "fashion-prompt-builder";
const STORE = "history";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export const saveHistoryItem = (item: PromptHistoryItem) => run("readwrite", (store) => store.put(item));
export const deleteHistoryItem = (id: string) => run("readwrite", (store) => store.delete(id));
export const clearHistory = () => run("readwrite", (store) => store.clear());
export async function getHistory(): Promise<PromptHistoryItem[]> {
  const items = await run("readonly", (store) => store.getAll());
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
