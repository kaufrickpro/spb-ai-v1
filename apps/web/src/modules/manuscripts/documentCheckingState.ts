import type {
  Document,
  DocumentProcessingFailureCode,
} from "@marketplace/contracts";

type DocumentCheckingInput = Pick<
  Document,
  "processingFailureCode" | "processingStatus"
>;

type DocumentCheckingTone = "checking" | "ready" | "unreadable";

export type DocumentCheckingState = {
  badgeClassName: string;
  descriptionKey: string;
  failureMessageKey?: string;
  kind: DocumentCheckingTone;
  panelClassName: string;
  titleKey: string;
};

const failureMessageByCode: Record<DocumentProcessingFailureCode, string> = {
  empty_extracted_text: "manuscripts.documentCheck.failure.empty",
  unsupported_file_type: "manuscripts.documentCheck.failure.unsupportedType",
  file_type_mismatch: "manuscripts.documentCheck.failure.mismatch",
  extracted_text_too_large: "manuscripts.documentCheck.failure.tooLarge",
  chunk_limit_exceeded: "manuscripts.documentCheck.failure.tooLarge",
  download_failed: "manuscripts.documentCheck.failure.unreadable",
  parser_failed: "manuscripts.documentCheck.failure.unreadable",
  embedding_failed: "manuscripts.documentCheck.failure.temporary",
  scanner_suspicious: "manuscripts.documentCheck.failure.safety",
  scanner_failed: "manuscripts.documentCheck.failure.temporary",
  unexpected_processing_error: "manuscripts.documentCheck.failure.temporary",
};

const checkingState: DocumentCheckingState = {
  badgeClassName: "bg-blue-100 text-blue-700",
  descriptionKey: "manuscripts.documentCheck.description.checking",
  kind: "checking",
  panelClassName: "border-blue-100 bg-blue-50 text-blue-900",
  titleKey: "manuscripts.documentCheck.title.checking",
};

const readyState: DocumentCheckingState = {
  badgeClassName: "bg-green-100 text-green-700",
  descriptionKey: "manuscripts.documentCheck.description.ready",
  kind: "ready",
  panelClassName: "border-green-100 bg-green-50 text-green-900",
  titleKey: "manuscripts.documentCheck.title.ready",
};

export function getDocumentCheckingState(
  document: DocumentCheckingInput,
): DocumentCheckingState {
  if (document.processingStatus === "succeeded") {
    return readyState;
  }

  if (document.processingStatus === "failed") {
    return {
      badgeClassName: "bg-red-100 text-red-700",
      descriptionKey: "manuscripts.documentCheck.description.unreadable",
      failureMessageKey: document.processingFailureCode
        ? failureMessageByCode[document.processingFailureCode]
        : "manuscripts.documentCheck.failure.generic",
      kind: "unreadable",
      panelClassName: "border-red-100 bg-red-50 text-red-900",
      titleKey: "manuscripts.documentCheck.title.unreadable",
    };
  }

  return checkingState;
}
