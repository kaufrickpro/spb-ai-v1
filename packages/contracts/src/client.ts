import { ApiErrorSchema } from "./common.js";
import type {
  ApiRoute,
  ApiRouteParams,
  ApiRouteQuery,
  ApiRouteRequest,
  ApiRouteResponse,
} from "./routes.js";

export type ApiClientFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type ApiClientFetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  },
) => Promise<ApiClientFetchResponse>;

export type ApiClientOptions = {
  baseUrl?: string;
  fetcher?: ApiClientFetch;
  getAuthToken?: () => string | undefined | Promise<string | undefined>;
};

export type ApiClientRequestOptions<Route extends ApiRoute> = {
  headers?: Record<string, string>;
} & (ApiRouteParams<Route> extends undefined
  ? { params?: never }
  : { params: ApiRouteParams<Route> }) &
  (ApiRouteQuery<Route> extends undefined
    ? { query?: never }
    : { query?: ApiRouteQuery<Route> }) &
  (ApiRouteRequest<Route> extends undefined
    ? { body?: never }
    : { body: ApiRouteRequest<Route> });

type ApiClientRequestArgs<Route extends ApiRoute> =
  ApiRouteParams<Route> extends undefined
    ? ApiRouteRequest<Route> extends undefined
      ? [requestOptions?: ApiClientRequestOptions<Route>]
      : [requestOptions: ApiClientRequestOptions<Route>]
    : [requestOptions: ApiClientRequestOptions<Route>];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const buildApiPath = (
  path: string,
  params?: Record<string, unknown>,
  query?: Record<string, unknown>,
) => {
  const withParams = Object.entries(params ?? {}).reduce(
    (currentPath, [key, value]) =>
      currentPath.replace(`:${key}`, encodeURIComponent(String(value))),
    path,
  );
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, String(item));
      }
    } else {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${withParams}?${queryString}` : withParams;
};

export const createApiClient = (options: ApiClientOptions = {}) => {
  const baseUrl = options.baseUrl?.replace(/\/$/, "") ?? "";
  const fetcher: ApiClientFetch =
    options.fetcher ??
    ((input, init) =>
      fetch(input, {
        method: init.method,
        headers: init.headers,
        body: init.body,
      }));

  return {
    async request<Route extends ApiRoute>(
      contract: Route,
      ...args: ApiClientRequestArgs<Route>
    ): Promise<ApiRouteResponse<Route>> {
      const requestOptions = (args[0] ?? {}) as ApiClientRequestOptions<Route>;
      const params = contract.params
        ? contract.params.parse(requestOptions.params)
        : undefined;
      const query = contract.query
        ? contract.query.parse(requestOptions.query ?? {})
        : undefined;
      const parsedBody = contract.request
        ? contract.request.parse(requestOptions.body)
        : undefined;
      const token = await options.getAuthToken?.();
      const headers: Record<string, string> = {
        accept: "application/json",
        ...requestOptions.headers,
      };

      if (parsedBody !== undefined) {
        headers["content-type"] = "application/json";
      }

      if (token) {
        headers.authorization = `Bearer ${token}`;
      }

      const response = await fetcher(
        `${baseUrl}${buildApiPath(
          contract.path,
          isRecord(params) ? params : undefined,
          isRecord(query) ? query : undefined,
        )}`,
        {
          method: contract.method,
          headers,
          body:
            parsedBody === undefined ? undefined : JSON.stringify(parsedBody),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw ApiErrorSchema.parse(payload);
      }

      return contract.response.parse(payload);
    },
  };
};
