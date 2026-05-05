export type HealthPayload = {
  status: "ok";
  service: "api";
};

export function buildHealthPayload(): HealthPayload {
  return {
    status: "ok",
    service: "api",
  };
}
