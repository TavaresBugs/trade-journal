# Interactive Broker — How to import your trades from Interactive Broker(IBKR) into TradeZella using the file upload method?

Source: https://help.tradezella.com/en/articles/5995780-interactive-broker-how-to-import-your-trades-from-interactive-broker-ibkr-into-tradezella-using-the-file-upload-method

Importing your trades from Interactive Brokers into TradeZella involves a one-time setup in your Interactive Brokers account. After completing this setup, future imports will be quick and easy. Follow the steps below to get started.



## One-Time Setup in Interactive Brokers

Step 1: Start by logging into your Interactive Brokers Client Portal.

Step 2: In the main menu, click on "Performance and Statements," and from the dropdown, select “Flex Queries.”



Step 3: Create a New Trade Confirmation Flex Query by Clicking on the plus icon next to the Trade Confirmation Flex Query title.





Step 4: Enter the name "TradeZella" next to the Query Name. Select "Trade Confirmation" under Sections, and a pop-up will appear.

From the pop-up, click on Executions and ensure "Select All" is checked. Scroll down and click "SAVE."



### Set General Configurations

Under General Configurations, select the specific account you want to export trades from and leave all other settings as default

Then, click on "Continue."



Step 5: A new window will appear for you to review the query. Click "Create." A confirmation window will appear. Click "Ok."



Step 6: Interactive Brokers will take you back to the Flex Queries page.

Click the blue arrow icon pointing to the right next to the Flex Query you just created called TradeZella.





Step 7: Select the date range of trades you would like to import (e.g., Last 365 Calendar Days). Then select CSV for the file format and hit RUN. A CSV file will be downloaded to your computer.



## Uploading the exported file into TradeZella

- Visit the TradeZella Add Trade page here or by clicking the “Add Trade” button on the sidebar.

Visit the TradeZella Add Trade page here or by clicking the “Add Trade” button on the sidebar.

- On the Add Trade page, click “Add New Account” if you’re creating a new account for these trades.

On the Add Trade page, click “Add New Account” if you’re creating a new account for these trades.

If you’re uploading trades to an existing account, simply click on the “Add Trades” button in the account field:

- On the Add New Account page, select Interactive Brokers as the broker and click Continue.

On the Add New Account page, select Interactive Brokers as the broker and click Continue.

- Next, select the File Upload method and click Continue again.

Next, select the File Upload method and click Continue again.

- On the final step, select the timezone of the file and upload the file. The system will handle the rest.

On the final step, select the timezone of the file and upload the file. The system will handle the rest.



## For Future File Imports

For future imports, you only need to follow steps 6 and 7:

- Click on the blue arrow next to the query you created.

Click on the blue arrow next to the query you created.

- Select the date range of trades.

Select the date range of trades.

- Hit RUN to generate a new CSV file.

Hit RUN to generate a new CSV file.

- Upload the newly generated CSV file.

Upload the newly generated CSV file.

By following these steps, you ensure that your trading data is always up-to-date in TradeZella, allowing you to leverage its powerful features for your trading analysis and tracking.



## Common Errors

If your file upload is giving you an issue:

- Go to the import history page.

Go to the import history page.

- Click on the dropdown right next to the file upload you just did.

Click on the dropdown right next to the file upload you just did.

- Scroll to the right. If you see an invalid date and time, it means that you missed a step.

Scroll to the right. If you see an invalid date and time, it means that you missed a step.

To resolve this:

- Open the query and ensure the following configurations are set under General Configurations:Date Format: Select “yyyyMMdd”Time Format: Select “HHmmss”Date/Time Separator: Select “semi-colon”

Open the query and ensure the following configurations are set under General Configurations:

- Date Format: Select “yyyyMMdd”

Date Format: Select “yyyyMMdd”

- Time Format: Select “HHmmss”

Time Format: Select “HHmmss”

- Date/Time Separator: Select “semi-colon”

Date/Time Separator: Select “semi-colon”

After these steps, you should be able to re-run the import and get your trades imported into TradeZella.

If you have any questions or need assistance, feel free to reach out to our support team — we’re here to help!

- Interactive Brokers — How to Sync your Interactive Brokers (IBKR) Account with TradeZella

- ATAS — How to import trades from ATAS into TradeZella using the file upload method?

- cTrader — How to import trades from cTrader into TradeZella using the file upload method?

- TC2000 — How to import trades from TC2000 into TradeZella using the file upload method?

- FTMO — How to Import Trades from FTMO into TradeZella Using the File Upload Method?

