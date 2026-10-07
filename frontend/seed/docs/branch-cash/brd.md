## Business context {#context}

Branches reconcile daily cash by hand in Excel. The signed Charter sets three objectives: automatic daily reconciliation (OBJ-1), tracing every difference within 2 working days (OBJ-2), and one view of open differences for area managers (OBJ-3).

## Users and stakeholders {#users}

- **Branch accountants** enter the vault count and close the day.
- **Branch managers** review and sign off the daily close.
- **Area managers** follow up open differences.
- About 2,300 branches, one accountant and one manager each.

## Current process (as-is) {#current_process}

The branch accountant counts the vault at 5:00 pm, copies the day's collections and disbursements from core banking printouts into Excel, and emails the sheet to the area office the next morning. The area office checks the sheets by hand once a week.

## Future process (to-be) {#future_process}

The branch accountant enters the vault count in the app by 5:00 pm. The app pulls the day's transactions from core banking, matches them with the count and flags any difference. The branch manager reviews and signs off the close the same evening. The area manager follows up every open difference until it is explained.

## Business requirements {#requirements}

- **BR-01:** Accountants enter the daily vault count by denomination. *(OBJ-1)*
- **BR-02:** The app matches the count with the day's core banking transactions. *(OBJ-1)*
- **BR-03:** Differences are flagged with the transactions most likely to explain them. *(OBJ-2)*
- **BR-04:** Branch managers sign off the daily close. *(OBJ-1)*
- **BR-05:** Area managers see and follow up all open differences in their area. *(OBJ-3)*

## Reporting needs {#reports}

- Daily close status per branch.
- Weekly differences by area.
- Monthly aged differences.

## Assumptions and constraints {#constraints}

- Core banking data arrives late on busy days.
- Branch managers approve write-offs up to BDT 5,000; larger differences go to Internal Audit.
