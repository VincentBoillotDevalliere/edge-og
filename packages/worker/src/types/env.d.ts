export {};

declare global {
  interface Env {
    STRIPE_WEBHOOK_SECRET?: string;
    STRIPE_SECRET_KEY?: string;
  }
}
