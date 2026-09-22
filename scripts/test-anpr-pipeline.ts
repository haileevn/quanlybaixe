import {
  validateVietnamPlate,
  VALID_VN_PROVINCES,
} from "../src/lib/anpr/validator";
import {
  normalizeVietnamPlate,
  canonicalPlate,
  formatPlateDisplay,
  sanitizeAlphaInSeriesPosition,
  sanitizeDigitInNumberPosition,
} from "../src/lib/anpr/normalize";
import { calculateConfidence } from "../src/lib/anpr/confidence";
import { MultiFrameVoting } from "../src/lib/anpr/voting";
import { anprDeduplicator, SCAN_RESULT_COOLDOWN_MS, AI_FALLBACK_COOLDOWN_MS } from "../src/lib/anpr/dedup";

async function runTests() {
  console.log("==================================================");
  console.log("🧪 BẮT ĐẦU CHẠY KIỂM THỬ TOÀN BỘ ANPR PIPELINE");
  console.log("==================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail ?? "");
    }
  }

  // TEST 1: Biển 2 dòng xe máy (Trường hợp của bạn: 51H / 919.91)
  const t1 = normalizeVietnamPlate("51H\n919.91");
  assert(
    t1.isValid && t1.formattedPlate === "51H-919.91" && t1.canonicalPlate === "51H91991",
    "Test 1: Biển 2 dòng xe máy (51H \\n 919.91) -> 51H-919.91",
    t1
  );

  // TEST 2: Biển 2 dòng xe máy khác (59-H1 / 889.12)
  const t2 = normalizeVietnamPlate("59-H1\n889.12");
  assert(
    t2.isValid && t2.formattedPlate === "59H1-889.12",
    "Test 2: Biển 2 dòng xe máy (59-H1 \\n 889.12) -> 59H1-889.12",
    t2
  );

  // TEST 3: Biển ô tô 1 dòng (51H-919.91 hoặc 30A-123.45)
  const t3 = normalizeVietnamPlate("30A-123.45");
  assert(
    t3.isValid && t3.formattedPlate === "30A-123.45",
    "Test 3: Biển ô tô 1 dòng (30A-123.45)",
    t3
  );

  // TEST 4: Sửa lỗi OCR nhầm lẫn ký tự số và chữ theo ngữ cảnh (S->5, I->1, O->0)
  const t4 = normalizeVietnamPlate("S1F\nI23.4S");
  assert(
    t4.isValid && t4.formattedPlate === "51F-123.45",
    "Test 4: Context-aware OCR confusion (S1F \\n I23.4S) -> 51F-123.45",
    t4
  );

  // TEST 5: Loại bỏ chuỗi rác môi trường / quạt trần / đồ vật trong phòng
  const t5a = normalizeVietnamPlate("CEILING FAN 2026");
  const t5b = normalizeVietnamPlate("IIB1-SQ426");
  const t5c = normalizeVietnamPlate("ROOM NOISE 123");
  assert(
    !t5a.isValid && !t5b.isValid && !t5c.isValid,
    "Test 5: Loại bỏ 100% rác môi trường (Ceiling fan, room noise)",
    { t5a, t5b, t5c }
  );

  // TEST 6: Kiểm tra 63 mã tỉnh thành Việt Nam
  const t6a = validateVietnamPlate("51H91991");
  const t6b = validateVietnamPlate("00H91991"); // Mã 00 không tồn tại
  assert(
    t6a.isValid && !t6b.isValid,
    "Test 6: Validator mã tỉnh thành (51 = TP.HCM -> hợp lệ, 00 -> không hợp lệ)",
    { t6a, t6b }
  );

  // TEST 7: Canonical key nhất quán (51H-919.91 -> 51H91991)
  assert(
    canonicalPlate("51H-919.91") === "51H91991" &&
      canonicalPlate(" 59-H1 889.12 ") === "59H188912",
    "Test 7: Canonical Plate key (51H-919.91 -> 51H91991)"
  );

  // TEST 8: Multi-frame voting loại bỏ 1 frame nhiễu
  const voting = new MultiFrameVoting(5);
  voting.push("51H-919.91", 0.95);
  voting.push("51H-919.91", 0.95);
  voting.push("51H-919.99", 0.60); // 1 frame nhiễu
  voting.push("51H-919.91", 0.95);
  const voteRes = voting.push("51H-919.91", 0.95);
  assert(
    voteRes !== null && voteRes.plate === "51H91991" && voteRes.count === 4 && voteRes.consensusRatio === 0.8,
    "Test 8: Multi-frame voting (4/5 phiếu chọn 51H91991)",
    voteRes
  );

  // TEST 9: Tính điểm tin cậy tổng hợp (calculateConfidence)
  const confHigh = calculateConfidence({
    detectionConfidence: 0.95,
    ocrConfidence: 0.98,
    isValidPattern: true,
    consensusRatio: 1.0,
  });
  const confLow = calculateConfidence({
    detectionConfidence: 0.5,
    ocrConfidence: 0.4,
    isValidPattern: false,
    consensusRatio: 0.2,
  });
  assert(
    confHigh >= 0.88 && confLow === 0.0,
    "Test 9: Calculate Confidence (High >= 0.88, Invalid = 0.0)",
    { confHigh, confLow }
  );

  // TEST 10: Deduplication & Cooldown (Chống double lookup trong 5s)
  anprDeduplicator.reset();
  const dedupKey = "51H91991";
  assert(
    !anprDeduplicator.isDuplicateLookup(dedupKey),
    "Test 10a: First lookup -> Chưa duplicate"
  );
  anprDeduplicator.markLookup(dedupKey);
  assert(
    anprDeduplicator.isDuplicateLookup(dedupKey),
    "Test 10b: Immediate re-lookup (<5s) -> Throttled duplicate"
  );

  // TEST 11: AI Fallback Throttling Cache (10s)
  const fp = "sample_fingerprint_123";
  assert(
    !anprDeduplicator.shouldThrottleAiCall(fp),
    "Test 11a: AI call first time -> Không throttle"
  );
  anprDeduplicator.markAiCall(fp, "51H-919.91");
  assert(
    anprDeduplicator.shouldThrottleAiCall(fp),
    "Test 11b: AI call repeated within 10s -> Throttled"
  );

  // TEST 12: Biển số xe máy 4 số cũ (59H1-1234)
  const t12 = normalizeVietnamPlate("59H11234");
  assert(
    t12.isValid && t12.formattedPlate === "59H1-1234",
    "Test 12: Biển số xe máy 4 số cũ (59H11234) -> 59H1-1234",
    t12
  );

  // TEST 13: Biển số ô tô 4 số cũ (52P-1234)
  const t13 = normalizeVietnamPlate("52P1234");
  assert(
    t13.isValid && t13.formattedPlate === "52P-1234",
    "Test 13: Biển số ô tô 4 số cũ (52P1234) -> 52P-1234",
    t13
  );

  console.log("\n==================================================");
  console.log(`🏁 KẾT QUẢ KIỂM THỬ: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log("==================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
