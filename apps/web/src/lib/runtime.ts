export const isCustomerDemo = import.meta.env.VITE_CUSTOMER_MODE === "1";
export const customerAiProvider = import.meta.env.VITE_CUSTOMER_AI_PROVIDER ?? "deepseek";
export const customerAiModel = import.meta.env.VITE_CUSTOMER_AI_MODEL ?? "deepseek-v4-flash";
export const customerAiBaseUrl = import.meta.env.VITE_CUSTOMER_AI_BASE_URL ?? "https://api.deepseek.com";
