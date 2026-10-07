## Introduction {#introduction}

This SRS describes the Member Savings Statement Portal: a mobile-friendly web portal for members, a staff printing screen and an SMS alert service.

## Functional requirements {#functional}

- **SR-01:** Login with mobile number and a 6-digit one-time code, valid for 5 minutes. *(BR-01)*
- **SR-02:** Lock the account for 30 minutes after 5 wrong codes. *(BR-01)*
- **SR-03:** The balance screen shows the balance as of the last core banking sync. *(BR-02)*
- **SR-04:** The transaction list covers 12 months, newest first, 20 per page. *(BR-02)*
- **SR-05:** PDF statements carry BRAC branding and the branch details. *(BR-03)*
- **SR-06:** Staff print a member's statement from the branch screen. *(BR-04)*
- **SR-07:** An SMS is sent within 5 minutes of a transaction being recorded. *(BR-05)*
- **SR-08:** Pages load within 3 seconds on a 3G connection. *(BR-02)*

## Non-functional requirements {#non_functional}

Pages load within 3 seconds on 3G. The portal is available 99% of the time between 7 am and 10 pm.

## Integrations {#integrations}

Core banking (savings accounts, every 30 minutes), SMS gateway, branch directory.

## Security and data protection {#security}

One-time codes are never stored in logs. Sessions end after 10 minutes of inactivity. Statements are generated on request and not kept.

## Hosting and devices {#hosting}

BRAC data centre in Dhaka. Works on any phone browser from the last five years.
