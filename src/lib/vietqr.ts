/** Tạo mã VietQR (NAPAS) rồi vẽ QR bằng thư viện qrcode. */

function tlv(tag: string, value: string) {
  const len = value.length.toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

function crc16(data: string) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildVietQrPayload(input: {
  bankBin: string;
  accountNo: string;
  amount?: number;
  addInfo?: string;
}) {
  const guid = tlv("00", "A000000727");
  const beneficiary = tlv(
    "01",
    tlv("00", input.bankBin) + tlv("01", input.accountNo),
  );
  const service = tlv("02", "QRIBFTTA");
  const merchant = tlv("38", guid + beneficiary + service);

  let payload = tlv("00", "01") + tlv("01", input.amount ? "12" : "11") + merchant + tlv("53", "704");
  if (input.amount && input.amount > 0) {
    payload += tlv("54", String(Math.round(input.amount)));
  }
  payload += tlv("58", "VN");
  if (input.addInfo) {
    payload += tlv("62", tlv("08", input.addInfo.slice(0, 25)));
  }
  payload += "6304";
  return payload + crc16(payload);
}

export function getSaasBank() {
  return {
    bankBin: process.env.VIETQR_BANK_BIN ?? "970422",
    bankName: process.env.VIETQR_BANK_NAME ?? "MB Bank",
    accountNo: process.env.VIETQR_ACCOUNT_NO ?? "0123456789",
    accountName: process.env.VIETQR_ACCOUNT_NAME ?? "CONG TY SO BAI XE",
  };
}

export type TenantBank = {
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
};

export function tenantBankOrNull(tenant: {
  bankBin: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
}): TenantBank | null {
  if (!tenant.bankBin || !tenant.bankAccountNo || !tenant.bankAccountName) {
    return null;
  }
  return {
    bankBin: tenant.bankBin,
    bankName: tenant.bankName ?? "Ngân hàng",
    accountNo: tenant.bankAccountNo.replace(/\s/g, ""),
    accountName: tenant.bankAccountName,
  };
}

export function resolveCollectBank(
  tenant: {
    bankBin: string | null;
    bankName: string | null;
    bankAccountNo: string | null;
    bankAccountName: string | null;
  },
  branch?: {
    bankBin: string | null;
    bankName: string | null;
    bankAccountNo: string | null;
    bankAccountName: string | null;
  } | null,
): TenantBank | null {
  if (branch?.bankBin && branch.bankAccountNo && branch.bankAccountName) {
    return tenantBankOrNull({
      bankBin: branch.bankBin,
      bankName: branch.bankName,
      bankAccountNo: branch.bankAccountNo,
      bankAccountName: branch.bankAccountName,
    });
  }
  return tenantBankOrNull(tenant);
}
