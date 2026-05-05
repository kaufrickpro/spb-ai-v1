import { z } from "zod";
import { ApiErrorSchema } from "./common.js";
import { ApiRoutes, type ApiRoute } from "./routes.js";

export type OpenApiSchema = {
  type?: string;
  format?: string;
  enum?: unknown[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  items?: OpenApiSchema;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  additionalProperties?: boolean | OpenApiSchema;
  nullable?: boolean;
  default?: unknown;
};

export type OpenApiDocument = {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, Record<string, unknown>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: {
      ApiError: OpenApiSchema;
    };
  };
};

type RouteEntry = {
  name: string;
  contract: ApiRoute;
};

const isZodType = (value: unknown): value is z.ZodTypeAny =>
  value instanceof z.ZodType;

const unwrapSchema = (
  schema: z.ZodTypeAny,
): {
  schema: z.ZodTypeAny;
  optional: boolean;
  nullable: boolean;
  defaultValue?: unknown;
} => {
  if (schema instanceof z.ZodOptional) {
    const unwrapped = unwrapSchema(schema.unwrap());
    return { ...unwrapped, optional: true };
  }

  if (schema instanceof z.ZodNullable) {
    const unwrapped = unwrapSchema(schema.unwrap());
    return { ...unwrapped, nullable: true };
  }

  if (schema instanceof z.ZodDefault) {
    const unwrapped = unwrapSchema(schema.removeDefault());
    return {
      ...unwrapped,
      optional: true,
      defaultValue: schema._def.defaultValue(),
    };
  }

  return { schema, optional: false, nullable: false };
};

const applyStringChecks = (
  schema: z.ZodString,
  openApiSchema: OpenApiSchema,
) => {
  for (const check of schema._def.checks) {
    if (check.kind === "min") {
      openApiSchema.minLength = check.value;
    }

    if (check.kind === "max") {
      openApiSchema.maxLength = check.value;
    }

    if (check.kind === "length") {
      openApiSchema.minLength = check.value;
      openApiSchema.maxLength = check.value;
    }

    if (check.kind === "uuid") {
      openApiSchema.format = "uuid";
    }

    if (check.kind === "datetime") {
      openApiSchema.format = "date-time";
    }

    if (check.kind === "url") {
      openApiSchema.format = "uri";
    }
  }
};

const applyNumberChecks = (
  schema: z.ZodNumber,
  openApiSchema: OpenApiSchema,
) => {
  for (const check of schema._def.checks) {
    if (check.kind === "int") {
      openApiSchema.type = "integer";
    }

    if (check.kind === "min") {
      openApiSchema.minimum = check.value;
    }

    if (check.kind === "max") {
      openApiSchema.maximum = check.value;
    }
  }
};

export const zodToOpenApiSchema = (
  sourceSchema: z.ZodTypeAny,
): OpenApiSchema => {
  const { schema, nullable, defaultValue } = unwrapSchema(sourceSchema);

  if (schema instanceof z.ZodString) {
    const openApiSchema: OpenApiSchema = { type: "string" };
    applyStringChecks(schema, openApiSchema);

    return {
      ...openApiSchema,
      ...(nullable ? { nullable } : {}),
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    };
  }

  if (schema instanceof z.ZodNumber) {
    const openApiSchema: OpenApiSchema = { type: "number" };
    applyNumberChecks(schema, openApiSchema);

    return {
      ...openApiSchema,
      ...(nullable ? { nullable } : {}),
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    };
  }

  if (schema instanceof z.ZodBoolean) {
    return {
      type: "boolean",
      ...(nullable ? { nullable } : {}),
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    };
  }

  if (schema instanceof z.ZodLiteral) {
    const value = schema._def.value;

    return {
      type: typeof value,
      const: value,
      ...(nullable ? { nullable } : {}),
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: schema.options,
      ...(nullable ? { nullable } : {}),
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    };
  }

  if (schema instanceof z.ZodArray) {
    const openApiSchema: OpenApiSchema = {
      type: "array",
      items: zodToOpenApiSchema(schema.element),
    };

    if (schema._def.minLength) {
      openApiSchema.minItems = schema._def.minLength.value;
    }

    if (schema._def.maxLength) {
      openApiSchema.maxItems = schema._def.maxLength.value;
    }

    return {
      ...openApiSchema,
      ...(nullable ? { nullable } : {}),
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    };
  }

  if (schema instanceof z.ZodRecord) {
    return {
      type: "object",
      additionalProperties: zodToOpenApiSchema(schema._def.valueType),
      ...(nullable ? { nullable } : {}),
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    };
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, OpenApiSchema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      if (!isZodType(value)) {
        continue;
      }

      const unwrapped = unwrapSchema(value);
      properties[key] = zodToOpenApiSchema(value);

      if (!unwrapped.optional) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
      additionalProperties: schema._def.unknownKeys === "passthrough",
      ...(nullable ? { nullable } : {}),
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    };
  }

  if (schema instanceof z.ZodUnknown) {
    return {};
  }

  return {};
};

const flattenRoutes = (
  routes: Record<string, unknown>,
  prefix: string[] = [],
): RouteEntry[] =>
  Object.entries(routes).flatMap(([key, value]) => {
    if (
      value &&
      typeof value === "object" &&
      "method" in value &&
      "path" in value
    ) {
      return [
        { name: [...prefix, key].join("."), contract: value as ApiRoute },
      ];
    }

    if (value && typeof value === "object") {
      return flattenRoutes(value as Record<string, unknown>, [...prefix, key]);
    }

    return [];
  });

const toOpenApiPath = (path: string) =>
  path.replaceAll(/:([A-Za-z0-9_]+)/g, "{$1}");

const operationIdFor = (name: string) => name.replaceAll(".", "_");

const queryParametersFor = (schema: z.ZodTypeAny | undefined) => {
  if (!(schema instanceof z.ZodObject)) {
    return [];
  }

  return Object.entries(schema.shape)
    .filter(([, value]) => isZodType(value))
    .map(([name, value]) => ({
      name,
      in: "query",
      required: !unwrapSchema(value as z.ZodTypeAny).optional,
      schema: zodToOpenApiSchema(value as z.ZodTypeAny),
    }));
};

const pathParametersFor = (schema: z.ZodTypeAny | undefined) => {
  if (!(schema instanceof z.ZodObject)) {
    return [];
  }

  return Object.entries(schema.shape)
    .filter(([, value]) => isZodType(value))
    .map(([name, value]) => ({
      name,
      in: "path",
      required: true,
      schema: zodToOpenApiSchema(value as z.ZodTypeAny),
    }));
};

const securityFor = (auth: ApiRoute["auth"]) => {
  if (auth === "public") {
    return [];
  }

  if (auth === "webhook") {
    return [{ webhookSignature: [] }];
  }

  return [{ bearerAuth: [] }];
};

export const buildOpenApiDocument = (): OpenApiDocument => {
  const paths: OpenApiDocument["paths"] = {};

  for (const { name, contract } of flattenRoutes(ApiRoutes)) {
    const path = toOpenApiPath(contract.path);
    const method = contract.method.toLowerCase();
    paths[path] ??= {};
    paths[path][method] = {
      operationId: operationIdFor(name),
      tags: [name.split(".")[0]],
      security: securityFor(contract.auth),
      parameters: [
        ...pathParametersFor(contract.params),
        ...queryParametersFor(contract.query),
      ],
      ...(contract.request
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: zodToOpenApiSchema(contract.request),
                },
              },
            },
          }
        : {}),
      responses: {
        "200": {
          description: "Successful response",
          content: {
            "application/json": {
              schema: zodToOpenApiSchema(contract.response),
            },
          },
        },
        default: {
          description: "Error response",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Publisher Author Marketplace API",
      version: "0.1.0",
    },
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        webhookSignature: {
          type: "apiKey",
          in: "header",
          name: "x-webhook-signature",
        },
      },
      schemas: {
        ApiError: zodToOpenApiSchema(ApiErrorSchema),
      },
    },
  };
};
