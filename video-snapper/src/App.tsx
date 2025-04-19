// src/App.tsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { saveAs } from "file-saver";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, Loader2 } from "lucide-react";

// 簡易錯誤記錄器
const logError = (error: Error, context: Record<string, unknown> = {}) => {
  console.error("[VideoSnapper Error]", {
    message: error.message,
    stack: error.stack,
    context,
  });
};

// Error Boundary
class ErrorBoundary extends React.Component<
  React.PropsWithChildren<object>,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: object) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError(error, { phase: "render", info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 p-8 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-red-600">
            😵 發生未預期的錯誤
          </h2>
          <p className="mt-2 text-red-500">
            {this.state.error?.message || "請重新整理頁面或稍後再試。"}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const supportedFormats = ["image/png", "image/jpeg", "image/webp"];

function AppContent() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [format, setFormat] = useState<string>(supportedFormats[0]);
  const [isCaptured, setIsCaptured] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Global error
  useEffect(() => {
    const handleGlobalError = (e: ErrorEvent) =>
      logError(e.error || new Error(e.message), { source: "global" });
    const handleRejection = (e: PromiseRejectionEvent) =>
      logError(e.reason, { source: "unhandled" });
    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isVideoLoaded) return;
    setIsCapturing(true);
    setErrorMessage(null);
    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("無法取得繪圖上下文");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `snapshot.${format.split("/")[1]}`);
          setIsCaptured(true);
        } else {
          throw new Error("Blob 轉換失敗");
        }
        setIsCapturing(false);
      }, format);
    } catch (err: unknown) {
      if (err instanceof Error) {
        logError(err, { phase: "capture", format, time: video.currentTime });
        setErrorMessage(err.message || "擷取失敗");
      } else {
        logError(new Error("Unknown error"), {
          phase: "capture",
          format,
          time: video.currentTime,
        });
        setErrorMessage("擷取失敗");
      }
      setIsCapturing(false);
    }
  }, [format, isVideoLoaded]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      if (e.code === "Space") {
        e.preventDefault();
        void (videoRef.current.paused
          ? videoRef.current.play()
          : videoRef.current.pause());
      }
      if (e.key.toLowerCase() === "c") handleCapture();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleCapture]);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoURL(URL.createObjectURL(file));
    setIsCaptured(false);
    setIsVideoLoaded(false);
    setErrorMessage(null);
  };

  return (
    <div className="w-screen h-full flex items-center justify-center px-4 sm:px-0">
      <div className="w-full max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 flex items-center gap-3">
            <span role="img" aria-label="clapperboard">
              🎬
            </span>{" "}
            幀影擷取工具
          </h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label="說明">
                <HelpCircle/>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>使用說明</DialogTitle>
                <DialogDescription>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>上傳影片</li>
                    <li>播放並選擇時間點</li>
                    <li>點擊「擷取」或按鍵 C 進行截圖</li>
                    <li>自動下載圖片</li>
                  </ol>
                </DialogDescription>
              </DialogHeader>
              <DialogClose>關閉</DialogClose>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="block w-full text-gray-700 file:border-0 file:bg-gray-200 file:px-4 file:py-2 file:rounded-lg file:cursor-pointer hover:file:bg-gray-300"
          />
          <AnimatePresence>
            {errorMessage && (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-red-500 font-medium"
              >
                ❌ {errorMessage}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {videoURL && (
          <video
            ref={videoRef}
            src={videoURL}
            controls
            className="w-full rounded-lg overflow-hidden shadow-inner"
            onLoadedMetadata={() => setIsVideoLoaded(true)}
            onError={() => setErrorMessage("影片載入失敗")}
          />
        )}

        {videoURL && (
          <div className="flex flex-col sm:flex-row items-center w-full gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger className="w-full sm:w-36">
                      <SelectValue placeholder="選擇格式" />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedFormats.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f.replace("image/", "").toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent>選擇輸出格式</TooltipContent>
            </Tooltip>

            <Button
              onClick={handleCapture}
              disabled={!isVideoLoaded || isCapturing}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isCapturing ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                "擷取截圖"
              )}
            </Button>

            <AnimatePresence>
              {isCapturing ? (
                <motion.p
                  key="processing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="text-gray-500"
                >
                  處理中…
                </motion.p>
              ) : isCaptured ? (
                <motion.p
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="text-green-600 font-semibold"
                >
                  ✅ 擷取成功！
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      <footer className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-gray-500 text-sm">
        <p>
          © 2023{" "}
          <a
            href="https://github.com/natsuki221/video-snapper"
            className="text-blue-500 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            natsuki221
          </a>
          . All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
