# Tradovate — How to import trades from Tradovate into TradeZella using the file upload method?

Source: https://help.tradezella.com/en/articles/6472250-tradovate-how-to-import-trades-from-tradovate-into-tradezella-using-the-file-upload-method

With our straightforward guide, you can easily import your trades from Tradovate into TradeZella. Follow these steps to ensure your trading data stays accurate and up-to-date.

​💡 Pro Tip: Want to effortlessly import your trades into TradeZella?​Good news! TradeZella fully supports Tradovate sync. Just head over to the Broker Sync page and follow the easy steps to connect your Tradovate account and have your trade imported automatically into TradeZella. Happy trading!

## Exporting trade data from Tradovate into a file

Tradovate P&L Issue: Commissions and Fees Not Showing Up Correctly? Check out the linked help article to resolve the issue.

- Open the Tradovate desktop platform.

Open the Tradovate desktop platform.

- Click on the ACCOUNTS tab in the upper panel and choose the account for which you want to export trades.

Click on the ACCOUNTS tab in the upper panel and choose the account for which you want to export trades.

- Next to the selected account, click on the gear/settings icon.

Next to the selected account, click on the gear/settings icon.

- On the settings page, click on the ORDERS tab.

On the settings page, click on the ORDERS tab.

- Enter the dates you wish to export and click Go.

Enter the dates you wish to export and click Go.

- Click Download Report to save the file to your computer.

Click Download Report to save the file to your computer.





## Uploading the exported file into TradeZella

- Visit the TradeZella Add Trade page here or by clicking the “Add Trade” button on the sidebar.

Visit the TradeZella Add Trade page here or by clicking the “Add Trade” button on the sidebar.

- On the Add Trade page, click “Add New Account” if you’re creating a new account for these trades.

On the Add Trade page, click “Add New Account” if you’re creating a new account for these trades.

If you’re uploading trades to an existing account, simply click on the “Add Trades” button in the account field:

- On the Add New Account page, select Tradovate as the broker and click Continue.

On the Add New Account page, select Tradovate as the broker and click Continue.

- Next, select the File Upload method and click Continue again.

Next, select the File Upload method and click Continue again.

- On the final step, select the timezone of the file and upload the file. The system will handle the rest.

On the final step, select the timezone of the file and upload the file. The system will handle the rest.

Your Tradovate data is exported in the local timezone by default, so please ensure you select your local timezone for accurate timestamps and entry and exits in the Trade charts.



## Common Errors

- File Upload Issues: If your file fails to upload, ensure it was exported from the ORDERS tab to avoid import issues.

File Upload Issues: If your file fails to upload, ensure it was exported from the ORDERS tab to avoid import issues.

- Correct Headers: Check that your CSV file matches the correct import headers:

Correct Headers: Check that your CSV file matches the correct import headers:

orderId | Account | Order ID | B/S | Contract | Product | Product Description | avgPrice | filledQty | Fill Time | lastCommandId | Status | _priceFormat | _priceFormatType | _tickSize | spreadDefinitionId | Version ID | Timestamp | Date | Quantity | Text | Type | Limit Price | Stop Price | Filled Qty | Avg Fill Price

- An Example file is attached below for your reference

An Example file is attached below for your reference

## Important Notes

- P&L Discrepancies Due to Commissions: Tradovate does not include commissions in their CSV file. You can manually add commissions and fees in TradeZella or set default commission rules here.

P&L Discrepancies Due to Commissions: Tradovate does not include commissions in their CSV file. You can manually add commissions and fees in TradeZella or set default commission rules here.

- Time Zone Issues: If you notice discrepancies in entry and exit points on the trade chart, ensure you select your local timezone correctly during the import process. Read more about resolving this issue here.

Time Zone Issues: If you notice discrepancies in entry and exit points on the trade chart, ensure you select your local timezone correctly during the import process. Read more about resolving this issue here.

- Sync Import: TradeZella also supports sync import methods for Tradovate. You can sync your account directly from the broker sync page here.

Sync Import: TradeZella also supports sync import methods for Tradovate. You can sync your account directly from the broker sync page here.



If you have any questions or need assistance, feel free to reach out to our support team — we’re here to help!

- Webull — How to import trades from Webull into TradeZella using the file upload method?

- TradeStation — How to import trades from TradeStation into TradeZella using the file upload method?

- Ninjatrader — How to import trades from Ninjatrader into TradeZella using the file upload method?

- cTrader — How to import trades from cTrader into TradeZella using the file upload method?

- Tradovate — How to Sync your Tradovate Account with TradeZella

