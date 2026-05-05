import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUploadSample } from "./useManuscripts";
import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from "@marketplace/contracts";

type Props = {
  manuscriptId: string;
  hasExistingDocument: boolean;
};

export function UploadControl({ manuscriptId, hasExistingDocument }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);
  const uploadMutation = useUploadSample(manuscriptId);
  const isUploading = uploadMutation.isPending;

  function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return t("manuscripts.upload.errorSize");
    }
    if (
      !ALLOWED_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_MIME_TYPES)[number],
      )
    ) {
      return t("manuscripts.upload.errorType");
    }
    return null;
  }

  async function handleFile(file: File) {
    if (isUploading) {
      return;
    }

    setLocalError(null);
    setSuccessMsg(false);
    const validationError = validateFile(file);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    try {
      await uploadMutation.mutateAsync(file);
      setSuccessMsg(true);
    } catch {
      setLocalError(t("manuscripts.upload.errorGeneric"));
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (isUploading) {
      return;
    }
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (isUploading) {
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    // Reset so the same file can be re-selected if needed
    e.target.value = "";
  }

  return (
    <div className="space-y-3">
      {/* Dropzone */}
      <div
        id="upload-dropzone"
        role="button"
        tabIndex={0}
        aria-label={t("manuscripts.upload.dropzone")}
        onClick={() => !isUploading && inputRef.current?.click()}
        onDrop={(e) => void handleDrop(e)}
        onDragOver={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!isUploading) {
              inputRef.current?.click();
            }
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition ${
          isUploading
            ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
            : "border-slate-300 bg-white hover:border-slate-500 hover:bg-slate-50"
        }`}
      >
        {isUploading ? (
          <p className="text-sm text-slate-500">
            {t("manuscripts.upload.uploading")}
          </p>
        ) : (
          <>
            <p className="text-center text-sm text-slate-600">
              {t("manuscripts.upload.dropzone")}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {t("manuscripts.upload.maxSize")}
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.epub,.txt"
        className="sr-only"
        id="upload-file-input"
        aria-hidden="true"
        disabled={isUploading}
        onChange={handleInputChange}
      />

      {/* Trigger button */}
      <button
        type="button"
        id="upload-trigger-btn"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {hasExistingDocument
          ? t("manuscripts.detail.replaceCta")
          : t("manuscripts.detail.uploadCta")}
      </button>

      {/* Error */}
      {localError && (
        <p id="upload-error-msg" className="text-sm text-red-600">
          {localError}
        </p>
      )}

      {/* Success */}
      {successMsg && (
        <p id="upload-success-msg" className="text-sm text-green-700">
          {t("manuscripts.upload.success")}
        </p>
      )}
    </div>
  );
}
