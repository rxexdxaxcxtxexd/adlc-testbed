# C17. Apps Script web app: executeAs USER_ACCESSING vs USER_DEPLOYING

Retrieved: 2026-10-07

## Answer

`USER_DEPLOYING` runs every request with the deploying account's permissions. Any Sheet or Drive file the deployer can reach works for every visitor, and files the script creates belong to the deployer. `USER_ACCESSING` runs with each visitor's own permissions. The visitor must pass a Google consent screen, can only touch Sheets and files they can already reach, and becomes the owner of files the script creates (the docs imply this but do not state it outright). `DOMAIN` allows only users in the deployer's domain, `ANYONE` allows any signed-in Google user, and `ANYONE_ANONYMOUS` allows anyone, even if not logged in. Installable triggers, both time-based and form submit, always run as the account that created the trigger. `Session.getActiveUser().getEmail()` can return a blank string, notably in a web app that runs as the deployer, unless the visitor is the developer or in the same Workspace domain.

## Findings

| Claim | Source (exact URL) | Quote or close paraphrase |
|---|---|---|
| `USER_ACCESSING` meaning | https://developers.google.com/apps-script/manifest/web-app-api-executable | "The web app runs as the user accessing it." |
| `USER_DEPLOYING` meaning | https://developers.google.com/apps-script/manifest/web-app-api-executable | "The web app runs as the user who deployed it." |
| `MYSELF` access | https://developers.google.com/apps-script/manifest/web-app-api-executable | "Only the deploying user can run the app." |
| `DOMAIN` access | https://developers.google.com/apps-script/manifest/web-app-api-executable | "Only users in the same domain as the deployer can run it." |
| `ANYONE` access | https://developers.google.com/apps-script/manifest/web-app-api-executable | "Any logged-in user." |
| `ANYONE_ANONYMOUS` access | https://developers.google.com/apps-script/manifest/web-app-api-executable | "Any user, even if not logged in." |
| Execute as me uses the owner's identity for everyone | https://developers.google.com/apps-script/guides/web | "the script always executes as you, the owner of the script, no matter who accesses the web app." |
| Execute as user uses the visitor's identity | https://developers.google.com/apps-script/guides/web | "the script runs under the identity of the active user using the web app." |
| Visitors under execute-as-user see a consent screen showing the owner's email | https://developers.google.com/apps-script/guides/web | "This permission approach causes the web app to show the email of the script owner when the user authorizes access." The user "is presented with the granular OAuth consent screen." |
| Visitors can grant or deny single scopes, so the script should check | https://developers.google.com/apps-script/guides/web | Google recommends that the script "executes checks (using ScriptApp.getAuthorizationInfo)" before calling services. |
| Rate limit on new users authorizing an execute-as-user app | https://developers.google.com/apps-script/guides/web | "Apps Script imposes limits on the rate at which new users can authorize a web app that executes as the user." Limits depend partly on whether the publisher is in a Workspace domain. No numbers given. |
| Shared drive web apps run as the deployer | https://developers.google.com/apps-script/guides/web | In a shared drive, choosing "execute as you" makes the app run "under the authority of the user that deployed it (since there is no script owner)." |
| Moving the script to a shared drive or another domain breaks the web app | https://developers.google.com/apps-script/guides/web | "Web apps deployed in one domain cease to function if their ownership changes to a shared drive or account in a different domain." Redeploying fixes it. |
| Installable triggers run as the creator | https://developers.google.com/apps-script/guides/triggers/installable | "Installable triggers always run under the account of the person who created them." |
| Triggers run with no one present | https://developers.google.com/apps-script/guides/triggers/installable | When "a time-driven trigger runs or another user activates your form-submit trigger, you might not even be at your computer." |
| Form submit trigger fires on a response | https://developers.google.com/apps-script/guides/triggers/installable | "An installable form submit trigger runs when a user responds to a form." |
| `getActiveUser()` email can be blank | https://developers.google.com/apps-script/reference/base/session | "If security policies do not allow access to the user's identity, `User.getEmail()` returns a blank string." |
| Email is not available in an execute-as-me web app | https://developers.google.com/apps-script/reference/base/session | The email is "not available in any context that allows a script to run without that user's authorization," including "a web app deployed to 'execute as me'." |
| Same-domain caveat | https://developers.google.com/apps-script/reference/base/session | "these restrictions generally do not apply if the developer runs the script themselves or belongs to the same Google Workspace domain as the user." |
| `getEffectiveUser()` under each mode | https://developers.google.com/apps-script/reference/base/session | For an execute-as-me web app it "returns the developer's user account." Under an installable trigger it "returns the account of the user who created the trigger." |
| Created files count against the owner's storage | https://support.google.com/drive/answer/9312312 | "Files in shared folders only consume the cloud storage quota of the original file owner, never the recipient." |
| Trigger count and runtime quotas | https://developers.google.com/apps-script/guides/services/quotas | Triggers: "20 / user / script." Trigger total runtime: "6 hr / day" for Workspace. Runtime: "6 min / execution." |

## Implications for this build

- Inference: For the anonymous subcontractor upload page, use `USER_DEPLOYING` with `ANYONE_ANONYMOUS`. That is the only pairing that lets someone with no Google account reach the app and still write to Drive and the Sheet.
- Inference: For the internal staff app, `USER_DEPLOYING` with `DOMAIN` is simpler. Staff need no access to the data Sheet, and the deployer account is the single gate. The cost is that the script must do its own role checks.
- Inference: Under `USER_DEPLOYING`, identify staff with `Session.getActiveUser().getEmail()` only because staff share the deployer's Workspace domain. The Session docs say the same-domain case is generally an exception. Treat a blank email as "deny".
- Inference: `USER_ACCESSING` with `DOMAIN` gives a reliable audit trail (each staff member acts as themselves) but each person must be shared on the Sheet and Drive folder and must accept the consent screen.
- Inference: Script-created files belong to the deploying account under `USER_DEPLOYING`. Use a dedicated build account as the deployer so files do not sit in one person's My Drive.
- Inference: Installable triggers (nightly expiry check, form submit) run as whoever created them. Create them from that same build account.
- Inference: If files should live in a shared drive, keep the script itself in My Drive. The web app guide warns that moving ownership to a shared drive stops a deployed web app until it is redeployed.

## Unknowns

- Whether a file created by a script into a shared drive folder has a person as owner. The Apps Script pages I read do not say. Test by creating a file with `Folder.createFile(blob)` into a shared drive folder and checking the owner in Drive.
- Whether `USER_ACCESSING` can be combined with `ANYONE_ANONYMOUS`. The manifest page lists both values but does not say the pairing is blocked. Try the deployment dialog and note which options it allows.
- What `getActiveUser().getEmail()` returns inside an installable trigger. The Session page covers simple triggers and execute-as-me web apps, and the triggers page does not cover it. Log the value from a test time-based trigger and a test form submit trigger.
- The numeric authorization rate limit for `USER_ACCESSING` apps. The guide gives none.
- Whether the Workspace admin allows `ANYONE_ANONYMOUS` deployments. Deploy a test app and open it signed out in a private browser window.
- The exact ownership of files created under `USER_ACCESSING`. The docs say only that the script runs "under the identity of the active user." Test with a second domain account and check the file owner.
