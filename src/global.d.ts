declare global {
    interface Window {
      __TAURI__?: boolean;
    }
  }
  export {};