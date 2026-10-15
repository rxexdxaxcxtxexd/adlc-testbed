# C1. Google Forms file upload: sign-in, ownership, limits, and alternatives

Retrieved: 2026-10-07

## Answer

Yes. A Google Forms "File upload" question requires every respondent to sign in to a Google account, so a subcontractor with no Google account cannot answer it. Google's help pages do not say whether an outside-domain account holder can upload. They do say a form owner can restrict a form to a domain, and the file upload question can't be used if the form sits in a shared drive or if the admin turns on Data Loss Prevention. Uploaded files go to a new folder in the form owner's Drive. The owner can set allowed file types, a maximum file count and a maximum file size, but the help page gives no numbers. For anonymous upload, Google's docs support two routes. One is an Apps Script web app with access set to anyone (even if not logged in) and run as the deployer, which receives the file as a Blob through `google.script.run`. The other is a mailbox that gets the PDF as an email attachment, which a script reads with GmailApp. Google publishes no size limit for the web app route.

## Findings

| Claim | Source (exact URL) | Quote or close paraphrase |
|---|---|---|
| File upload needs a Google sign-in | https://support.google.com/docs/answer/7322334?p=forms_file_upload | "To answer this question, responders need to sign in to a Google Account." |
| Respondent-side help repeats the sign-in rule | https://support.google.com/docs/answer/15473134?hl=en | To upload, "you need to sign in to your Google Account." |
| Files go to the form owner's Drive | https://support.google.com/docs/answer/7322334?p=forms_file_upload | "For the form owner, uploaded files are stored in a new folder on Google Drive." |
| Question type is blocked for shared-drive forms and under DLP | https://support.google.com/docs/answer/7322334?p=forms_file_upload | "You can't use this question type, if: The form is stored in a shared drive. Your administrator turns on Data Loss Prevention." |
| Owner sets type, count and size limits (no numbers given) | https://support.google.com/docs/answer/7322334?p=forms_file_upload | "Specify which file types responders can upload." "Set up the maximum number of files responders can upload." "Choose the maximum file size responders can upload." |
| Respondents cannot upload from a shared drive | https://support.google.com/docs/answer/15473134?hl=en | "You can't upload a file from a shared drive." |
| Owners can restrict a form to a domain or trusted audience | https://support.google.com/docs/answer/2839588 | "Before owners publish a form, they can restrict the access to a domain, trusted audience, or group of users." |
| A form with a file upload question can't be embedded in an email | https://support.google.com/docs/answer/2839588 | "File upload question" is listed under "You can't embed a form in an email when it contains:" |
| Storage counts against the file owner, not other users | https://support.google.com/drive/answer/9312312 | "Files in shared folders only consume the cloud storage quota of the original file owner, never the recipient." Forms files created or edited after June 1, 2021 count toward quota. |
| Web app access value for anonymous users | https://developers.google.com/apps-script/manifest/web-app-api-executable | `ANYONE_ANONYMOUS`: "Any user, even if not logged in." `ANYONE`: "Any logged-in user." |
| "Execute as me" runs as the owner for every visitor | https://developers.google.com/apps-script/guides/web | "the script always executes as you, the owner of the script, no matter who accesses the web app." |
| A form element with a file input can be passed to the server | https://developers.google.com/apps-script/guides/html/communication | "A form element within the page is also legal as a parameter, but it must be the function's only parameter." Values become strings "except for the contents of file-input fields, which become `Blob` objects." The page's own example saves the uploaded file to Drive. |
| No documented size limit for `google.script.run` payloads | https://developers.google.com/apps-script/guides/html/communication and https://developers.google.com/apps-script/guides/services/quotas | Neither page states a payload or upload size limit for `google.script.run` or HtmlService. |
| Script runtime limit | https://developers.google.com/apps-script/guides/services/quotas | "6 min / execution" for consumer and Workspace accounts. |
| A server function can save a Blob to a Drive folder | https://developers.google.com/apps-script/reference/drive/folder | `createFile(blob)`: "Creates a file in the current folder from a given Blob of arbitrary data." |
| Apps Script email attachment limits | https://developers.google.com/apps-script/guides/services/quotas | "Email attachments" 250 per message; total attachment size "25 MB / msg" for both account types. |
| Gmail attachment limits for Workspace accounts are set by the admin | https://support.google.com/mail/answer/6584 | "For personal Gmail accounts, the limit is 25 MB." For work and school accounts "your Google Workspace administrator sets the attachment sending limits" and "attachment receiving limits." |

## Implications for this build

- Inference: Google Forms file upload does not work for subcontractors without a Google account. Do not plan the subcontractor intake on it.
- Inference: Google Forms is still fine for internal staff or for text-only intake with no upload question.
- Inference: The cleanest Google-only anonymous route is a web app with `executeAs: USER_DEPLOYING` and `access: ANYONE_ANONYMOUS`. The page posts a form with a file input to a server function through `google.script.run`. The function saves the Blob to a Drive folder that the deploying account can write to.
- Inference: Under that setup every file is created as the deploying account. The script can't know who uploaded it, so the form must collect identity fields (company, email, job) and the script should validate them.
- Inference: An anonymous upload endpoint is open to abuse. Add a server-side check that the file is a PDF, enforce a size cap in code, and consider a per-job token in the URL.
- Inference: The email route (subcontractor emails the PDF to a monitored mailbox, a time-based trigger reads it with GmailApp) needs no web page. It is harder to tie each email to the right record, and the limit is whatever the Workspace admin sets.
- Inference: A Workspace admin policy may block `ANYONE_ANONYMOUS` deployments or outside sharing. Confirm the admin settings before the POC depends on it.

## Unknowns

- Whether people with a Google account outside the Workspace domain can answer a file upload question on a form that is not domain-restricted. The help pages do not say. Test with a personal Gmail account against a test form.
- The numeric options for Forms file size and file count. The current help page gives none. Check the question settings in the Forms editor.
- The size limit for a file passed through `google.script.run`. Google documents none. Test with PDFs of 5, 10, 25 and 50 MB and record where it fails.
- Whether the domain's admin settings allow a web app deployed with access "Anyone" (anonymous). Try a test deployment and open the URL in a private browser window while signed out.
- The Gmail receiving limit for this Workspace domain. Ask the Workspace admin or send a test attachment of known size.
- Who owns the files in the Forms upload folder (the owner or the respondent). The help page says only that files land in the owner's Drive. Check a test upload's owner field in Drive.
