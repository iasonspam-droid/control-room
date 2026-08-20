import { Boot } from "@/components/shell/Boot";
import { Rail } from "@/components/shell/Rail";
import { Readout } from "@/components/shell/Readout";
import { Reminders } from "@/components/shell/Reminders";
import { CloudSync } from "@/components/shell/CloudSync";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Boot>
      <div className="gridpaper flex h-dvh overflow-hidden bg-bg">
        <CloudSync />
        <Reminders />
        <Rail />
        <div className="flex min-w-0 flex-1 flex-col">
          <Readout />
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </Boot>
  );
}
