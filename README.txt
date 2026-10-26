HOSTEL MESS MANAGEMENT SYSTEM — MESSMATE PROTOTYPE
===================================================

TECHNOLOGIES
- HTML
- CSS
- JavaScript
- Browser localStorage (no server or database)

HOW TO RUN ON WINDOWS
1. Download and extract HostelMessManagement.zip.
2. Open the extracted HostelMessManagement folder.
3. Double-click index.html.
4. The website opens in your default browser.

Recommended editor: Visual Studio Code. You can open the folder in VS Code and open index.html in a browser.

STUDENT USE
1. On the login screen, enter an admission number (for example: AD2026001).
2. Click "Continue as student".
3. Open "Record meals".
4. Select the food items actually eaten for the chosen date.
5. Click "Save meal record".
6. Open "Monthly bills" to see the current or another month's total.

ADMIN USE
1. Click "Sign in as admin".
2. Demo PIN: 1234.
3. Use "Food & prices" to add, edit, or delete food items and prices.
4. Use "Meal records" to search saved records.
5. Use "Monthly bills", select a month, and click "Generate monthly bills".
6. Use "Print bill" for an individual bill or "Print all bills" for all displayed bills.

IMPORTANT LIMITATIONS
- This is a frontend-only prototype. Admission number login is not secure authentication.
- The demo admin PIN is embedded in JavaScript and is not secure.
- Data is stored only in the browser profile where the website is used. It is not shared across devices or browsers.
- Clearing browser site data can delete the saved records.
- For a real hostel, use a backend and shared database with proper authentication and backups.
- Bills are calculated from saved meal records using the current menu prices. If an admin edits or deletes a food item, historical totals may change. This keeps the prototype simple; production billing should snapshot item prices when the meal is recorded.
- The bill-generation button creates the bill view when clicked. It does not automatically run at month-end while the browser is closed.
- The prototype does not process payments.

DEFAULT DEMO FOOD PRICES
Breakfast: Idli ₹10, Dosa ₹20, Chapati ₹10
Lunch: Rice ₹20, Vegetable curry ₹15, Fish curry ₹30
Snacks: Tea ₹10, Banana ₹10, Puffs ₹20
Dinner: Rice ₹20, Chapati ₹10, Chicken curry ₹35

All default prices can be changed in the admin dashboard.
