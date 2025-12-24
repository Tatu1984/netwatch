import { create } from "zustand";

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  isRead: boolean;
  computerId: string;
  computer: {
    id: string;
    name: string;
    hostname: string;
  };
  metadata: string | null;
  createdAt: string;
}

interface AlertsState {
  alerts: Alert[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  filters: {
    type: string;
    severity: string;
    isRead: string;
  };
  setAlerts: (alerts: Alert[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: Partial<AlertsState["filters"]>) => void;
  fetchAlerts: () => Promise<void>;
  markAsRead: (alertIds: string[]) => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;
}

export const useAlertsStore = create<AlertsState>((set, get) => ({
  alerts: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  filters: {
    type: "all",
    severity: "all",
    isRead: "all",
  },

  setAlerts: (alerts) => {
    const unreadCount = alerts.filter((a) => !a.isRead).length;
    set({ alerts, unreadCount });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  fetchAlerts: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filters } = get();
      const params = new URLSearchParams();
      if (filters.type !== "all") params.set("type", filters.type);
      if (filters.severity !== "all") params.set("severity", filters.severity);
      if (filters.isRead !== "all") params.set("isRead", filters.isRead);

      const res = await fetch(`/api/alerts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch alerts");
      const data = await res.json();
      const unreadCount = data.filter((a: Alert) => !a.isRead).length;
      set({ alerts: data, unreadCount, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  markAsRead: async (alertIds) => {
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertIds, isRead: true }),
      });
      if (!res.ok) throw new Error("Failed to mark alerts as read");

      set((state) => ({
        alerts: state.alerts.map((a) =>
          alertIds.includes(a.id) ? { ...a, isRead: true } : a
        ),
        unreadCount: state.unreadCount - alertIds.length,
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteAlert: async (id) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete alert");

      set((state) => {
        const alert = state.alerts.find((a) => a.id === id);
        return {
          alerts: state.alerts.filter((a) => a.id !== id),
          unreadCount: alert && !alert.isRead ? state.unreadCount - 1 : state.unreadCount,
        };
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
}));
