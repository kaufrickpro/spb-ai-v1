import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiRoutes } from "@marketplace/contracts";
import { webApiClient } from "../api/client";
import type {
  CreateManuscriptRequest,
  UpdateManuscriptRequest,
  AllowedMimeType,
} from "@marketplace/contracts";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const manuscriptKeys = {
  all: ["manuscripts"] as const,
  list: () => [...manuscriptKeys.all, "list"] as const,
  detail: (id: string) => [...manuscriptKeys.all, "detail", id] as const,
  document: (id: string) => ["documents", id] as const,
};

// ─── List manuscripts ─────────────────────────────────────────────────────────

export function useManuscripts(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: manuscriptKeys.list(),
    queryFn: () => webApiClient.request(ApiRoutes.manuscripts.list),
    enabled: options.enabled ?? true,
  });
}

// ─── Get manuscript ───────────────────────────────────────────────────────────

export function useManuscript(id: string) {
  return useQuery({
    queryKey: manuscriptKeys.detail(id),
    queryFn: () =>
      webApiClient.request(ApiRoutes.manuscripts.get, {
        params: { id },
      }),
    enabled: Boolean(id),
  });
}

// ─── Create manuscript ────────────────────────────────────────────────────────

export function useCreateManuscript() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateManuscriptRequest) =>
      webApiClient.request(ApiRoutes.manuscripts.create, { body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manuscriptKeys.list() });
    },
  });
}

// ─── Update manuscript ────────────────────────────────────────────────────────

export function useUpdateManuscript(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateManuscriptRequest) =>
      webApiClient.request(ApiRoutes.manuscripts.update, {
        params: { id },
        body,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(manuscriptKeys.detail(id), data);
      void queryClient.invalidateQueries({ queryKey: manuscriptKeys.list() });
    },
  });
}

// ─── Upload flow ──────────────────────────────────────────────────────────────

export function useUploadSample(manuscriptId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      // Step 1: request a signed URL
      const { uploadId, documentId, uploadUrl } = await webApiClient.request(
        ApiRoutes.uploads.requestSignedUrl,
        {
          body: {
            manuscriptId,
            fileName: file.name,
            mimeType: file.type as AllowedMimeType,
            fileSizeBytes: file.size,
          },
        },
      );

      // Step 2: PUT the file to the signed URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload to signed URL failed");
      }

      // Step 3: tell the API the upload is done
      const complete = await webApiClient.request(
        ApiRoutes.documents.completeUpload,
        { params: { id: documentId } },
      );

      return { uploadId, documentId, document: complete.document };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: manuscriptKeys.detail(manuscriptId),
      });
    },
  });
}

// ─── Download flow ───────────────────────────────────────────────────────────

export function useDownloadDocument() {
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { downloadUrl } = await webApiClient.request(
        ApiRoutes.documents.downloadUrl,
        { params: { id: documentId } },
      );
      window.location.assign(downloadUrl);
      return downloadUrl;
    },
  });
}

// ─── Document ─────────────────────────────────────────────────────────────────

export function useDocument(documentId: string | null) {
  return useQuery({
    queryKey: manuscriptKeys.document(documentId ?? ""),
    queryFn: () =>
      webApiClient.request(ApiRoutes.documents.get, {
        params: { id: documentId! },
      }),
    enabled: Boolean(documentId),
    refetchInterval: (query) => {
      const status = query.state.data?.document.processingStatus;
      return status === "queued" || status === "processing" ? 3000 : false;
    },
  });
}
