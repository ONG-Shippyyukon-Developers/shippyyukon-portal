export interface HttpRequest {
  headers: Record<string, string | undefined>;
  body?: string;
  query?: Record<string, string | undefined>;
  params?: Record<string, string | undefined>;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
