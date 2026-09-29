import type { StoredImage } from "@/types";

export interface TurnaroundHistoryItem {
  id: string;
  createdAt: string;
  modelId: string;
  image?: Blob;
  prompt?: string;
  text: string;
  notes: string;
  references: StoredImage[];
  products: StoredImage[];
  background?: StoredImage;
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("fashion-turnaround-images", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction("images", mode);
      const request = action(transaction.objectStore("images"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Không lưu được lịch sử."));
    });
  } finally { db.close(); }
}

export const saveTurnaround = (item: TurnaroundHistoryItem) => run("readwrite", (store) => store.put(item));
export const deleteTurnaround = (id: string) => run("readwrite", (store) => store.delete(id));
export async function getTurnarounds(): Promise<TurnaroundHistoryItem[]> {
  const items = await run<TurnaroundHistoryItem[]>("readonly", (store) => store.getAll());
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
