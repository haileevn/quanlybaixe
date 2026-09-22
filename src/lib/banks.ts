export const VN_BANKS = [
  { bin: "970422", name: "MB Bank" },
  { bin: "970436", name: "Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970405", name: "Agribank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970432", name: "VPBank" },
  { bin: "970416", name: "ACB" },
  { bin: "970423", name: "TPBank" },
  { bin: "970443", name: "SHB" },
  { bin: "970414", name: "VIB" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970448", name: "OCB" },
  { bin: "970437", name: "HDBank" },
  { bin: "970426", name: "MSB" },
  { bin: "970441", name: "Vikki / Viet Capital" },
] as const;

export function bankNameFromBin(bin: string) {
  return VN_BANKS.find((row) => row.bin === bin)?.name ?? "Ngân hàng";
}
