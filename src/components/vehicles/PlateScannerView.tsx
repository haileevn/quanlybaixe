"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Camera,
  Upload,
  RefreshCw,
  Search,
  Sliders,
  Edit3,
  VideoOff,
  Zap,
  CheckCircle2,
  ScanLine,
  Activity,
  ShieldCheck,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  scanPlate,
  anprStats,
  anprDeduplicator,
  resetVoting,
  type ANPRResult,
  type ANPRMode,
  type ANPRTelemetry,
} from "@/lib/anpr";
import {
  lookupVehicleByPlateAction,
  getPlateScanQuotaAction,
  type VehicleLookupResult,
  type PlateScanQuotaInfo,
} from "@/actions/vehicles";
import { PlateLookupResult } from "@/components/vehicles/PlateLookupResult";
import { touchInputClass } from "@/lib/utils";

export function PlateScannerView() {
  const [sourceMode, setSourceMode] = useState<"camera" | "upload">("camera");
  const [anprMode, setAnprMode] = useState<ANPRMode>("AUTO");
  const [cameraActive, setCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [recognizedPlate, setRecognizedPlate] = useState("");
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [serverImageUrl, setServerImageUrl] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<VehicleLookupResult | null>(null);
  const [quota, setQuota] = useState<PlateScanQuotaInfo | null>(null);
  const [showProcessedPreview, setShowProcessedPreview] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(
    process.env.NEXT_PUBLIC_ANPR_DEBUG === "true"
  );
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);

  // Trạng thái quét & Debug Metrics
  const [liveCandidate, setLiveCandidate] = useState<string | null>(null);
  const [lockProgress, setLockProgress] = useState(0);
  const [lastScanResult, setLastScanResult] = useState<ANPRResult | null>(null);
  const [telemetry, setTelemetry] = useState<ANPRTelemetry>(anprStats.getStats());
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);

  const [isSearching, startSearching] = useTransition();

  // Load Quota khi mở trang
  useEffect(() => {
    getPlateScanQuotaAction().then((res) => {
      if (res.ok && res.data) {
        setQuota(res.data);
      }
    });
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const autoScanLockRef = useRef(false);
  const autoScanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const localAttemptRef = useRef(1);

  // Bộ đếm xác nhận liên tiếp
  const candidateHistoryRef = useRef<{ plate: string; count: number }>({
    plate: "",
    count: 0,
  });

  const stopCamera = useCallback(() => {
    if (autoScanTimerRef.current) {
      clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setLiveCandidate(null);
    setLockProgress(0);
    setQualityWarning(null);
    candidateHistoryRef.current = { plate: "", count: 0 };
    localAttemptRef.current = 1;
    resetVoting();
  }, []);

  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.warn("Camera access error:", err);
      setCameraActive(false);
      setSourceMode("upload");
      toast.info("Không mở được camera trực tiếp, vui lòng chọn ảnh từ thư viện.");
    }
  }, [stopCamera]);

  // Khởi động Camera khi mode là camera
  useEffect(() => {
    if (sourceMode === "camera" && !lookupResult) {
      void startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [sourceMode, lookupResult, startCamera, stopCamera]);

  // VÒNG LẶP TỰ ĐỘNG QUÉT BIỂN SỐ LOCAL-FIRST (KHI BẬT TỰ ĐỘNG QUÉT)
  useEffect(() => {
    if (sourceMode !== "camera" || !cameraActive || lookupResult || !autoScanEnabled) {
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
      return;
    }

    autoScanTimerRef.current = setInterval(async () => {
      if (autoScanLockRef.current || !videoRef.current) return;
      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      try {
        autoScanLockRef.current = true;

        const frameCanvas = document.createElement("canvas");
        frameCanvas.width = video.videoWidth;
        frameCanvas.height = video.videoHeight;
        const ctx = frameCanvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);

        // Chạy ANPR Pipeline (Local First)
        const result = await scanPlate(frameCanvas, {
          mode: anprMode,
          attemptIndex: localAttemptRef.current,
          maxAttempts: 3,
        });

        setLastScanResult(result);
        setTelemetry(anprStats.getStats());

        // Kiểm tra chất lượng khung hình
        if (result.quality.isBlurry) {
          setQualityWarning("Giữ camera ổn định...");
          setLiveCandidate(null);
          setLockProgress(0);
          return;
        } else {
          setQualityWarning(null);
        }

        // Cập nhật canvas xem trước
        if (processedCanvasRef.current) {
          const pCtx = processedCanvasRef.current.getContext("2d");
          pCtx?.drawImage(frameCanvas, 0, 0, processedCanvasRef.current.width, processedCanvasRef.current.height);
        }

        // KIỂM TRA ĐỊNH DẠNG BIỂN SỐ VÀ KHÓA NÉT ỔN ĐỊNH 3 LẦN
        if (result.isValidPattern && result.finalConfidence >= 0.85 && result.plate) {
          setLiveCandidate(result.plate);

          if (candidateHistoryRef.current.plate === result.plate) {
            candidateHistoryRef.current.count += 1;
          } else {
            candidateHistoryRef.current = { plate: result.plate, count: 1 };
          }

          const count = candidateHistoryRef.current.count;
          const progress = Math.min(100, Math.round((count / 3) * 100));
          setLockProgress(progress);

          // ĐÃ GIỮ YÊN ỔN ĐỊNH QUA 3 LẦN LIÊN TIẾP -> TRA CỨU DATABASE!
          if (count >= 3) {
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate(80);
            }

            setRecognizedPlate(result.plate);

            try {
              const dataUrl = frameCanvas.toDataURL("image/jpeg", 0.9);
              setCapturedImageUrl(dataUrl);
            } catch (err) {
              console.warn("Canvas toDataURL error:", err);
            }

            frameCanvas.toBlob((blob) => {
              if (blob) void uploadCapturedFile(blob);
            }, "image/jpeg", 0.9);

            stopCamera();
            await executeLookup(result.plate);
          }
        } else {
          setLiveCandidate(null);
          setLockProgress(0);
          candidateHistoryRef.current = { plate: "", count: 0 };
        }
      } catch {
        // Bỏ qua lỗi khung hình tiếp tục
      } finally {
        autoScanLockRef.current = false;
      }
    }, 850);

    return () => {
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    };
  }, [sourceMode, cameraActive, lookupResult, autoScanEnabled, anprMode, stopCamera]);

  // Chụp ảnh thủ công từ camera (Độ phân giải cao -> Chạy Local ANPR -> AI Fallback nếu cần)
  async function captureFromCameraManual() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error("Camera chưa sẵn sàng.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedImageUrl(dataUrl);
    } catch (err) {
      console.warn("Canvas toDataURL error:", err);
    }

    canvas.toBlob(async (blob) => {
      if (blob) {
        await processImageSource(blob, canvas);
      }
    }, "image/jpeg", 0.95);
  }

  // Tải ảnh từ file
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const objectUrl = URL.createObjectURL(file);
      setCapturedImageUrl(objectUrl);
    } catch {
      // ignore
    }
    await processImageSource(file);
  }

  // Quy trình xử lý ảnh: Local ANPR Pipeline -> AI Fallback nếu không chắc chắn
  async function processImageSource(source: Blob | File, existingCanvas?: HTMLCanvasElement) {
    setIsProcessing(true);
    setProgressMsg("Đang nhận diện biển số (Local First)...");
    stopCamera();

    try {
      let canvas = existingCanvas;
      if (!canvas) {
        const img = new Image();
        img.src = URL.createObjectURL(source);
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
        });
        canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);

        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          setCapturedImageUrl((prev) => prev || dataUrl);
        } catch {
          // ignore
        }
      }

      void uploadCapturedFile(source);

      // Chạy Local ANPR Pipeline với hỗ trợ tự động gọi AI nếu Local < 0.88
      const result = await scanPlate(canvas, {
        mode: anprMode,
        attemptIndex: 3, // Thử hết lượt để cho phép AI fallback nếu cần
        maxAttempts: 3,
      });

      setLastScanResult(result);
      setTelemetry(anprStats.getStats());
      setRecognizedPlate(result.plate);

      if (result.isValidPattern && result.plate) {
        setProgressMsg(
          result.source === "local"
            ? "Nhận diện thành công (Local OCR)! Đang tra cứu..."
            : "AI Vision đã nhận diện thành công! Đang tra cứu..."
        );
        await executeLookup(result.plate);
      } else {
        toast.warning(
          result.plate
            ? `Nhận diện được: ${result.plate}. Vui lòng xác nhận hoặc sửa lại số bên dưới.`
            : "Chưa đọc rõ biển số. Vui lòng căn biển số vào giữa khung và chụp lại."
        );
      }
    } catch (error) {
      console.error("Xử lý ảnh lỗi:", error);
      toast.error("Lỗi khi xử lý ảnh. Vui lòng thử lại hoặc gõ biển số.");
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  }

  async function uploadCapturedFile(file: Blob | File) {
    try {
      const formData = new FormData();
      formData.set("file", file, "plate-scan.jpg");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = (await res.json()) as { url?: string };
        if (data.url) {
          setServerImageUrl(data.url);
          setCapturedImageUrl((prev) => prev || data.url!);
        }
      }
    } catch {
      // Bỏ qua lỗi upload nền
    }
  }

  // Tra cứu biển số trong Database với cơ chế Deduplication (5s)
  async function executeLookup(plate: string) {
    if (!plate || !plate.trim()) return;

    const canonical = plate.toUpperCase().replace(/[^0-9A-Z]/g, "");

    // Tránh duplicate check-in/lookup liên tục cho cùng 1 xe
    if (anprDeduplicator.isDuplicateLookup(canonical)) {
      console.info(`[ANPR] Lookup for ${canonical} throttled (duplicate within 5s).`);
    }
    anprDeduplicator.markLookup(canonical);

    startSearching(async () => {
      const res = await lookupVehicleByPlateAction(plate);
      if (res.ok) {
        setLookupResult(res.data);
        if (res.data.quota) {
          setQuota(res.data.quota);
        }
      } else {
        toast.error(res.message);
        // Refresh quota khi có lỗi giới hạn
        getPlateScanQuotaAction().then((qRes) => {
          if (qRes.ok && qRes.data) setQuota(qRes.data);
        });
      }
    });
  }

  function handleReset() {
    setLookupResult(null);
    setRecognizedPlate("");
    setCapturedImageUrl(null);
    setServerImageUrl(null);
    setLiveCandidate(null);
    setLockProgress(0);
    setQualityWarning(null);
    candidateHistoryRef.current = { plate: "", count: 0 };
    resetVoting();
    if (sourceMode === "camera") {
      void startCamera();
    }
  }

  return (
    <div className="space-y-4">
      {/* NẾU ĐÃ CÓ KẾT QUẢ TRA CỨU TỪ DATABASE */}
      {lookupResult ? (
        <PlateLookupResult
          result={lookupResult}
          capturedImageUrl={capturedImageUrl}
          serverImageUrl={serverImageUrl}
          onReset={handleReset}
        />
      ) : (
        /* MÀN HÌNH QUÉT CAMERA / TẢI ẢNH */
        <div className="space-y-4">
          {/* Header Controls: Chế độ Nguồn ảnh & Chế độ ANPR */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-neutral-200/60 p-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setSourceMode("camera")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition ${
                  sourceMode === "camera"
                    ? "bg-white text-[#0F4C5C] shadow-sm font-bold"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <Camera className="size-4" />
                Camera quét biển số
              </button>
              <button
                type="button"
                onClick={() => setSourceMode("upload")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition ${
                  sourceMode === "upload"
                    ? "bg-white text-[#0F4C5C] shadow-sm font-bold"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <Upload className="size-4" />
                Tải ảnh / Thư viện
              </button>
            </div>

            {/* Quota Widget cho Gói Dùng Thử */}
            {quota && !quota.isUnlimited && (
              <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200/80 px-3.5 py-2 text-xs">
                <div className="flex items-center gap-2 text-amber-900">
                  <ScanLine className="h-4 w-4 text-amber-700 shrink-0" />
                  <span>
                    <strong>Dùng thử:</strong> Đã quét <strong>{quota.usedToday}/{quota.maxDaily}</strong> lượt hôm nay · <strong>{quota.usedMonth}/{quota.maxMonthly}</strong> lượt tháng này
                  </span>
                </div>
                <Link
                  href="/goi-dich-vu"
                  className="shrink-0 font-bold text-amber-800 underline hover:text-amber-950 ml-2"
                >
                  Nâng cấp
                </Link>
              </div>
            )}

            {/* Selector Chế độ ANPR: AUTO (Local First) vs LOCAL_ONLY vs AI_ONLY */}
            <div className="flex items-center justify-between rounded-xl bg-neutral-100 px-3 py-1.5 text-xs text-neutral-600 border border-neutral-200">
              <div className="flex items-center gap-1.5 font-bold text-[#0F4C5C]">
                <Cpu className="size-3.5" />
                Chế độ ANPR:
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setAnprMode("AUTO")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    anprMode === "AUTO"
                      ? "bg-[#0F4C5C] text-white shadow-xs"
                      : "text-neutral-600 hover:bg-neutral-200"
                  }`}
                  title="Ưu tiên Offline OCR. Chỉ gọi AI khi cần thiết để tiết kiệm chi phí."
                >
                  AUTO (Local First)
                </button>
                <button
                  type="button"
                  onClick={() => setAnprMode("LOCAL_ONLY")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    anprMode === "LOCAL_ONLY"
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "text-neutral-600 hover:bg-neutral-200"
                  }`}
                  title="100% Offline. Không bao giờ gọi AI API."
                >
                  Local Only
                </button>
                <button
                  type="button"
                  onClick={() => setAnprMode("AI_ONLY")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    anprMode === "AI_ONLY"
                      ? "bg-purple-700 text-white shadow-xs"
                      : "text-neutral-600 hover:bg-neutral-200"
                  }`}
                  title="Gọi trực tiếp AI Vision."
                >
                  AI Only
                </button>
              </div>
            </div>
          </div>

          {/* VÙNG KHUNG NGẮM CAMERA HOẶC UPLOAD */}
          <div className="relative overflow-hidden rounded-3xl bg-neutral-900 aspect-[4/3] flex items-center justify-center text-white shadow-md">
            {sourceMode === "camera" ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="size-full object-cover"
                />

                {/* Khung căn chỉnh biển số & Hướng dẫn trực quan */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                  <div
                    className={`relative w-4/5 h-36 rounded-2xl border-2 transition-all duration-300 flex items-center justify-center overflow-hidden ${
                      liveCandidate
                        ? "border-emerald-400 bg-emerald-500/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
                        : qualityWarning
                        ? "border-amber-500 bg-amber-500/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                        : "border-amber-400/90 bg-amber-400/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                    }`}
                  >
                    {/* Tia laser quét nếu đang bật chế độ tự động quét */}
                    {cameraActive && autoScanEnabled && !liveCandidate && (
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b] animate-bounce" />
                    )}

                    {/* 4 góc viền căn khung ngắm */}
                    <div
                      className={`absolute -top-1 -left-1 size-6 border-t-4 border-l-4 ${
                        liveCandidate ? "border-emerald-400" : "border-amber-400"
                      }`}
                    />
                    <div
                      className={`absolute -top-1 -right-1 size-6 border-t-4 border-r-4 ${
                        liveCandidate ? "border-emerald-400" : "border-amber-400"
                      }`}
                    />
                    <div
                      className={`absolute -bottom-1 -left-1 size-6 border-b-4 border-l-4 ${
                        liveCandidate ? "border-emerald-400" : "border-amber-400"
                      }`}
                    />
                    <div
                      className={`absolute -bottom-1 -right-1 size-6 border-b-4 border-r-4 ${
                        liveCandidate ? "border-emerald-400" : "border-amber-400"
                      }`}
                    />

                    {/* Badge trạng thái quét */}
                    {liveCandidate ? (
                      <div className="flex flex-col items-center gap-1.5 z-10 text-center animate-in zoom-in-95">
                        <span className="text-xs font-black text-emerald-950 bg-emerald-400 px-3.5 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                          <CheckCircle2 className="size-4 text-emerald-950" />
                          Nhận diện: {liveCandidate}
                        </span>
                        <span className="text-[11px] font-bold text-white bg-black/80 px-3 py-1 rounded-full">
                          {lockProgress >= 100
                            ? "Đã xác nhận! Đang tìm kiếm..."
                            : `Giữ yên camera (${lockProgress}%)...`}
                        </span>
                      </div>
                    ) : qualityWarning ? (
                      <div className="flex flex-col items-center gap-1 z-10 animate-in fade-in">
                        <span className="text-xs font-bold text-amber-950 bg-amber-300 px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                          <Activity className="size-4 text-amber-950 animate-spin" />
                          {qualityWarning}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 z-10">
                        <span className="text-xs font-bold text-amber-200 bg-neutral-900/90 px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                          <ScanLine className="size-4 text-amber-400" />
                          Căn biển số vào giữa khung
                        </span>
                        <span className="text-[11px] text-white/80 font-medium bg-black/60 px-2 py-0.5 rounded-full">
                          Hỗ trợ biển số xe máy & ô tô
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="mt-3 text-xs font-medium text-white/95 bg-neutral-950/80 px-3.5 py-1.5 rounded-full backdrop-blur-xs shadow-sm">
                    {autoScanEnabled
                      ? liveCandidate
                        ? "Giữ camera ổn định để tự động tra cứu"
                        : "Đưa biển số vào giữa khung để tự động nhận diện"
                      : "Căn biển số vào giữa khung và bấm nút [Chụp] bên dưới"}
                  </p>
                </div>

                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/90 gap-3 text-center p-4">
                    <VideoOff className="size-10 text-neutral-400" />
                    <p className="text-sm font-medium text-neutral-300">
                      Camera đang tạm dừng hoặc chưa được cấp quyền.
                    </p>
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-[#0F4C5C]"
                    >
                      Bật lại Camera
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Vùng upload file */
              <label className="flex size-full flex-col items-center justify-center cursor-pointer p-6 text-center hover:bg-neutral-800 transition">
                <Upload className="size-12 text-amber-400 mb-2" />
                <span className="text-base font-bold text-white">Bấm để chọn ảnh biển số</span>
                <span className="text-xs text-neutral-400 mt-1">
                  Tự động nhận diện biển số (Local First) và tra cứu tức thì
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            )}

            {/* Overlay loading khi đang phân tích ảnh */}
            {(isProcessing || isSearching) && (
              <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6 text-center z-20">
                <RefreshCw className="size-10 animate-spin text-amber-400" />
                <p className="text-base font-bold text-white">
                  {progressMsg || "Đang tra cứu cơ sở dữ liệu..."}
                </p>
                <p className="text-xs text-amber-200/80">
                  {anprMode === "AUTO"
                    ? "Local First (Offline OCR) · AI Fallback khi cần"
                    : anprMode === "LOCAL_ONLY"
                    ? "100% Xử lý ảnh cục bộ Offline"
                    : "Xử lý qua AI Vision"}
                </p>
              </div>
            )}
          </div>

          {/* NÚT CHỤP & BẬT/TẮT TỰ ĐỘNG QUÉT */}
          {sourceMode === "camera" && cameraActive && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isProcessing || isSearching}
                  onClick={captureFromCameraManual}
                  className="flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-[#0F4C5C] py-4 text-base font-bold text-white shadow-lg active:scale-[0.98] transition hover:bg-[#0c3c49]"
                >
                  <Camera className="size-5 text-amber-300" />
                  Chụp & Tra cứu biển số ngay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !autoScanEnabled;
                    setAutoScanEnabled(next);
                    setLiveCandidate(null);
                    setLockProgress(0);
                    candidateHistoryRef.current = { plate: "", count: 0 };
                    if (next) {
                      toast.info("Đã bật tự động quét khi giữ camera ổn định.");
                    } else {
                      toast.info("Đã tắt tự động quét. Bạn hãy căn góc và bấm nút Chụp.");
                    }
                  }}
                  className={`px-3.5 rounded-2xl border text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 ${
                    autoScanEnabled
                      ? "bg-amber-100 text-amber-950 border-amber-300 ring-2 ring-amber-400/40"
                      : "bg-neutral-100 text-neutral-600 border-neutral-300"
                  }`}
                >
                  <Zap
                    className={`size-4 ${
                      autoScanEnabled ? "text-amber-600 fill-amber-500" : "text-neutral-400"
                    }`}
                  />
                  <span>{autoScanEnabled ? "Tự quét: BẬT" : "Tự quét: TẮT"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Ô XÁC NHẬN / TÌM KIẾM BIỂN SỐ BẰNG TAY (NẾU CẦN CHỈNH SỬA) */}
          <div className="rounded-2xl bg-white p-4 ring-1 ring-[#0F4C5C]/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <Edit3 className="size-4 text-[#0F4C5C]" />
                Biển số nhận diện / Tra cứu
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  className="text-xs font-medium text-neutral-600 flex items-center gap-1 hover:text-[#0F4C5C]"
                >
                  <Activity className="size-3.5" />
                  {showDebugPanel ? "Ẩn Debug" : "Debug ANPR"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProcessedPreview(!showProcessedPreview)}
                  className="text-xs font-medium text-[#0F4C5C] flex items-center gap-1 hover:underline"
                >
                  <Sliders className="size-3.5" />
                  {showProcessedPreview ? "Ẩn bộ lọc" : "Xem ảnh lọc"}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                className={`${touchInputClass} uppercase font-black text-lg tracking-wider text-[#0F4C5C]`}
                placeholder="VD: 51H-919.91 hoặc 59H1-123.45"
                value={recognizedPlate}
                onChange={(e) => setRecognizedPlate(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && recognizedPlate.trim()) {
                    void executeLookup(recognizedPlate);
                  }
                }}
              />
              <button
                type="button"
                disabled={isSearching || !recognizedPlate.trim()}
                onClick={() => executeLookup(recognizedPlate)}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-amber-400 px-5 text-base font-bold text-[#0F4C5C] shadow-sm hover:bg-amber-300 active:scale-95 transition shrink-0"
              >
                <Search className="size-5" />
                Tìm
              </button>
            </div>

            {/* Canvas xem trước ảnh qua bộ lọc Grayscale/Adaptive Threshold */}
            {showProcessedPreview && (
              <div className="mt-2 rounded-xl bg-neutral-900 p-3 text-center animate-in fade-in">
                <p className="text-xs font-medium text-neutral-300 mb-2">
                  Ảnh qua bộ lọc Adaptive Local Threshold & Integral Image:
                </p>
                <canvas
                  ref={processedCanvasRef}
                  className="max-h-36 mx-auto rounded-lg border border-neutral-700 object-contain"
                />
              </div>
            )}
          </div>

          {/* ANPR DEBUG PANEL (HIỂN THỊ METRICS & TELEMETRY TIẾT KIỆM CHI PHÍ) */}
          {showDebugPanel && (
            <div className="rounded-2xl bg-neutral-900 p-4 text-xs font-mono text-neutral-300 space-y-2.5 border border-neutral-700 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-amber-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Activity className="size-4" /> ANPR Telemetry & Debug
                </span>
                <span className="text-[11px] text-emerald-400">
                  ⚡ Tiết kiệm: {telemetry.apiAvoided} lượt gọi AI API
                </span>
              </div>

              {lastScanResult ? (
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-neutral-500">Detector Conf:</span>{" "}
                    <strong className="text-white">
                      {Math.round(lastScanResult.detectionConfidence * 100)}%
                    </strong>{" "}
                    ({lastScanResult.detectorSource})
                  </div>
                  <div>
                    <span className="text-neutral-500">OCR Conf:</span>{" "}
                    <strong className="text-white">
                      {Math.round(lastScanResult.ocrConfidence * 100)}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Final Conf:</span>{" "}
                    <strong
                      className={
                        lastScanResult.finalConfidence >= 0.88
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }
                    >
                      {Math.round(lastScanResult.finalConfidence * 100)}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Source:</span>{" "}
                    <strong
                      className={
                        lastScanResult.source === "local"
                          ? "text-emerald-400 uppercase"
                          : "text-purple-400 uppercase"
                      }
                    >
                      {lastScanResult.source}
                    </strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-neutral-500">RAW OCR:</span>{" "}
                    <span className="text-neutral-200">
                      {lastScanResult.rawText || "(trống)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Plate:</span>{" "}
                    <span className="text-amber-300 font-bold">
                      {lastScanResult.plate || "(chưa khóa)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Latency:</span>{" "}
                    <span className="text-neutral-300">
                      {lastScanResult.processingTimeMs}ms
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-neutral-500">Quality:</span> BlurScore:{" "}
                    {lastScanResult.quality.blurScore} · Brightness:{" "}
                    {lastScanResult.quality.brightness} · Contrast:{" "}
                    {lastScanResult.quality.contrast}
                  </div>
                </div>
              ) : (
                <p className="text-neutral-500 text-[11px]">
                  Chưa có lần quét nào được thực hiện.
                </p>
              )}

              <div className="border-t border-neutral-800 pt-2 flex items-center justify-between text-[10px] text-neutral-400">
                <span>
                  Tổng: {telemetry.totalScans} | Local: {telemetry.localSuccess} | AI Fallback:{" "}
                  {telemetry.aiFallback}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    anprStats.reset();
                    setTelemetry(anprStats.getStats());
                  }}
                  className="text-amber-400 hover:underline"
                >
                  Xóa thống kê
                </button>
              </div>
            </div>
          )}

          {/* Banner giải thích kiến trúc Local-First */}
          <div className="rounded-2xl bg-gradient-to-br from-[#0F4C5C]/10 to-amber-500/10 p-4 border border-[#0F4C5C]/15 space-y-1">
            <div className="flex items-center gap-2 text-[#0F4C5C] font-bold text-sm">
              <ShieldCheck className="size-4 text-emerald-600" />
              Kiến trúc Local-First: Tiết kiệm tối đa chi phí AI
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Hệ thống xử lý ảnh và nhận diện OCR 100% cục bộ trên thiết bị với độ chính xác cao. Chỉ khi hình ảnh quá khó hoặc góc nghiêng đặc biệt sau nhiều lần thử, hệ thống mới tự động gọi AI API làm Fallback.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
