import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";
import { initNativeAuthDeepLinks } from "./lib/nativeAuth";

// 네이티브 OAuth 딥링크 복귀 리스너 등록 (웹에서는 no-op)
initNativeAuthDeepLinks();

// 서비스워커는 웹(PWA)에서만 사용한다.
// 네이티브(Capacitor) WebView에서는 SW가 네비게이션을 가로채 흰 화면을
// 유발하므로 등록하지 않고, 이전에 설치된 등록이 있으면 해제한다.
if (Capacitor.isNativePlatform()) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()));
  }
} else {
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <App />
    <SpeedInsights />
  </ThemeProvider>
);
