# Ninjatrader — How to import trades from Ninjatrader into TradeZella using the file upload method?

Source: https://help.tradezella.com/en/articles/6499264-ninjatrader-how-to-import-trades-from-ninjatrader-into-tradezella-using-the-file-upload-method

​💡 Pro Tip: Want to effortlessly import your trades into TradeZella?​Good news! TradeZella fully supports NinjaTrader sync. Just head over to the Broker Sync page and follow the easy steps to connect your NinjaTrader account and have your trade imported automatically into TradeZella. Happy trading!



Importing your trade data from NinjaTrader into TradeZella is simple and efficient. Follow the steps below to ensure a smooth transfer of your trade executions.



## For NinjaTrader 7

Access Account Performance

- In NinjaTrader's Control Center, navigate to the Account Performance tab.

In NinjaTrader's Control Center, navigate to the Account Performance tab.

Generate Performance History

- Generate a performance history for the account and instruments you wish to import. Once the data is generated and displayed in the Summary, switch to the Executions tab.

Generate a performance history for the account and instruments you wish to import. Once the data is generated and displayed in the Summary, switch to the Executions tab.

Export Executions

- You should now see a list of trade executions. Export the file into CSV format before uploading it to TradeZella.

You should now see a list of trade executions. Export the file into CSV format before uploading it to TradeZella.



## For NinjaTrader 8 (NT8 - Latest Versions)

- In the Control Center, go to the Trade Performance window.

In the Control Center, go to the Trade Performance window.

- On the Trade Performance tab, click on the Display dropdown menu and select 'Executions.'

On the Trade Performance tab, click on the Display dropdown menu and select 'Executions.'

- Set the desired date range for the trades you want to export and click the "Generate" button.

Set the desired date range for the trades you want to export and click the "Generate" button.

- Once the results are displayed, right-click anywhere in the list and select "Export."

Once the results are displayed, right-click anywhere in the list and select "Export."

- Choose "Save as type" as CSV and save the file to your desired location on your computer.

Choose "Save as type" as CSV and save the file to your desired location on your computer.



## Uploading the exported file into TradeZella

- Visit the TradeZella Add Trade page here or by clicking the “Add Trade” button on the sidebar.

Visit the TradeZella Add Trade page here or by clicking the “Add Trade” button on the sidebar.

- On the Add Trade page, click “Add New Account” if you’re creating a new account for these trades.

On the Add Trade page, click “Add New Account” if you’re creating a new account for these trades.

If you’re uploading trades to an existing account, simply click on the “Add Trades” button in the account field:

- On the Add New Account page, select NinjaTrader as the broker and click Continue.

On the Add New Account page, select NinjaTrader as the broker and click Continue.

- Next, select the File Upload method and click Continue again.

Next, select the File Upload method and click Continue again.

- On the final step, select the timezone of the file and upload the file. The system will handle the rest.

On the final step, select the timezone of the file and upload the file. The system will handle the rest.



## Common Errors

- If your file fails to upload, it may be due to incorrect headers. Ensure your CSV file includes the following headers:Instrument, Action, Quantity, Price, Time, ID, E/X, Position, Order ID, Name, Commission, Rate, Account, Connection.

If your file fails to upload, it may be due to incorrect headers. Ensure your CSV file includes the following headers:

- Instrument, Action, Quantity, Price, Time, ID, E/X, Position, Order ID, Name, Commission, Rate, Account, Connection.

Instrument, Action, Quantity, Price, Time, ID, E/X, Position, Order ID, Name, Commission, Rate, Account, Connection.

- For additional issues with Ninjatrader CSV uploads, refer to the following help article: Ninjatrader CSV File Failing to Upload.

For additional issues with Ninjatrader CSV uploads, refer to the following help article: Ninjatrader CSV File Failing to Upload.

- An example file is attached below for your reference.

An example file is attached below for your reference.

Importing your trades from Ninjatrader into TradeZella is designed to be user-friendly and efficient. By following these steps, you'll maintain accurate trading records and gain insights to optimize your trading strategies. Happy trading!🚀

If you have any questions or need assistance, feel free to reach out to our support team — we’re here to help!

- Why is my Ninjatrader CSV file failing to upload?

- Match-Trader — How to import trades from Match-Trader into TradeZella using the file upload method?

- MotiveWave — How to import trades from MotiveWave into TradeZella using the file upload method?

- Tickblaze — How to import trades from Tickblaze into TradeZella using the file upload method?

- Moomoo — How to import trades from Moomoo into TradeZella using the file upload method?

