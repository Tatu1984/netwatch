import { create } from "zustand";

interface Computer {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string | null;
  osType: string;
  status: string;
  lastSeen: string | null;
  groupId: string | null;
  group: {
    id: string;
    name: string;
    color: string;
  } | null;
  _count?: {
    activityLogs: number;
    screenshots: number;
    alerts: number;
  };
}

interface ComputerGroup {
  id: string;
  name: string;
  color: string;
  _count?: {
    computers: number;
  };
}

interface ComputersState {
  computers: Computer[];
  groups: ComputerGroup[];
  selectedComputer: Computer | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    groupId: string;
    status: string;
    search: string;
  };
  setComputers: (computers: Computer[]) => void;
  setGroups: (groups: ComputerGroup[]) => void;
  setSelectedComputer: (computer: Computer | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: Partial<ComputersState["filters"]>) => void;
  fetchComputers: () => Promise<void>;
  fetchGroups: () => Promise<void>;
  addComputer: (computer: Computer) => void;
  updateComputer: (id: string, updates: Partial<Computer>) => void;
  removeComputer: (id: string) => void;
}

export const useComputersStore = create<ComputersState>((set, get) => ({
  computers: [],
  groups: [],
  selectedComputer: null,
  isLoading: false,
  error: null,
  filters: {
    groupId: "all",
    status: "all",
    search: "",
  },

  setComputers: (computers) => set({ computers }),
  setGroups: (groups) => set({ groups }),
  setSelectedComputer: (computer) => set({ selectedComputer: computer }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  fetchComputers: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filters } = get();
      const params = new URLSearchParams();
      if (filters.groupId !== "all") params.set("groupId", filters.groupId);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.search) params.set("search", filters.search);

      const res = await fetch(`/api/computers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch computers");
      const data = await res.json();
      set({ computers: data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchGroups: async () => {
    try {
      const res = await fetch("/api/groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      const data = await res.json();
      set({ groups: data });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  addComputer: (computer) =>
    set((state) => ({ computers: [...state.computers, computer] })),

  updateComputer: (id, updates) =>
    set((state) => ({
      computers: state.computers.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  removeComputer: (id) =>
    set((state) => ({
      computers: state.computers.filter((c) => c.id !== id),
    })),
}));
