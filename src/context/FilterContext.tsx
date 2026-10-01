import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GlobalFilters {
  state_id?: string;
  state_name?: string;
  district_id?: string;
  district_name?: string;
  cluster_id?: string;
  cluster_name?: string;
  search_type?: string;
  site_id?: string;
  imei?: string;
  global_id?: string;
  site_name?: string;
  date_from?: string;
  date_to?: string;
  alarm_t?: string;
  customer_id?: string;
  operator_id?: string;
  site_status?: string;
  site_category?: string;
  site_sub_category?: string;
  customer_site_id?: string;
  technician_id?: string;
  tenant_id?: string;
  site_type?: string;
  site_on?: string;
}

interface FilterContextType {
  globalFilters: GlobalFilters;
  setGlobalFilters: (filters: GlobalFilters) => void;
  clearGlobalFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  getFilterLabel: () => string;
  isReady: boolean;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

const STORAGE_KEY = '@rms_global_filters';

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  const [globalFilters, setGlobalFiltersState] = useState<GlobalFilters>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Load persisted filters on mount
    const loadFilters = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setGlobalFiltersState(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load global filters:', error);
      } finally {
        setIsReady(true);
      }
    };
    loadFilters();
  }, []);

  const setGlobalFilters = async (filters: GlobalFilters) => {
    const cleaned: GlobalFilters = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        (cleaned as any)[k] = v;
      }
    });
    setGlobalFiltersState(cleaned);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    } catch (error) {
      console.error('Failed to save global filters:', error);
    }
  };

  const clearGlobalFilters = async () => {
    setGlobalFiltersState({});
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear global filters:', error);
    }
  };

  const labelKeys = ['state_name', 'district_name', 'cluster_name', 'customer_name', 'search_type'];
  const activeFilterCount = Object.keys(globalFilters).filter(
    k => !labelKeys.includes(k)
  ).length;

  const hasActiveFilters = activeFilterCount > 0;

  const getFilterLabel = (): string => {
    const parts: string[] = [];
    if ((globalFilters as any).customer_name) parts.push('Client: ' + (globalFilters as any).customer_name);
    if (globalFilters.state_name) parts.push(String(globalFilters.state_name));
    if (globalFilters.district_name) parts.push(String(globalFilters.district_name));
    if (globalFilters.cluster_name) parts.push(String(globalFilters.cluster_name));
    if (globalFilters.site_name) parts.push(String(globalFilters.site_name));
    if (globalFilters.imei) parts.push('IMEI: ' + globalFilters.imei);
    if ((globalFilters as any).global_id) parts.push('Global ID: ' + (globalFilters as any).global_id);
    if ((globalFilters as any).site_id) parts.push('Site ID: ' + (globalFilters as any).site_id);
    if (parts.length === 0 && hasActiveFilters) return 'Filters Active';
    return parts.join(' > ');
  };

  return (
    <FilterContext.Provider value={{
      globalFilters,
      setGlobalFilters,
      clearGlobalFilters,
      hasActiveFilters,
      activeFilterCount,
      getFilterLabel,
      isReady
    }}>
      {children}
    </FilterContext.Provider>
  );
};

export const useGlobalFilter = (): FilterContextType => {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useGlobalFilter must be used within FilterProvider');
  return ctx;
};