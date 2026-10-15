# Certificate of insurance compliance

The business words for checking that every subcontractor on a construction project carries the insurance the project requires, before work starts and before each payment.

## Language

### Certificates and records

**Certificate**:
One certificate-of-insurance document received from a subcontractor, together with the values read from it.
_Avoid_: COI file, submission, version

**Compliance record**:
The single record for one subcontractor on one project, which always points to that subcontractor's current certificate.
_Avoid_: COI record, row, entry

**Renewal**:
A newer certificate for the same subcontractor and project that replaces the current one; the replaced certificate stays in history.
_Avoid_: update, new version

**Duplicate**:
The same file received a second time.
_Avoid_: resubmission (a resubmission is a new certificate)

**Unreadable file**:
An upload the system cannot read: an encrypted, corrupt or non-PDF file.
_Avoid_: bad scan, failed OCR

### Requirements and checking

**Project requirements**:
The coverages and minimum limits a project demands, adjusted by the subcontractor's scope of work.
_Avoid_: sample COI, Exhibit A, insurance spec

**Scope of work**:
The kind of work a subcontractor does on a project, such as roofing or cleaning, which can raise or relax the project requirements.
_Avoid_: trade, category

**Check result**:
The outcome of comparing one certificate against the project requirements: a pass, or a list of deficiencies.
_Avoid_: verdict, comparison result

**Deficiency**:
One project requirement that a certificate fails, such as a $1M umbrella where $2M is required.
_Avoid_: exception, error, failure

**Waived**:
A person's decision to accept a certificate despite a deficiency.
_Avoid_: exception accepted, override

**Rejected**:
A person's decision that a deficiency must be fixed, which sends the subcontractor a correction request.
_Avoid_: exception rejected, declined

**Additional insured endorsement**:
The part of a subcontractor's policy that extends its coverage to the firm; a certificate that does not show it has a deficiency.
_Avoid_: endorsement (alone), AI listing

**Confidence**:
How sure the reading of a certificate is, from 0 to 1; below 0.85 a person must check the reading.
_Avoid_: accuracy, score

### Review and approval

**Needs review**:
A certificate a person must look at before anything else happens, because its reading is low-confidence or could not be read.
_Avoid_: flagged, pending

**Review mode**:
A project setting that says which check results wait for a person: review all, review deficiencies, or automatic.
_Avoid_: trust ramp, automation level

**Status**:
Where a compliance record is in its life: awaiting, needs review, in review, compliant, expiring soon, expired or closed. Payment hold is not a status.
_Avoid_: state, verdict

**Awaiting**:
The status of a compliance record whose subcontract has been issued but which has no certificate yet.
_Avoid_: missing, outstanding, not received

### Payment

**Pay application**:
One subcontractor's bill for one pay period on one project.
_Avoid_: pay app, invoice

**Payment hold**:
A mark on a subcontractor who must not be paid this pay cycle, with the reasons why; it sits alongside the status and lifts once every reason is gone.
_Avoid_: blocked, Do-Not-Pay

**Payment hold list**:
The report, before each pay cycle, of every subcontractor on payment hold and why. Planned to go each week to the accountants as the COI Sub-Contract Payment Holds - Digest. The code does not send that email yet.
_Avoid_: Do-Not-Pay list, Do-Not-Pay digest

**W-9**:
The tax form a subcontractor must have on file before being paid.

### People

**Accountant**:
The person who works the review queue for a project and confirms who can be paid.
_Avoid_: AP, bookkeeper

**Project manager**:
The person who decides on deficiencies in the context of the subcontractor's work.
_Avoid_: PM (on screen)

**Leadership**:
The people who set the project requirements and the review mode, and decide escalated deficiencies.
_Avoid_: executive, owner, admin

### Notifications

Each automated email has one name. The notification log shows what the code sends and, marked "Not sent", the notices that are planned and not built yet. The demo sends none.

**Certificate received**:
The confirmation email to the subcontractor's contact that a certificate arrived and is being checked. Planned, not built: the code does not send it yet.
_Avoid_: receipt, acknowledgement

**Deficiency found**:
The email, to the subcontractor's contact and to the project manager, that a certificate fails a project requirement. The project manager's copy asks for a decision on the deficiency (waive or reject) and the code sends it. The subcontractor's copy is planned, not built.
_Avoid_: exception notice, sent to the project manager

**Low-confidence reading**:
The email to the accountant that a certificate was read below 0.85 confidence and needs review before anything else happens. Planned, not built: the certificate goes to the review queue, but the code sends no email.
_Avoid_: OCR warning, flagged reading

**Expiring in 30 days**:
The reminder to the subcontractor's contact, 30 days before the current certificate expires, asking for a renewal. It is a separate event from Expiring in 7 days.
_Avoid_: 30-day nudge, renewal reminder

**Expiring in 7 days**:
The follow-up to the subcontractor's contact, 7 days before the current certificate expires. A record first seen inside 7 days gets this one only.
_Avoid_: 7-day nudge, final notice

**Payment hold notice**:
The email to the accountant that a subcontractor is on payment hold, such as when a certificate has expired.
_Avoid_: Do-Not-Pay alert, expired notice

**Renewal accepted**:
The email to the subcontractor's contact that a renewal is approved and replaces the current certificate.
_Avoid_: renewal approved, update accepted

**COI Sub-Contract Payment Holds - Digest**:
The weekly email (Thursday, 6:00 AM) to the accountants that lists every subcontractor on the payment hold list. It is the payment hold list, sent by email. Planned, not built: the code does not send it yet.
_Avoid_: Do-Not-Pay digest, Do-Not-Pay list

**Upload link**:
The email that gives a subcontractor's contact the personal link for sending a certificate, to go out when the compliance record is created. Planned, not built: the code does not send it yet. Reminders and requests carry the link.
_Avoid_: invitation, request link

**Resend request**:
The email asking the subcontractor's contact to send an unreadable file again as a standard PDF.
_Avoid_: re-upload request, bad scan notice

**Correction request**:
The email, after the project manager rejects a certificate, that lists every deficiency and asks for a corrected certificate.
_Avoid_: rejection notice, deficiency letter

**Certificate approved**:
The email to the subcontractor's contact that a first certificate is approved. A later certificate that replaces one is a Renewal accepted.
_Avoid_: approval notice, acceptance

**Duplicate notice**:
The email to the subcontractor's contact that the same file arrived twice and nothing changed.
_Avoid_: duplicate warning

**Cleared for payment notice**:
The email to the accountant that a payment hold lifted because every reason is gone.
_Avoid_: release notice, unblock

### Running modes

**Share Proj**:
The public, safe way the app runs. Anyone with the link opens it with no sign-in. A visitor's changes stay in that browser tab. Nothing is saved, no email goes out, and Gemini reads no file. In code this is demo mode: `isDemoMode()` is true and the Script Property `DEMO_MODE` is `on`.
_Avoid_: demo mode (except when you name the code), demo, sandbox

**Demo Proj**:
The real way the app runs. Every action writes to the shared Sheet, emails go out, uploads go to Drive and Gemini reads them, and the timers run. In code this is demo mode off: `DEMO_MODE` is `off`. Never leave the public deployments in Demo Proj.
_Avoid_: live mode, non-demo mode, production
