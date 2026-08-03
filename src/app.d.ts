// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    interface Locals {
      user: {
        id: string;
        username: string;
        avatar?: string;
      } | null;
    }

    interface PageData {
      user: {
        id: string;
        username: string;
        avatar?: string;
      } | null;
    }

    // If you use cookies or session tokens later, you can extend this
    interface Platform {}
  }
}

export {};
