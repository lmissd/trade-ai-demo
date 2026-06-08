import path from "node:path";

export const workspaceRoot = path.resolve(__dirname, "../../../../");
export const uploadsRoot = path.join(workspaceRoot, "uploads");
export const documentsUploadDir = path.join(uploadsRoot, "documents");
export const qrCodesUploadDir = path.join(uploadsRoot, "qr-codes");
export const runtimeConfigRoot = path.join(workspaceRoot, ".runtime");
export const aiAssistantRuntimeConfigPath = path.join(runtimeConfigRoot, "ai-assistant.config.json");
