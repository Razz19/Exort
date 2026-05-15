export type ToastVariant = "info" | "success" | "warning" | "error";

export type ToastMessage = {
  id: string;
  title: string;
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
};
