import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

export type ApiEvent = APIGatewayProxyEventV2WithJWTAuthorizer;
export type ApiResult = APIGatewayProxyStructuredResultV2;

/** CORS 헤더는 HTTP API 의 corsPreflight 설정이 붙인다(infra/lib/perky-stack.ts). */
export function json(statusCode: number, body?: unknown): ApiResult {
  if (body === undefined) return { statusCode };
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

/** 본문을 바이트로. HTTP API 는 본문을 base64 로 줄 때가 있다. */
export function bodyBytes(event: ApiEvent): Buffer {
  if (!event.body) return Buffer.alloc(0);
  return event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body, "utf8");
}
