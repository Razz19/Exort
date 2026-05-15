export type ToastVariant = "info" | "warning" | "error";

export type ToastMessage = {
  id: string;
  title: string;
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
};
