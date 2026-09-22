import { AppShell } from "@/components/layout/AppShell";
import { SettingsPanel } from "@/components/layout/SettingsPanel";
import { SettingsGroup } from "@/components/layout/SettingsGroup";
import { ReminderSettings } from "@/components/finance/ReminderSettings";
import { ModuleSettings } from "@/components/modules/ModuleSettings";
import { BankSettings } from "@/components/layout/BankSettings";
import { getTenantContext } from "@/lib/session";
import { canManageSettings } from "@/lib/rbac";
import { getTenantOrThrow } from "@/services/tenant.service";
import { listDeletedVehicles } from "@/services/vehicle.service";
import { parseEnabledModules, parseReminderConfig } from "@/lib/modules";
import { isSmsConfigured } from "@/lib/sms";
import { listSmsLogs } from "@/services/reminder.service";
import { listBranchesForBank } from "@/services/collect.service";

export default async function SettingsPage() {
  const { user } = await getTenantContext();
  const tenant = await getTenantOrThrow(user.tenantId);
  const isOwner = canManageSettings(user.role);
  const trash = isOwner ? await listDeletedVehicles(user.tenantId) : [];
  const reminder = parseReminderConfig(tenant.reminderConfig);
  const modules = parseEnabledModules(tenant.enabledModules);
  const smsLogs = isOwner ? await listSmsLogs(user.tenantId) : [];
  const branches = isOwner ? await listBranchesForBank(user.tenantId) : [];
  const bankReady = Boolean(tenant.bankAccountNo);

  return (
    <AppShell title="Cài đặt">
      <div className="space-y-3">
        {isOwner ? (
          <>
            <SettingsGroup
              title="Tài khoản nhận tiền"
              hint={bankReady ? tenant.bankAccountNo ?? "" : "Chưa điền STK — QR thu khách chưa hiện"}
              defaultOpen={!bankReady}
            >
              <BankSettings
                bankBin={tenant.bankBin ?? ""}
                bankAccountNo={tenant.bankAccountNo ?? ""}
                bankAccountName={tenant.bankAccountName ?? ""}
                branches={branches.map((row) => ({
                  id: row.id,
                  name: row.name,
                  bankBin: row.bankBin ?? "",
                  bankAccountNo: row.bankAccountNo ?? "",
                  bankAccountName: row.bankAccountName ?? "",
                }))}
              />
            </SettingsGroup>
            <SettingsGroup title="Loại hình kinh doanh" hint="Bật phòng trọ, mặt bằng, sạc, dịch vụ...">
              <ModuleSettings initial={modules} />
            </SettingsGroup>
            <SettingsGroup title="Nhắc hạn" hint="Lịch nhắc và SMS cho khách">
              <ReminderSettings
                daysBefore={reminder.daysBefore}
                daysOverdue={reminder.daysOverdue}
                smsEnabled={reminder.smsEnabled}
                smsReady={isSmsConfigured()}
                logs={smsLogs}
              />
            </SettingsGroup>
          </>
        ) : null}
        <SettingsPanel
          demoEnabled={tenant.demoDataEnabled}
          isOwner={isOwner}
          trash={trash.map((row) => ({
            id: row.id,
            plateNumber: row.plateNumber,
            ownerName: row.customer.name,
            deletedAt: row.deletedAt,
          }))}
        />
      </div>
    </AppShell>
  );
}
