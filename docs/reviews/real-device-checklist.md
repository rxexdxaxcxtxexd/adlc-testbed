# Real device checklist

Why this exists. The phone and iPad layouts were tested in a desktop browser that imitates a phone. A real iPhone and iPad behave differently in a few places. This list covers those places. It takes about 10 minutes.

You need:

- A real iPhone (Safari) and a real iPad (Safari).
- The link to the test deployment. Open it signed out.
- The app runs inside a frame, so some checks only fail there. Always use the deployment link, not a local file.

For each check, write Pass or Fail, and a short note if it fails. A photo of the screen helps.

Not on this list: the Data trust screen. It is hidden from navigation, so you cannot reach it.

## iPhone

1. **Drawer opens.**
   1. Open the app in portrait.
   2. Tap the menu button at the top left.
   3. You should see the navigation slide in from the left, with the page dimmed behind it.

2. **Scrim tap closes the drawer.**
   1. With the drawer open, tap the dimmed area to the right.
   2. The drawer should close.
   3. Open it again and tap a destination such as Projects. The drawer should close and the page should change.

3. **Drawer survives rotation.**
   1. Open the drawer in portrait.
   2. Turn the phone sideways, then back.
   3. The drawer should stay usable. Nothing should be cut off, and the page behind it should not scroll sideways.

4. **No zoom on search.**
   1. Tap the search box at the top.
   2. The keyboard should appear and the page should not zoom in.
   3. If the page does zoom, pinch it back and mark Fail.

5. **No zoom on the picker and dialog fields.**
   1. Tap the project picker. The page should not zoom.
   2. Open any certificate record and tap a button that opens a dialog, such as Reject.
   3. Tap each text field in the dialog. The page should not zoom on any of them.

6. **Sticky bar clears the home bar.**
   1. Open any certificate record.
   2. Look at the bar with the next action at the bottom of the screen.
   3. The buttons should sit fully above the thin home bar at the bottom edge. The home bar should not cover any button.
   4. Scroll the page. The bar should stay in place.

7. **Open PDF uses the native viewer.**
   1. On a certificate record, tap Open PDF.
   2. The phone's own PDF viewer should open, with the sample certificate in it.
   3. You should be able to pinch to zoom and go back to the app.

8. **Bottom sheet with the keyboard up.**
   1. Open a dialog that has a text field, such as Reject.
   2. Tap the text field so the keyboard appears.
   3. The sheet should stay visible. The field you are typing in and the main button should not be hidden behind the keyboard.

9. **Upload page at small size.**
   1. Open a link to the upload page. Use an iPhone SE or any small phone if you have one. Otherwise use your phone as is.
   2. Tap anywhere on the drop zone. The file picker should open.
   3. Tap the upload button. The file picker should open too.
   4. Both should be fully on screen with no sideways scroll.

10. **Tour card clears the home bar.**
    1. Open the app with `?tour=play` added to the end of the link.
    2. Go through each step of the tour.
    3. The tour card and its Next button should sit above the home bar on every step. Nothing should be cut off.

## iPad

11. **Layout in both turns.**
    1. Open the app on the iPad in portrait, then in landscape.
    2. Tables should show the first column pinned at the left, with a soft fade at the right edge when more columns scroll in.
    3. The page itself should not scroll sideways. Only the table box may scroll.
    4. The navigation should be a drawer in portrait and always visible in landscape on a large iPad.

## Both devices

12. **Works if storage is blocked.**
    1. On the iPhone, open Settings, then Safari, and turn on Prevent Cross-Site Tracking and Block All Cookies. Open a private tab if you prefer.
    2. Open the deployment link and move through Worklist, Projects and one record.
    3. The app should load and work. It may forget small things such as your last view. It should not show a blank page or an error.
    4. Turn the setting back when you are done.
