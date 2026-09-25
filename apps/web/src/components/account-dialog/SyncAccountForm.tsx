"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrokerIcon } from "@/components/ui/broker-icon";
import { postJson, useApi } from "@/lib/use-api";
import { getBrokerMetadata } from "@/lib/brokers/broker-catalog";
import type { BrokerSdkInfo } from "@/types/import";

export interface SyncAccountFormProps {
  onSuccess: (newAccountId: string) => void;
}

export function SyncAccountForm({ onSuccess }: SyncAccountFormProps) {
  const { data: brokerData } = useApi<{ brokers: BrokerSdkInfo[] }>("/api/brokers");
  const [syncBrokerId, setSyncBrokerId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [syncAccountName, setSyncAccountName] = useState("");
  const [syncCredentials, setSyncCredentials] = useState<Record<string, string>>({});
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const selectedSyncMeta = brokerData?.brokers.find((b) => b.id === syncBrokerId);
  const selectedBrokerMeta = syncBrokerId ? getBrokerMetadata(syncBrokerId) : undefined;

  const filteredBrokers = useMemo(() => {
    const list = brokerData?.brokers ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (b) => b.displayName.toLowerCase().includes(q) || b.id.toLowerCase().includes(q),
    );
  }, [brokerData?.brokers, searchQuery]);

  const handleSelectBroker = (broker: BrokerSdkInfo) => {
    setSyncBrokerId(broker.id);
    setSyncAccountName(`${broker.displayName} Sync`);
    setSyncCredentials({});
    setSyncError(null);
  };

  const handleConnectSync = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!syncBrokerId) return;
    setSyncBusy(true);
    setSyncError(null);

    const brokerMeta = brokerData?.brokers.find((b) => b.id === syncBrokerId);
    const finalName = syncAccountName.trim() || (brokerMeta?.displayName ?? "Connected Exchange");

    try {
      const res = await postJson<{ id: string }>("/api/accounts", {
        name: finalName,
        kind: "sync",
        broker: syncBrokerId,
        credentials: syncCredentials,
        timeZone: "UTC",
      });
      onSuccess(res.id);
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause.message : "Failed to connect API broker.");
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <form onSubmit={handleConnectSync} className="space-y-4">
      {!selectedSyncMeta ? (
        /* STEP 1: CATALOG OF PROVIDERS */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium text-foreground">Select Sync Provider</Label>
              <p className="text-[11px] text-muted-foreground">
                Connect via direct broker API keys or OAuth for automatic trade synchronization.
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-2 font-mono text-muted-foreground border-border/70 shrink-0"
            >
              {brokerData?.brokers?.length ?? 16} Providers
            </Badge>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              id="sync-search-input"
              aria-label="Search sync providers"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search broker or exchange (e.g. Binance, Topstep, IBKR)..."
              className="pl-8 h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
            />
          </div>

          {/* Grid of Providers */}
          <div className="grid grid-cols-2 auto-rows-max content-start gap-2 min-h-[340px] max-h-[400px] overflow-y-auto pr-1">
            {filteredBrokers.map((broker) => {
              const meta = getBrokerMetadata(broker.id);
              return (
                <button
                  key={broker.id}
                  type="button"
                  onClick={() => handleSelectBroker(broker)}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/80 hover:bg-muted/40 hover:border-border p-3 text-left transition-all duration-150 cursor-pointer active:scale-[0.99] group shadow-2xs"
                >
                  <BrokerIcon
                    icon={meta?.icon || `${broker.id}.svg`}
                    iconDark={meta?.iconDark}
                    name={meta?.name || broker.displayName}
                    invertInDark={meta?.invertInDark}
                    className="size-6 rounded-md object-contain shrink-0 group-hover:scale-105 transition-transform"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-foreground truncate">
                      {broker.displayName}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">API Sync</span>
                  </div>
                </button>
              );
            })}
            {filteredBrokers.length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <p className="text-xs">No providers found matching &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* STEP 2: CREDENTIALS FOR SELECTED PROVIDER */
        <div className="space-y-3.5">
          {/* Selected Broker Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3 min-w-0">
              <BrokerIcon
                icon={selectedBrokerMeta?.icon || `${selectedSyncMeta.id}.svg`}
                iconDark={selectedBrokerMeta?.iconDark}
                name={selectedBrokerMeta?.name || selectedSyncMeta.displayName}
                invertInDark={selectedBrokerMeta?.invertInDark}
                className="size-7 rounded-md object-contain shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {selectedSyncMeta.displayName}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] h-4.5 px-1.5 py-0 text-primary border-primary/40 bg-primary/10"
                  >
                    API Sync
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  Direct exchange / broker integration
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSyncBrokerId("");
                setSyncCredentials({});
              }}
              className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer shrink-0 ml-2"
            >
              Change broker
            </Button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between h-5">
              <Label htmlFor="sync-account-name" className="text-xs font-medium text-foreground">
                Account Name
              </Label>
            </div>
            <Input
              id="sync-account-name"
              value={syncAccountName}
              onChange={(e) => setSyncAccountName(e.target.value)}
              placeholder={`e.g. My ${selectedSyncMeta.displayName} Account`}
              className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
              required
            />
          </div>

          {(selectedSyncMeta.credentials ?? []).map((cred) => (
            <div key={cred.key} className="space-y-1.5">
              <div className="flex items-center justify-between h-5">
                <Label
                  htmlFor={`sync-cred-${cred.key}`}
                  className="text-xs font-medium text-foreground"
                >
                  {cred.label}
                </Label>
              </div>
              <Input
                id={`sync-cred-${cred.key}`}
                type={cred.secret ? "password" : "text"}
                value={syncCredentials[cred.key] ?? ""}
                onChange={(e) =>
                  setSyncCredentials((prev) => ({
                    ...prev,
                    [cred.key]: e.target.value,
                  }))
                }
                className="h-9 text-xs font-mono rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
                placeholder={cred.secret ? "••••••••••••" : `Enter ${cred.label.toLowerCase()}`}
                autoComplete="off"
                required
              />
            </div>
          ))}

          {selectedSyncMeta.readOnlySetup && (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5 text-xs text-muted-foreground flex items-start gap-2.5">
              <ShieldCheck className="size-4 shrink-0 text-emerald-500 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-foreground text-xs">
                  Read-Only Permission Required:
                </span>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {selectedSyncMeta.readOnlySetup}
                </p>
              </div>
            </div>
          )}

          {syncError && (
            <p role="alert" className="text-xs text-destructive font-medium">
              {syncError}
            </p>
          )}

          <Button
            type="submit"
            disabled={
              syncBusy ||
              !syncBrokerId ||
              (selectedSyncMeta.credentials.some((c) => !syncCredentials[c.key]) ?? false)
            }
            className="w-full h-9 text-xs font-medium rounded-lg cursor-pointer active:scale-[0.98] transition-transform duration-100"
          >
            {syncBusy ? "Connecting & syncing…" : `Connect & Sync ${selectedSyncMeta.displayName}`}
          </Button>
        </div>
      )}
    </form>
  );
}
