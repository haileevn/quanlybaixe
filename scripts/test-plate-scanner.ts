import { extractVietnamesePlate } from "../src/lib/plate-ocr";

console.log("=== KIỂM THỬ TRƯỜNG HỢP XE TRONG ẢNH USER: 51H 919.91 ===");

const cases = [
  "51H\n919.91",
  "51-H\n919.91",
  "51 H\n919 91",
  "51H 919.91",
  "51H91991",
  // Các trường hợp nhiễu nền phòng, quạt trần, mặt người (không được nhận là biển số hợp lệ)
  "FAN CEILING 123",
  "HELLO 12345",
  "ROOM 402",
  "RANDOM TEXT",
];

for (const c of cases) {
  const res = extractVietnamesePlate(c);
  console.log(`Input: "${c.replace(/\n/g, ' \\n ')}"`);
  console.log(` -> Biển số: "${res.plateNumber}", Hợp lệ: ${res.isValidPattern}, Độ tin cậy: ${res.confidence}%\n`);
}
