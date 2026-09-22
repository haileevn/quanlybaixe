import type { InferenceSession } from "onnxruntime-web";
import type { DetectionBox } from "./types";

let ortSession: InferenceSession | null = null;
let modelLoadAttempted = false;
let modelStatus: "LOADED" | "ANPR_MODEL_NOT_FOUND" | "LOAD_ERROR" = "ANPR_MODEL_NOT_FOUND";

export interface DetectionResult {
  boxes: DetectionBox[];
  source: "onnx_yolo" | "heuristic_roi";
  modelStatus: "LOADED" | "ANPR_MODEL_NOT_FOUND" | "LOAD_ERROR";
}

/**
 * Tải mô hình YOLO ONNX (nếu đã có trong public/models/license-plate-detector.onnx)
 * Không fake model: Nếu chưa có file thì trả về ANPR_MODEL_NOT_FOUND và fallback an toàn sang Heuristic ROI.
 */
async function getOnnxSession(): Promise<InferenceSession | null> {
  if (ortSession) return ortSession;
  if (modelLoadAttempted) return null;

  modelLoadAttempted = true;

  if (typeof window === "undefined") {
    modelStatus = "ANPR_MODEL_NOT_FOUND";
    return null;
  }

  try {
    const ort = await import("onnxruntime-web");
    // Kiểm tra xem file model có tồn tại ở public/models/ hay không trước khi nạp
    const checkRes = await fetch("/models/license-plate-detector.onnx", { method: "HEAD" });
    if (!checkRes.ok) {
      console.info("[ANPR] ONNX model not found at /models/license-plate-detector.onnx (ANPR_MODEL_NOT_FOUND). Fallback to Heuristic ROI.");
      modelStatus = "ANPR_MODEL_NOT_FOUND";
      return null;
    }

    ortSession = await ort.InferenceSession.create("/models/license-plate-detector.onnx", {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    modelStatus = "LOADED";
    console.info("[ANPR] ONNX YOLO Plate Detector loaded successfully.");
    return ortSession;
  } catch (err) {
    console.warn("[ANPR] Failed to load ONNX session, falling back to heuristic:", err);
    modelStatus = "LOAD_ERROR";
    return null;
  }
}

/**
 * Phát hiện vị trí biển số xe trong khung hình:
 * 1. Nếu có mô hình ONNX YOLO: Chạy inference và trích xuất Bounding Box.
 * 2. Nếu chưa có mô hình ONNX: Tự động dùng Heuristic Viewfinder ROI (khung ngắm trung tâm) để đảm bảo hệ thống luôn hoạt động mượt mà.
 */
export async function detectPlate(sourceCanvas: HTMLCanvasElement): Promise<DetectionResult> {
  const session = await getOnnxSession();

  if (session) {
    try {
      const ort = await import("onnxruntime-web");
      const modelDim = 640;

      // Chuẩn bị canvas 640x640 cho YOLO
      const inputCanvas = document.createElement("canvas");
      inputCanvas.width = modelDim;
      inputCanvas.height = modelDim;
      const ctx = inputCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(sourceCanvas, 0, 0, modelDim, modelDim);
        const imgData = ctx.getImageData(0, 0, modelDim, modelDim);
        const { data } = imgData;

        // CHW Float32 tensor [1, 3, 640, 640]
        const floatData = new Float32Array(3 * modelDim * modelDim);
        const area = modelDim * modelDim;

        for (let i = 0; i < area; i++) {
          floatData[i] = data[i * 4] / 255.0; // R
          floatData[area + i] = data[i * 4 + 1] / 255.0; // G
          floatData[area * 2 + i] = data[i * 4 + 2] / 255.0; // B
        }

        const tensor = new ort.Tensor("float32", floatData, [1, 3, modelDim, modelDim]);
        const inputName = session.inputNames[0] || "images";
        const results = await session.run({ [inputName]: tensor });
        const outputName = session.outputNames[0] || "output0";
        const output = results[outputName];

        if (output && output.data) {
          const boxes = parseYoloOutput(output.data as Float32Array, output.dims);
          if (boxes.length > 0) {
            return {
              boxes,
              source: "onnx_yolo",
              modelStatus: "LOADED",
            };
          }
        }
      }
    } catch (inferErr) {
      console.warn("[ANPR] ONNX inference error, fallback to heuristic:", inferErr);
    }
  }

  // Heuristic ROI Fallback: Cắt vùng trung tâm 75% width, 50% height
  return {
    boxes: [
      {
        x: 0.1,
        y: 0.22,
        width: 0.8,
        height: 0.56,
        confidence: 0.9,
        label: "heuristic_viewfinder",
      },
    ],
    source: "heuristic_roi",
    modelStatus,
  };
}

/**
 * Phân tích tensor đầu ra của YOLOv8 / YOLOv11 (kích thước [1, 5, 8400] hoặc [1, 6, 8400])
 */
function parseYoloOutput(data: Float32Array, dims: readonly number[]): DetectionBox[] {
  const boxes: DetectionBox[] = [];
  if (!dims || dims.length < 3) return boxes;

  const numPredictions = dims[2]; // 8400

  for (let i = 0; i < numPredictions; i++) {
    // YOLO format: [cx, cy, w, h, score]
    const cx = data[0 * numPredictions + i] / 640;
    const cy = data[1 * numPredictions + i] / 640;
    const w = data[2 * numPredictions + i] / 640;
    const h = data[3 * numPredictions + i] / 640;
    const score = data[4 * numPredictions + i];

    if (score > 0.45 && w >= 0.1 && h >= 0.05) {
      const x = Math.max(0, cx - w / 2);
      const y = Math.max(0, cy - h / 2);
      boxes.push({
        x,
        y,
        width: Math.min(1 - x, w),
        height: Math.min(1 - y, h),
        confidence: Math.round(score * 100) / 100,
      });
    }
  }

  // Sắp xếp theo độ tin cậy cao nhất
  boxes.sort((a, b) => b.confidence - a.confidence);
  return boxes.slice(0, 3);
}
