# RevioLink – Updates

> Founder spec, received 2026-07-09. Source: "RevioLink Latest 1- Optimisations.docx".
> Read together with `CM-GUIDE-V2.md` (the fuller v2 guide). Where the two differ on User Management placement, the v2 guide (Account group) wins.

## Dashboard

1. On the list of channels there should be quick action buttons on the row of every channel:

- Disconnect

- Close/Open all dates

- Re-sync

# Calendar

1. All rooms should be visible in the calendar, not selectable on top. There should be a dropdown button on the top left that expands the calendar view or hides it, showing only the room type, whether each date is open or closed, and the number of rooms to sell.

2. The calendar should have a row "Number of rooms sold" for each date/room type.

3. The calendar should have the following filtering options on top:

- Select Room Types – this filter lets you select which room types the calendar is showing. By default, the calendar should always show all room types. The filter is temporary and resets when you leave the calendar.

- Select Rate Plans – same logic as the room type filter. This controls the visible rate plans. For example, you can hide the Non-refundable rate and only display the Standard rate.

- On the row of each room type there should be a Bulk Edit button to make bulk edits only for that room type. When opened, you should be able to select the rate plan and the updates you want to make (inventory, open/close, change rate for 1 pax, 2 pax, restrictions, etc.).

- The third filter should be "Customise Display". This is where you choose which rows the calendar displays. You should be able to toggle on/off:

- Rates

- Inventory

- Restrictions

- Rooms Sold

Calendar Navigation & Date Range

- The calendar should support inventory and rate management for the next 2 years.

- The default calendar view should display 30 consecutive days.

- When the 30-day view is selected, there should be Previous and Next navigation arrows allowing the user to quickly move to the previous or next 30-day period.

- Additionally, the calendar should include Start Date and End Date fields, allowing the user to define a custom viewing period. For example:

- 18.09.2026 → 18.10.2026

- Regardless of the selected dates, the maximum viewing period should be limited to 30 consecutive days to ensure the calendar remains clean, readable, and provides the best graphical experience.

4. BULK UPDATE MENU

This menu should be merged with Restrictions. Basically, the Restrictions page should become fields inside the Bulk Update mask.

Bulk Update should be able to control all rows in the calendar except "Rooms Sold", as this information is based on the actual sold rooms for the given date.

# Rooms & Rates

When creating a room type, there should not be an Inventory field. Inventory is managed on the calendar and exists on a date level.

Instead, the room type should have a field:

Total Number of Rooms

This reflects the actual number of physical rooms of that room type in the property. It serves as a safety net—if someone tries to load more inventory for a given date than the actual physical rooms available, the system should display an Attention prompt informing the user that they are loading more inventory than physically exists.

This should not prevent the user from saving the inventory. It should simply act as a reminder.

When creating a rate plan, it should also include the following settings:

- Minimum Stay

- Maximum Stay

This allows creating rate plans specifically intended for minimum 2-night stays, for example. The restriction remains on the rate plan level, meaning the Channel Manager sends the minimum stay for all dates, and it cannot be edited on individual dates.

- Advanced Purchase Restriction

- Minimum Days

- Maximum Days

If the restriction is set to Minimum 3 Days, the Channel Manager automatically closes the next three days from today on a rolling basis.

If the restriction is set to Maximum 3 Days, the Channel Manager automatically closes all dates beyond the next three days on a rolling basis.

Add another tab under Rooms & Rates:

### Rate Plan Linkage

This is where derivative pricing rules are configured between rate plans.

It would also be nice to have a simple graphical overview of the currently active linkages, for example:

BB

↓

BB NR

↓

Mobile NR

# Channels

When opening a channel, there should be no currency setting.

Currency belongs on Property Settings, and every connected channel should simply inherit it.

The best possible currency-related function would be automatic currency conversion.

For example, if all rates are currently in EUR and the user chooses to convert them to GBP, the system should:

- ask for the exchange rate;

- automatically convert every rate for every date.

Each channel page should also contain the same quick actions available from the Dashboard:

- Disconnect

- Close/Open all dates

- Re-sync

Also:

- add channel logos for a cleaner interface;

- keep Mapping Completeness (it's great);

- add a secondary information bar showing:

Connectivity Health – Last 24 Hours

This should display what percentage of updates were successfully delivered. Anything below 100% should be flagged with an exclamation mark.

# Mapping

Split the mapping into two separate sections.

### Room Types

Left side:

- room types created in the Channel Manager.

Right side:

- room types pulled from the OTA;

- dropdown mapping on each row;

- product code pulled from the OTA.

### Rate Plans

Exactly the same logic.

This separation is needed because room mappings control:

- inventory;

- open/close.

Whereas rate plan mappings control:

- rates;

- restrictions.

These are two completely different connectivity streams.

# Reservations

Add filtering options at the top:

### Channel

- multiple selection;

- if nothing is selected, ALL channels are considered selected.

### Reservation Number

- free text;

- allow multiple reservation numbers separated by commas.

### Date Type

Dropdown with:

- Check-in Date

- Check-out Date

- Booking Date

- Cancellation Date

- Stay-in Date

### Date

Always display:

- Begin Date

- End Date

When clicked, a smaller calendar opens for selecting both dates.

Behaviour:

- Check-in Date → displays all reservations checking in during the selected period.

- Check-out Date → displays all reservations checking out during the selected period.

- Booking Date → displays all reservations booked during the selected period.

- Cancellation Date → displays all reservations cancelled during the selected period.

- Stay-in Date → displays all reservations staying in the property during the selected period.

Filters should support cross-filtering, meaning the user can combine multiple filters simultaneously.

Example:

Booking.com + Check-in Date + 1–10 July

→ only reservations matching all selected filters should be displayed.

# Sync Center

Add a scrollable Logs tab.

Allow users to filter logs by channel.

Use colour coding:

- Green = successful

- Red = unsuccessful

Merge Error Centre into Sync Center.

Errors should become a dashboard section at the top.

The Audit Log should also be moved under Sync Center.

# Settings

Add:

- Total Number of Rooms

- Currency

The selected currency becomes the property's default currency and is reflected throughout the calendar.

If the currency changes, display the following prompt:

"Would you like to convert all existing rates?"

If Yes:

- ask for the conversion rate;

- convert all rates in the calendar.

If No:

- only the displayed currency changes;

- all numeric values remain exactly the same.

### Reservation Delivery

Add:

- Primary Reservation Email

- all reservations are sent here if the property is not connected directly to a PMS.

- Secondary Reservation Email

### Notifications

Today's Arrivals

- toggle;

- if enabled, allow selecting Primary and/or Secondary email;

- allow selecting the time when the summary email is sent.

Tomorrow's Arrivals

Exactly the same logic.

# User Management

Remove User Management from Settings.

Move it to a separate item in the main navigation under Operations.