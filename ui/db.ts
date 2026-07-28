import type { Project } from "./types.ts";

export type MediaRecord = {
  id: string;
  projectId: string;
  blob: Blob;
};

export interface Store {
  listProjects(): Promise<
    { id: string; name: string; cardCount: number; updatedAt: number }[]
  >;
  loadProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  requestPersistence(): Promise<boolean>;
  putMedia(record: MediaRecord): Promise<void>;
  getMedia(id: string): Promise<MediaRecord | null>;
  deleteMedia(id: string): Promise<void>;
  listMediaIds(projectId: string): Promise<string[]>;
  deleteMediaForProject(projectId: string): Promise<void>;
}

const DB_NAME = "argboard";
const DB_VERSION = 2;
const STORE_NAME = "projects";
const MEDIA_STORE = "media";

/** Test/diagnostics: how many times `requestPersistence` was invoked. */
let persistenceRequestCount = 0;

export function getPersistenceRequestCount(): number {
  return persistenceRequestCount;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        const media = db.createObjectStore(MEDIA_STORE, { keyPath: "id" });
        media.createIndex("projectId", "projectId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export const store: Store = {
  async listProjects() {
    const projects = await transact<Project[]>(
      STORE_NAME,
      "readonly",
      (objectStore) => objectStore.getAll(),
    );
    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      cardCount: project.cards.length,
      updatedAt: Math.max(
        project.createdAt,
        ...project.cards.map((card) => card.foundAt),
      ),
    }));
  },
  async loadProject(id) {
    return (await transact<Project | undefined>(
      STORE_NAME,
      "readonly",
      (objectStore) => objectStore.get(id),
    )) ?? null;
  },
  async saveProject(project) {
    await transact<IDBValidKey>(
      STORE_NAME,
      "readwrite",
      (objectStore) => objectStore.put(project),
    );
  },
  async deleteProject(id) {
    await store.deleteMediaForProject(id);
    await transact<undefined>(
      STORE_NAME,
      "readwrite",
      (objectStore) => objectStore.delete(id),
    );
  },
  async requestPersistence() {
    persistenceRequestCount += 1;
    return await navigator.storage?.persist?.() ?? false;
  },
  async putMedia(record) {
    await transact<IDBValidKey>(
      MEDIA_STORE,
      "readwrite",
      (objectStore) => objectStore.put(record),
    );
  },
  async getMedia(id) {
    return (await transact<MediaRecord | undefined>(
      MEDIA_STORE,
      "readonly",
      (objectStore) => objectStore.get(id),
    )) ?? null;
  },
  async deleteMedia(id) {
    await transact<undefined>(
      MEDIA_STORE,
      "readwrite",
      (objectStore) => objectStore.delete(id),
    );
  },
  async listMediaIds(projectId) {
    const database = await openDatabase();
    return await new Promise<string[]>((resolve, reject) => {
      const transaction = database.transaction(MEDIA_STORE, "readonly");
      const index = transaction.objectStore(MEDIA_STORE).index("projectId");
      const request = index.getAllKeys(IDBKeyRange.only(projectId));
      request.onsuccess = () => {
        resolve((request.result as IDBValidKey[]).map(String));
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => reject(transaction.error);
    });
  },
  async deleteMediaForProject(projectId) {
    const ids = await store.listMediaIds(projectId);
    for (const id of ids) {
      await store.deleteMedia(id);
    }
  },
};
