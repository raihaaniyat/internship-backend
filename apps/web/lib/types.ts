export type Role = "admin" | "user";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role | null;
  emailVerified: boolean;
}

export interface Part {
  id: string;
  name: string;
  partNumber: string;
  description: string | null;
  price: number;
  category: string | null;
  inStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  userId: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  createdAt: string;
}

export interface SavedPart {
  bookmarkId: string;
  savedAt: string;
  part: Part;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: { timestamp?: string };
}

export interface ApiFailure {
  error: string;
  message: string;
  fields?: Record<string, string>;
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; message: string; fields?: Record<string, string> };
