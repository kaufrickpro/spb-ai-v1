import {
  ApiRoutes,
  createApiClient,
  type ApiClientFetch,
  type HealthResponse,
} from "@marketplace/contracts";
import { getWebConfig } from "../modules/config/config";

export function getWebHealthMessage(): string {
  return "Publisher-Author Marketplace Web";
}

export async function fetchApiHealth(
  fetcher?: ApiClientFetch,
): Promise<HealthResponse> {
  const client = createApiClient({
    baseUrl: getWebConfig().apiBaseUrl,
    fetcher,
  });

  return client.request(ApiRoutes.health.get);
}
