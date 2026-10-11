import { bad, handler, ok, requireValue } from "@/server/api";
import {
  getDataMaintenanceMetrics,
  resetBrokerTrades,
  clearScreenshots,
  factoryResetAllData,
} from "@/server/data-maintenance";

export const GET = handler(async () => {
  const metrics = getDataMaintenanceMetrics();
  return ok(metrics);
});

interface MaintenanceBody {
  action: "reset_trades" | "clear_screenshots" | "factory_reset";
  accountId?: string;
  confirmText?: string;
}

export const POST = handler(async (request: Request) => {
  let body: MaintenanceBody;
  try {
    body = (await request.json()) as MaintenanceBody;
  } catch {
    return bad("Invalid JSON payload.");
  }

  requireValue(body && typeof body.action === "string", "Missing action parameter.");

  switch (body.action) {
    case "reset_trades": {
      const result = resetBrokerTrades({ accountId: body.accountId });
      return ok({ success: true, action: "reset_trades", ...result });
    }

    case "clear_screenshots": {
      const result = clearScreenshots();
      return ok({ success: true, action: "clear_screenshots", ...result });
    }

    case "factory_reset": {
      if (body.confirmText !== "RESET") {
        return bad("Type 'RESET' to confirm factory reset.", 400);
      }
      const result = factoryResetAllData();
      return ok({ success: true, action: "factory_reset", ...result });
    }

    default:
      return bad("Unknown maintenance action.");
  }
});
