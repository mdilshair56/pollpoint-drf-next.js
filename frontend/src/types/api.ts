export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ApiErrorPayload {
  success?: false;
  message?: string;
  errors?: unknown;
  status_code?: number;
  detail?: string;
  [key: string]: unknown;
}

export interface PaginationMeta {
  count: number;
  next: string | null;
  previous: string | null;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedApiResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: PaginationMeta;
}
