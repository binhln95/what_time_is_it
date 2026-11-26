// HTTP helpers for API Gateway HTTP API (payload format 2.0).

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

// CORS headers are added by API Gateway (CorsConfiguration in template.yaml), not here.
export function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export function error(statusCode: number, code: string, message: string): APIGatewayProxyStructuredResultV2 {
  return json(statusCode, { error: code, message });
}

// Returns the parsed JSON body, or undefined when missing / invalid.
export function parseJsonBody(event: Pick<APIGatewayProxyEventV2, 'body' | 'isBase64Encoded'>): unknown {
  if (!event.body) return undefined;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export interface User {
  userId: string;
  email?: string;
}

// The JWT authorizer already verified the Cognito token; claims are trusted here.
export function getUser(event: APIGatewayProxyEventV2WithJWTAuthorizer): User {
  const claims = event.requestContext.authorizer.jwt.claims;
  return {
    userId: String(claims.sub),
    email: typeof claims.email === 'string' ? claims.email : undefined,
  };
}
