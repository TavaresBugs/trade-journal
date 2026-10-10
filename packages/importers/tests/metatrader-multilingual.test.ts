import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseAuto } from "../src/detect";
import { importTradeHistory } from "../src/history/import";
import { decodeImportFile } from "../../../apps/web/src/lib/decode-import";

const REPORTS_DIR = "/home/jhontavares/Documents/Report MT5";

const TEST_FILES = [
  "ReportHistory-530319802-Arabic.html",
  "ReportHistory-530319802-Bengali.html",
  "ReportHistory-530319802-Bengali.xlsx",
  "ReportHistory-530319802-Bulgarian.html",
  "ReportHistory-530319802-Bulgarian.xlsx",
  "ReportHistory-530319802-PTBR.html",
  "ReportHistory-530319802-PTBR.xlsx",
  "ReportHistory-530319802-PTPT.html",
  "ReportHistory-530319802-PTPT.xlsx",
];

describe("Language-Agnostic Universal MetaTrader 4/5 Parser", () => {
  for (const filename of TEST_FILES) {
    const fullPath = path.join(REPORTS_DIR, filename);

    describe(`File: ${filename}`, () => {
      const fileBuffer = fs.readFileSync(fullPath);
      const text = decodeImportFile(
        fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
      );

      it("parses exactly 156 trades via importTradeHistory", () => {
        const history = importTradeHistory(text);

        expect(history.ok).toBe(true);
        expect(history.format.kind).toBe("metatrader");
        expect(history.trades).toHaveLength(156);

        // Verify first trade (ticket 78698762)
        const firstTrade = history.trades[0]!;
        expect(firstTrade.id).toBe("78698762");
        expect(firstTrade.symbol).toBe("US100.cash");
        expect(firstTrade.direction).toBe("long");
        expect(firstTrade.quantity).toBe(0.1);
        expect(firstTrade.entryPrice).toBe(24597.95);
        expect(firstTrade.exitPrice).toBe(24552.65);
        expect(firstTrade.stopPrice).toBe(24552.88);

        // Verify last trade (ticket 190859670)
        const lastTrade = history.trades[155]!;
        expect(lastTrade.id).toBe("190859670");
        expect(lastTrade.symbol).toBe("US100.cash");
        expect(lastTrade.direction).toBe("long");
        expect(lastTrade.quantity).toBe(0.09);
        expect(lastTrade.entryPrice).toBe(30972.18);
        expect(lastTrade.exitPrice).toBe(31047.23);
        expect(lastTrade.stopPrice).toBe(30975.9);
      });

      it("extracts account 530319802 and produces 312 executions via parseAuto", () => {
        const result = parseAuto(text);

        expect(result).not.toBeNull();
        expect(result!.account).toBe("530319802");
        expect(result!.executions).toHaveLength(312); // 156 closed positions * 2 executions (entry + exit)
        expect(result!.format).toMatch(/metatrader/);
      });
    });
  }

  describe("100% Language-Immune Synthetic Tests (Turkish & Chinese without aliases)", () => {
    it("parses synthetic Turkish MetaTrader CSV via inferMetaTraderColumns and Physical Law of Profit", () => {
      const TURKISH_CSV = [
        "Açılış Zamanı,Pozisyon,Sembol,İşlem Türü,Hacim,Giriş Fiyatı,Zarar Kes,Kâr Al,Kapanış Zamanı,Çıkış Fiyatı,Komisyon,Takas,Kâr/Zarar",
        "2026.01.05 10:00:00,1001001,EURUSD,alış,1.00,1.08500,1.08000,1.09500,2026.01.05 14:00:00,1.09200,-5.00,-1.00,700.00",
        "2026.01.06 11:00:00,1001002,GBPUSD,satış,0.50,1.28000,1.28500,1.27000,2026.01.06 15:30:00,1.28400,-3.50,0.00,-200.00",
        "2026.01.07 09:15:00,1001003,USDJPY,alış,2.00,155.500,155.000,156.500,2026.01.07 12:45:00,155.100,-8.00,-2.00,-800.00",
        "2026.01.08 13:00:00,1001004,EURUSD,satış,1.50,1.09000,1.09500,1.08000,2026.01.08 16:30:00,1.08400,-6.00,0.00,900.00",
      ].join("\n");

      const history = importTradeHistory(TURKISH_CSV);
      expect(history.ok).toBe(true);
      expect(history.format.kind).toBe("metatrader");
      expect(history.trades).toHaveLength(4);

      // Trade 1: Buy (alış) - Won
      const t1 = history.trades[0]!;
      expect(t1.id).toBe("1001001");
      expect(t1.symbol).toBe("EURUSD");
      expect(t1.direction).toBe("long");
      expect(t1.quantity).toBe(1.0);
      expect(t1.entryPrice).toBe(1.085);
      expect(t1.exitPrice).toBe(1.092);
      expect(t1.stopPrice).toBe(1.08);
      expect(t1.pnl).toBe(694); // 700 + (-5) + (-1)
      expect(t1.fees).toBe(6);

      // Trade 2: Sell (satış) - Lost
      const t2 = history.trades[1]!;
      expect(t2.id).toBe("1001002");
      expect(t2.symbol).toBe("GBPUSD");
      expect(t2.direction).toBe("short");
      expect(t2.quantity).toBe(0.5);
      expect(t2.entryPrice).toBe(1.28);
      expect(t2.exitPrice).toBe(1.284);
      expect(t2.stopPrice).toBe(1.285);
      expect(t2.pnl).toBe(-203.5); // -200 + (-3.5)
      expect(t2.fees).toBe(3.5);

      // Trade 3: Buy (alış) - Lost
      const t3 = history.trades[2]!;
      expect(t3.id).toBe("1001003");
      expect(t3.symbol).toBe("USDJPY");
      expect(t3.direction).toBe("long");
      expect(t3.quantity).toBe(2.0);
      expect(t3.entryPrice).toBe(155.5);
      expect(t3.exitPrice).toBe(155.1);
      expect(t3.pnl).toBe(-810); // -800 + (-8) + (-2)

      // Trade 4: Sell (satış) - Won
      const t4 = history.trades[3]!;
      expect(t4.id).toBe("1001004");
      expect(t4.symbol).toBe("EURUSD");
      expect(t4.direction).toBe("short");
      expect(t4.quantity).toBe(1.5);
      expect(t4.entryPrice).toBe(1.09);
      expect(t4.exitPrice).toBe(1.084);
      expect(t4.pnl).toBe(894); // 900 + (-6)

      // Verify parseAuto produces 8 executions
      const autoResult = parseAuto(TURKISH_CSV);
      expect(autoResult).not.toBeNull();
      expect(autoResult!.executions).toHaveLength(8);
      expect(autoResult!.executions[0]!.side).toBe("buy");
      expect(autoResult!.executions[1]!.side).toBe("sell");
      expect(autoResult!.executions[2]!.side).toBe("sell");
      expect(autoResult!.executions[3]!.side).toBe("buy");
    });

    it("parses synthetic Chinese MetaTrader HTML report via isPositionsHeader and Physical Law of Profit", () => {
      const CHINESE_HTML = `
<!DOCTYPE html>
<html>
<head>
<title>888999111: MetaTrader 5 交易报告</title>
<meta name="generator" content="client terminal">
</head>
<body>
<div>Account: 888999111</div>
<div align=left><b>持仓仓位:</b></div>
<table cellspacing=1 cellpadding=2 border=0>
<tr bgcolor="#C0C0C0">
  <th>开仓时间</th>
  <th>仓位编号</th>
  <th>交易品种</th>
  <th>交易类别</th>
  <th>交易量</th>
  <th>开仓价格</th>
  <th>止损位</th>
  <th>止盈位</th>
  <th>平仓时间</th>
  <th>平仓价格</th>
  <th>手续费</th>
  <th>隔夜利息</th>
  <th>平仓盈亏</th>
</tr>
<tr>
  <td>2026.02.01 09:00:00</td>
  <td>2001001</td>
  <td>US100.cash</td>
  <td>买</td>
  <td>1.00</td>
  <td>20000.00</td>
  <td>19950.00</td>
  <td>20100.00</td>
  <td>2026.02.01 11:30:00</td>
  <td>20080.00</td>
  <td>-4.00</td>
  <td>0.00</td>
  <td>800.00</td>
</tr>
<tr>
  <td>2026.02.02 10:00:00</td>
  <td>2001002</td>
  <td>US100.cash</td>
  <td>卖</td>
  <td>0.50</td>
  <td>20100.00</td>
  <td>20150.00</td>
  <td>20000.00</td>
  <td>2026.02.02 14:00:00</td>
  <td>20050.00</td>
  <td>-2.50</td>
  <td>-0.50</td>
  <td>250.00</td>
</tr>
</table>
<div align=left><b>挂单:</b></div>
<table cellspacing=1 cellpadding=2 border=0>
<tr><th>时间</th><th>订单</th><th>品种</th><th>类型</th></tr>
</table>
</body>
</html>
`;

      const history = importTradeHistory(CHINESE_HTML);
      expect(history.ok).toBe(true);
      expect(history.format.kind).toBe("metatrader");
      expect(history.trades).toHaveLength(2);

      const t1 = history.trades[0]!;
      expect(t1.id).toBe("2001001");
      expect(t1.direction).toBe("long");
      expect(t1.quantity).toBe(1.0);
      expect(t1.entryPrice).toBe(20000);
      expect(t1.exitPrice).toBe(20080);
      expect(t1.stopPrice).toBe(19950);
      expect(t1.pnl).toBe(796);

      const t2 = history.trades[1]!;
      expect(t2.id).toBe("2001002");
      expect(t2.direction).toBe("short");
      expect(t2.quantity).toBe(0.5);
      expect(t2.entryPrice).toBe(20100);
      expect(t2.exitPrice).toBe(20050);
      expect(t2.stopPrice).toBe(20150);
      expect(t2.pnl).toBe(247);

      const autoResult = parseAuto(CHINESE_HTML);
      expect(autoResult).not.toBeNull();
      expect(autoResult!.account).toBe("888999111");
      expect(autoResult!.executions).toHaveLength(4);
      expect(autoResult!.executions[0]!.side).toBe("buy");
      expect(autoResult!.executions[1]!.side).toBe("sell");
      expect(autoResult!.executions[2]!.side).toBe("sell");
      expect(autoResult!.executions[3]!.side).toBe("buy");
    });
  });
});
