import { create } from "zustand";

interface DashboardStats {
  computers: {
    total: number;
    online: number;
    offline: number;
  };
  groups: number;
  alerts: {
    total: number;
    unread: number;
  };
  today: {
    screenshots: number;
    activities: number;
  };
  policies: {
    active: number;
  };
  recentAlerts: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    createdAt: string;
    computer: {
      id: string;
      name: string;
    };
  }>;
  activityByType: Array<{
    type: string;
    count: number;
    totalDuration: number;
  }>;
}

interface DashboardState {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  setStats: (stats: DashboardStats) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchStats: () => Promise<void>;
}

const defaultStats: DashboardStats = {
  computers: { total: 0, online: 0, offline: 0 },
  groups: 0,
  alerts: { total: 0, unread: 0 },
  today: { screenshots: 0, activities: 0 },
  policies: { active: 0 },
  recentAlerts: [],
  activityByType: [],
};

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  isLoading: false,
  error: null,
  lastUpdated: null,

  setStats: (stats) => set({ stats, lastUpdated: new Date() }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) throw new Error("Failed to fetch dashboard stats");
      const data = await res.json();
      set({ stats: data, isLoading: false, lastUpdated: new Date() });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
        stats: defaultStats,
      });
    }
  },
}));
