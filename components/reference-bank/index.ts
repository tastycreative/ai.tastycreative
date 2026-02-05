// Main components
export { ReferenceBankContent } from "./ReferenceBankContent";
export { ReferenceSelector } from "./ReferenceSelector";

// Sub-components
export { Sidebar } from "./Sidebar";
export { SmartSearch } from "./SmartSearch";
export { BulkActionsBar } from "./BulkActionsBar";
export { VirtualizedGrid, VirtualizedList } from "./VirtualizedViews";
export { PreviewModal } from "./PreviewModal";
export { UploadQueue } from "./UploadQueue";
export { EmptyState } from "./EmptyState";

// Modals
export * from "./modals";

// Store and API
export { useReferenceBankStore } from "@/lib/reference-bank/store";
export { referenceBankAPI, type ReferenceItem, type ReferenceFolder } from "@/lib/reference-bank/api";
