## Introduction {#introduction}

This SRS describes the {{project}}, a tablet app for loan applications in the field and a web screen for approvals at the branch. It follows the signed BRD. In scope: {{fact:scope_in}}

## Functional requirements {#functional}

- **SR-01:** The app stores applications on the tablet when offline and syncs them when a connection returns. *(BR-01)*
- **SR-02:** The app shows the time of the last successful sync. *(BR-01)*
- **SR-03:** The app takes the member's photo and scans the national ID card with the tablet camera. *(BR-02)*
- **SR-04:** The app validates required fields and blocks submission until they are complete. *(BR-03)*
- **SR-05:** Branch managers see submitted applications and can approve or return them with a reason. *(BR-04)*
- **SR-06:** Applications above BDT 1 lakh are routed to the area manager after branch approval. *(BR-05)*
- **SR-07:** A dashboard lists pending applications per branch with their age in days. *(BR-06)*
- **SR-08:** Field officers can change the app language between Bangla and English.

## Non-functional requirements {#non_functional}

- **Performance:** {{fact:performance}}
- **Offline:** {{fact:connectivity}} All data entry works offline; sync retries automatically.
- **Usability:** a new field officer can complete an application after one hour of training.

## Integrations {#integrations}

{{fact:integrations}}

Approved applications are sent to the core banking system once a day and on demand by the branch manager.

## Security and data protection {#security}

{{fact:security}}

Applications on the tablet are deleted after they have synced and been approved.

## Hosting and devices {#hosting}

- **Hosting:** {{fact:hosting}}
- **Devices:** {{fact:devices}}
