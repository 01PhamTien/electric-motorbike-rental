export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface Station {
  id: number;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  phone?: string | null;
}

export interface Vehicle {
  id: number;
  code: string;
  licensePlate: string;
  dailyRate: string;
  depositAmount: string;
  status: 'ACTIVE' | 'CHARGING' | 'MAINTENANCE' | 'INACTIVE';
  station: Station;
  model: { id: number; brand: string; name: string };
}
