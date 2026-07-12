import type { Project } from "./types.ts";

export interface Store {
  listProjects(): Promise<
    { id: string; name: string; cardCount: number; updatedAt: number }[]
  >;
  loadProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  requestPersistence(): Promise<boolean>;
}

const DB_NAME = "argboard";
const STORE_NAME = "projects";

/** Test/diagnostics: how many times `requestPersistence` was invoked. */
let persistenceRequestCount = 0;

export function getPersistenceRequestCount(): number {
  return persistenceRequestCount;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export const store: Store = {
  async listProjects() {
    const projects = await transact<Project[]>(
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
      "readonly",
      (objectStore) => objectStore.get(id),
    )) ?? null;
  },
  async saveProject(project) {
    await transact<IDBValidKey>(
      "readwrite",
      (objectStore) => objectStore.put(project),
    );
  },
  async deleteProject(id) {
    await transact<undefined>(
      "readwrite",
      (objectStore) => objectStore.delete(id),
    );
  },
  async requestPersistence() {
    persistenceRequestCount += 1;
    return await navigator.storage?.persist?.() ?? false;
  },
};
